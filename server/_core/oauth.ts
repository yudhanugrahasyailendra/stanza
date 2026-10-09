import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import type { HttpRequest, HttpResponse } from "./http";
import { sdk } from "./sdk";
import { endAppSession, setAuthMode } from "./localAuth";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export type OAuthCallbackResult =
  | { status: 302; redirectTo: string }
  | { status: number; body: { error: string } };

/** Runtime-neutral OAuth callback: cookies go through `res`, the caller turns the result into a response. */
export async function handleOAuthCallback(input: {
  code?: string;
  state?: string;
  req: HttpRequest;
  res: HttpResponse;
}): Promise<OAuthCallbackResult> {
  const { code, state, req, res } = input;

  if (!code || !state) {
    return { status: 400, body: { error: "code and state are required" } };
  }

  // CSRF guard: the nonce in `state` must match the one-time cookie that
  // startLogin set in the browser that began this login. An attacker can
  // forge `state`, but cannot plant this cookie in the victim's browser.
  const { nonce } = decodeOAuthState(state);
  const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
  if (!nonce || nonce !== expectedNonce) {
    return { status: 403, body: { error: "invalid oauth state" } };
  }
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

  try {
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

    if (!userInfo.openId) {
      return { status: 400, body: { error: "openId missing from user info" } };
    }

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    await endAppSession(req, res);
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    setAuthMode(req, res, "oauth");

    return { status: 302, redirectTo: "/" };
  } catch (error) {
    console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "unknown error");
    return { status: 500, body: { error: "OAuth callback failed" } };
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const result = await handleOAuthCallback({
      code: getQueryParam(req, "code"),
      state: getQueryParam(req, "state"),
      req,
      res,
    });
    if ("redirectTo" in result) {
      res.redirect(result.status, result.redirectTo);
      return;
    }
    res.status(result.status).json(result.body);
  });
}
