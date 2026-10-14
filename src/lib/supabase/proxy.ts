import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/write"];

function isConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`));
}

export function hasSupabaseSession(request: NextRequest) {
  return isConfigured() && request.cookies.getAll().some(({ name }) => name.startsWith("sb-"));
}

// Validates the session with the Auth server and refreshes it when the access token expired.
// Refreshed cookies must reach both the browser (response) and the rest of this request
// (NextResponse.next({ request })); otherwise Server Components and Server Actions would still
// read the stale token and see no user. Callers must return the response given back here.
async function refreshSession(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { user: null, response };

  let current = response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        const forwarded = NextResponse.next({ request });
        // Keep what the caller already put on the response (e.g. the CSRF cookie).
        current.cookies.getAll().forEach(cookie => forwarded.cookies.set(cookie));
        cookiesToSet.forEach(({ name, value, options }) => forwarded.cookies.set(name, value, options));
        current = forwarded;
      },
    },
  });

  // Do not put code between createServerClient and getUser().
  const { data } = await supabase.auth.getUser();
  return { user: data.user, response: current };
}

// Callers should gate on hasSupabaseSession() so existing behaviour is unchanged for visitors.
export async function updateSession(request: NextRequest, response: NextResponse) {
  return (await refreshSession(request, response)).response;
}

// Sends visitors without a valid Supabase user to /login (a real 307, unlike redirect() in a
// streamed page). Cookies already set on the response (CSRF, refreshed session) are carried over.
export async function requireSession(request: NextRequest, response: NextResponse) {
  const { user, response: refreshed } = await refreshSession(request, response);
  if (user) return refreshed;
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = `?returnTo=${encodeURIComponent(`${request.nextUrl.pathname}${request.nextUrl.search}`)}`;
  const redirect = NextResponse.redirect(login);
  refreshed.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
  return redirect;
}
