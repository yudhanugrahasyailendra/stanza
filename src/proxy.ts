import { NextResponse, type NextRequest } from "next/server";
import { STANZA_CSRF_COOKIE } from "./shared/const";
import { getSessionCookieOptions } from "./server/_core/cookies";
import { hasSupabaseSession, isProtectedPath, requireSession, updateSession } from "./lib/supabase/proxy";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function newCsrfToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

// Issues the double-submit CSRF cookie that tRPC mutations check (server/_core/trpc.ts).
// Readable by the client on purpose (httpOnly: false) so it can echo it in x-stanza-csrf.
export function proxy(request: NextRequest) {
  // Next decodes dynamic route params itself and answers 500 on malformed escapes (e.g. /profile/%E0%A4%A).
  try {
    decodeURIComponent(request.nextUrl.pathname);
  } catch {
    return new NextResponse("Bad Request", { status: 400 });
  }
  const response = NextResponse.next();
  if (!request.cookies.get(STANZA_CSRF_COOKIE)?.value) {
    const { httpOnly: _httpOnly, ...options } = getSessionCookieOptions();
    response.cookies.set({
      name: STANZA_CSRF_COOKIE,
      value: newCsrfToken(),
      ...options,
      sameSite: "none",
      httpOnly: false,
      maxAge: ONE_YEAR_SECONDS,
    });
  }
  if (isProtectedPath(request.nextUrl.pathname) && process.env.NEXT_PUBLIC_SUPABASE_URL) return requireSession(request, response);
  // Stays synchronous unless a Supabase session actually needs refreshing.
  return hasSupabaseSession(request) ? updateSession(request, response) : response;
}

export const config = {
  matcher: ["/((?!_next/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|map|txt|xml|woff2?)$).*)"],
};
