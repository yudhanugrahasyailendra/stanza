import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../drizzle/schema";
import { parse as parseCookieHeader } from "cookie";
import { requestFromFetch, requestFromHeaders, responseFromHeaders, type HttpRequest, type HttpResponse } from "./http";
import { STANZA_AUTH_MODE_COOKIE, resolveLocalSession } from "./localAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: HttpRequest;
  res: HttpResponse;
  user: User | null;
};

async function resolveUser(req: HttpRequest): Promise<User | null> {
  const authMode = parseCookieHeader(req.headers.cookie ?? "")[STANZA_AUTH_MODE_COOKIE];
  if (authMode === "logged_out") return null;
  if (authMode === "local") return resolveLocalSession(req);
  if (authMode === "oauth") {
    try { return await sdk.authenticateRequest(req); } catch { return null; }
  }
  try { return await sdk.authenticateRequest(req); } catch { return resolveLocalSession(req); }
}

/** Next.js route handler / fetch adapter: cookies are written to `resHeaders` as Set-Cookie. */
export async function createFetchContext(
  opts: FetchCreateContextFnOptions
): Promise<TrpcContext> {
  const req = requestFromFetch(opts.req);
  return { req, res: responseFromHeaders(opts.resHeaders), user: await resolveUser(req) };
}

/**
 * Context for Server Components (via `next/headers`). Server Components cannot set cookies, so anything
 * written to `res` is discarded: only use this to run queries.
 */
export async function createServerContext(requestHeaders: { forEach(callback: (value: string, key: string) => void): void }): Promise<TrpcContext> {
  const req = requestFromHeaders(requestHeaders);
  return { req, res: responseFromHeaders(new Headers()), user: await resolveUser(req) };
}
