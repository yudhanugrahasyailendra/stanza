import type { HttpCookieOptions } from "./http";

export function getSessionCookieOptions(_req?: unknown): HttpCookieOptions {
  // Preview is public HTTPS in a cross-site frame even when the upstream request is HTTP.
  return { httpOnly: true, path: "/", sameSite: "none", secure: true };
}
