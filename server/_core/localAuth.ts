import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { parse as parseCookieHeader } from "cookie";
import type { HttpRequest, HttpResponse } from "./http";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { accountSessions, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { getSessionCookieOptions } from "./cookies";

export const STANZA_SESSION_COOKIE = "stanza_session";
export const STANZA_AUTH_MODE_COOKIE = "stanza_auth_mode";
export const LOCAL_SESSION_MS = 1000 * 60 * 60 * 24 * 30;

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function resolveLocalSession(req: HttpRequest) {
  const token = parseCookieHeader(req.headers.cookie ?? "")[STANZA_SESSION_COOKIE];
  if (!token || token.length < 32 || token.length > 100) return null;
  const db = await getDb();
  if (!db) return null;
  const tokenHash = hashSessionToken(token);
  const [result] = await db.select({ user: users }).from(accountSessions)
    .innerJoin(users, eq(accountSessions.userId, users.id))
    .where(and(eq(accountSessions.tokenHash, tokenHash), gt(accountSessions.expiresAt, new Date())))
    .limit(1);
  if (result) return result.user;
  await db.delete(accountSessions).where(and(eq(accountSessions.tokenHash, tokenHash), lt(accountSessions.expiresAt, new Date())));
  return null;
}

export async function issueLocalSession(userId: number, req: HttpRequest, res: HttpResponse) {
  const db = await getDb();
  if (!db) throw new Error("Database akun tidak tersedia.");
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + LOCAL_SESSION_MS);
  await db.delete(accountSessions).where(lt(accountSessions.expiresAt, new Date()));
  await db.insert(accountSessions).values({ tokenHash, userId, expiresAt });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(STANZA_SESSION_COOKIE, token, { ...cookieOptions, maxAge: LOCAL_SESSION_MS });
  setAuthMode(req, res, "local");
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

export async function revokeLocalSession(req: HttpRequest) {
  const token = parseCookieHeader(req.headers.cookie ?? "")[STANZA_SESSION_COOKIE];
  if (!token) return;
  const db = await getDb();
  if (db) await db.delete(accountSessions).where(eq(accountSessions.tokenHash, hashSessionToken(token)));
}

export function clearLocalSessionCookie(req: HttpRequest, res: HttpResponse) {
  res.clearCookie(STANZA_SESSION_COOKIE, getSessionCookieOptions(req));
}

export function setAuthMode(req: HttpRequest, res: HttpResponse, mode: "local" | "oauth" | "logged_out") {
  res.cookie(STANZA_AUTH_MODE_COOKIE, mode, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

export async function endAppSession(req: HttpRequest, res: HttpResponse) {
  await revokeLocalSession(req);
  const options = getSessionCookieOptions(req);
  res.clearCookie(STANZA_SESSION_COOKIE, options);
  res.clearCookie(COOKIE_NAME, options);
  setAuthMode(req, res, "logged_out");
}
