import { serialize } from "cookie";

/**
 * Runtime-neutral request/response surface used by auth, CSRF and tRPC code.
 * Express `Request`/`Response` satisfy these structurally, and so do the fetch
 * adapters below (Next.js route handlers), so the same code runs on both.
 */
export interface HttpHeaders {
  cookie?: string;
  authorization?: string;
  [name: string]: string | string[] | undefined;
}

export interface HttpRequest {
  headers: HttpHeaders;
  ip?: string;
  path?: string;
}

export interface HttpCookieOptions {
  httpOnly?: boolean;
  path?: string;
  sameSite?: "none" | "lax" | "strict" | boolean;
  secure?: boolean;
  /** Milliseconds, like Express. */
  maxAge?: number;
}

export interface HttpResponse {
  cookie(name: string, value: string, options?: HttpCookieOptions): unknown;
  clearCookie(name: string, options?: HttpCookieOptions): unknown;
}

/**
 * A fetch `Request` has no socket address, so the client IP comes from proxy
 * headers. The rightmost X-Forwarded-For entry is the one appended by the
 * nearest proxy; earlier entries are client-controlled and must not be used as
 * a rate-limit key.
 */
export function clientIpFromHeaders(headers: HttpHeaders): string | undefined {
  const forwarded = headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded.join(",") : forwarded;
  const last = raw?.split(",").map(part => part.trim()).filter(Boolean).pop();
  if (last) return last;
  const real = headers["x-real-ip"];
  return (Array.isArray(real) ? real[0] : real) || undefined;
}

export function requestFromFetch(req: Request): HttpRequest {
  const headers: HttpHeaders = {};
  req.headers.forEach((value, key) => { headers[key] = value; });
  let path: string | undefined;
  try { path = new URL(req.url).pathname; } catch { path = undefined; }
  return { headers, ip: clientIpFromHeaders(headers), path };
}

function serializeOptions(options: HttpCookieOptions) {
  const { maxAge, ...rest } = options;
  return { ...rest, ...(maxAge === undefined ? {} : { maxAge: Math.floor(maxAge / 1000) }) };
}

/** Collects cookies as `Set-Cookie` headers on the response being built. */
export function responseFromHeaders(resHeaders: Headers): HttpResponse {
  return {
    cookie(name, value, options = {}) {
      resHeaders.append("Set-Cookie", serialize(name, value, serializeOptions(options)));
    },
    clearCookie(name, options = {}) {
      const { maxAge: _ignored, ...rest } = options;
      resHeaders.append("Set-Cookie", serialize(name, "", { ...serializeOptions(rest), expires: new Date(0) }));
    },
  };
}
