import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME, STANZA_CSRF_COOKIE } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { STANZA_AUTH_MODE_COOKIE, STANZA_SESSION_COOKIE } from "./_core/localAuth";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
  value?: string;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[]; writtenCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const writtenCookies: CookieCall[] = [];
  const csrf = "a".repeat(64);

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: { cookie: `${STANZA_CSRF_COOKIE}=${csrf}`, "x-stanza-csrf": csrf },
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        writtenCookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies, writtenCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies, writtenCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies.map(cookie => cookie.name)).toEqual([STANZA_SESSION_COOKIE, COOKIE_NAME]);
    for (const cookie of clearedCookies) expect(cookie.options).toMatchObject({ secure: true, sameSite: "none", httpOnly: true, path: "/" });
    expect(writtenCookies).toHaveLength(1);
    expect(writtenCookies[0]).toMatchObject({ name: STANZA_AUTH_MODE_COOKIE, value: "logged_out", options: { secure: true, sameSite: "none", httpOnly: true, path: "/" } });
  });

  it("rejects logout without a valid CSRF cookie and header pair", async () => {
    const { ctx } = createAuthContext();
    ctx.req.headers = {};
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.logout()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
