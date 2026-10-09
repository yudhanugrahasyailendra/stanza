import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { parse as parseCookieHeader } from "cookie";
import { STANZA_AUTH_MODE_COOKIE, resolveLocalSession } from "./localAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const authMode = parseCookieHeader(opts.req.headers.cookie ?? "")[STANZA_AUTH_MODE_COOKIE];
  if (authMode === "logged_out") {
    user = null;
  } else if (authMode === "local") {
    user = await resolveLocalSession(opts.req);
  } else if (authMode === "oauth") {
    try { user = await sdk.authenticateRequest(opts.req); } catch { user = null; }
  } else {
    try { user = await sdk.authenticateRequest(opts.req); } catch { user = await resolveLocalSession(opts.req); }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
