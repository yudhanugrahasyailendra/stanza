import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { COOKIE_NAME, OAUTH_STATE_COOKIE, STANZA_CSRF_COOKIE, encodeOAuthState } from "../shared/const";
import { STANZA_AUTH_MODE_COOKIE, STANZA_SESSION_COOKIE } from "./_core/localAuth";

const sdkMock = vi.hoisted(() => ({
  exchangeCodeForToken: vi.fn(),
  getUserInfo: vi.fn(),
  createSessionToken: vi.fn(),
}));
const upsertUser = vi.hoisted(() => vi.fn());
vi.mock("./_core/sdk", () => ({ sdk: sdkMock }));
vi.mock("./db", () => ({ upsertUser, getDb: async () => null }));

import { GET as health } from "../app/api/health/route";
import { GET as csrf } from "../app/api/csrf/route";
import { GET as platformConfig } from "../app/api/platform/config.js/route";
import { GET as oauthCallback } from "../app/api/oauth/callback/route";
import { proxy } from "../proxy";

const nonce = "n".repeat(24);
const state = encodeOAuthState({ redirectUri: "https://app.example/api/oauth/callback", nonce });
const callbackUrl = (params: Record<string, string>) => `http://localhost/api/oauth/callback?${new URLSearchParams(params)}`;

describe("simple API route handlers", () => {
  it("reports health", async () => {
    expect(await health().json()).toEqual({ status: "ok" });
  });

  it("serves an uncached csrf readiness probe", async () => {
    const response = csrf();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ready: true });
  });

  it("serves the public platform script as uncached JavaScript", async () => {
    const response = platformConfig();
    expect(response.headers.get("content-type")).toBe("application/javascript");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toMatch(/^window\.__MANUS_CONFIG__=\{/);
  });
});

describe("CSRF cookie proxy", () => {
  it("issues a readable, host-only 64-hex cookie when none exists", () => {
    const response = proxy(new NextRequest("http://localhost/explore"));
    const [line] = response.headers.getSetCookie();
    expect(line).toMatch(new RegExp(`^${STANZA_CSRF_COOKIE}=[a-f0-9]{64};`));
    expect(line).toContain("Path=/");
    expect(line).toContain("Secure");
    expect(line).toContain("SameSite=none");
    expect(line).toContain("Max-Age=31536000");
    expect(line).not.toMatch(/HttpOnly/i);
    expect(line).not.toMatch(/Domain=/i);
  });

  it("issues a different token each time", () => {
    const value = () => proxy(new NextRequest("http://localhost/")).headers.getSetCookie()[0].split(";")[0];
    expect(value()).not.toBe(value());
  });

  it("keeps an existing cookie untouched", () => {
    const request = new NextRequest("http://localhost/", { headers: { cookie: `${STANZA_CSRF_COOKIE}=${"a".repeat(64)}` } });
    expect(proxy(request).headers.getSetCookie()).toHaveLength(0);
  });
});

describe("OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkMock.exchangeCodeForToken.mockResolvedValue({ accessToken: "access" });
    sdkMock.getUserInfo.mockResolvedValue({ openId: "open-1", name: "Penulis", email: "p@example.com", loginMethod: "google" });
    sdkMock.createSessionToken.mockResolvedValue("signed-session");
  });

  it("requires code and state", async () => {
    const response = await oauthCallback(new Request(callbackUrl({ code: "c" })));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "code and state are required" });
  });

  it("rejects a state whose nonce does not match the browser cookie", async () => {
    const forged = await oauthCallback(new Request(callbackUrl({ code: "c", state }), { headers: { cookie: `${OAUTH_STATE_COOKIE}=other` } }));
    expect(forged.status).toBe(403);
    const missingCookie = await oauthCallback(new Request(callbackUrl({ code: "c", state })));
    expect(missingCookie.status).toBe(403);
    const garbage = await oauthCallback(new Request(callbackUrl({ code: "c", state: "%%%" }), { headers: { cookie: `${OAUTH_STATE_COOKIE}=x` } }));
    expect(garbage.status).toBe(403);
    expect(sdkMock.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("signs the user in and redirects home with the session cookies", async () => {
    const response = await oauthCallback(new Request(callbackUrl({ code: "c", state }), { headers: { cookie: `${OAUTH_STATE_COOKIE}=${nonce}` } }));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(sdkMock.exchangeCodeForToken).toHaveBeenCalledWith("c", state);
    expect(upsertUser).toHaveBeenCalledWith(expect.objectContaining({ openId: "open-1", loginMethod: "google" }));
    const cookies = response.headers.getSetCookie();
    expect(cookies.map(line => line.split("=")[0])).toEqual([OAUTH_STATE_COOKIE, STANZA_SESSION_COOKIE, COOKIE_NAME, STANZA_AUTH_MODE_COOKIE, COOKIE_NAME, STANZA_AUTH_MODE_COOKIE]);
    expect(cookies[0]).toContain("Expires=Thu, 01 Jan 1970");
    expect(cookies[4]).toMatch(new RegExp(`^${COOKIE_NAME}=signed-session;.*Max-Age=31536000.*HttpOnly.*Secure.*SameSite=None`));
    expect(cookies[5]).toContain(`${STANZA_AUTH_MODE_COOKIE}=oauth`);
  });

  it("returns 500 without leaking details when the token exchange fails", async () => {
    sdkMock.exchangeCodeForToken.mockRejectedValue(new Error("secret upstream detail"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await oauthCallback(new Request(callbackUrl({ code: "c", state }), { headers: { cookie: `${OAUTH_STATE_COOKIE}=${nonce}` } }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "OAuth callback failed" });
    expect(response.headers.getSetCookie().join(";")).not.toContain(COOKIE_NAME + "=signed");
    errors.mockRestore();
  });
});
