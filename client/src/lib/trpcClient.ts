import { COOKIE_NAME, STANZA_CSRF_COOKIE, UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "./trpc";

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  if (window.location.pathname !== "/login") {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
};

/** One per browser session (and one per server render): never share a QueryClient across requests. */
export function createQueryClient() {
  const queryClient = new QueryClient();

  queryClient.getQueryCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.query.state.error;
      redirectToLoginIfUnauthorized(error);
      console.error("[API Query Error]", error);
    }
  });

  queryClient.getMutationCache().subscribe(event => {
    if (event.type === "updated" && event.action.type === "error") {
      const error = event.mutation.state.error;
      redirectToLoginIfUnauthorized(error);
      console.error("[API Mutation Error]", error);
    }
  });

  return queryClient;
}

export function createTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        headers() {
          if (typeof document === "undefined") return {};
          let csrfToken = "";
          try {
            const csrfPair = document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${STANZA_CSRF_COOKIE}=`));
            csrfToken = csrfPair ? decodeURIComponent(csrfPair.slice(STANZA_CSRF_COOKIE.length + 1)) : "";
          } catch {}
          // Preview auto-login fallback: when the browser blocks iframe cookies
          // (Safari ITP / private browsing / WebView), the runtime mirrors the
          // session into sessionStorage so we can forward it as a Bearer token.
          // The regular OAuth cookie flow keeps working and takes priority server-side.
          try {
            const raw = sessionStorage.getItem("manus-cookie");
            if (raw) {
              const prefix = `${COOKIE_NAME}=`;
              const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
              const token = pair?.trim().slice(prefix.length);
              if (token) {
                return { Authorization: `Bearer ${token}`, "x-stanza-csrf": csrfToken };
              }
            }
          } catch {
            // sessionStorage unavailable
          }
          return { "x-stanza-csrf": csrfToken };
        },
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    ],
  });
}
