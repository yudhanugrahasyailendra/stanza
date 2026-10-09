# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Stanza is an Indonesian-first poetry writing/reading app: Next.js 16 (App Router) + tRPC 11 + Drizzle/MySQL, migrated from a Vite SPA + Express server (the pre-migration state is git commit `632c91c`). Package manager is pnpm; if `pnpm` is not on PATH use `corepack pnpm`.

## Commands

- `pnpm dev` — `next dev`. Needs `DATABASE_URL` for anything DB-backed; `getDb()` returns null without it, so pages render but queries fail.
- `pnpm build` — `next build` then `scripts/postbuild.mjs`, which copies `.next/static` and `public/` into `.next/standalone` (Next's standalone output omits them). `pnpm start` runs `node .next/standalone/server.js`.
- `pnpm check` — `tsc --noEmit` (test files are excluded from typechecking).
- `pnpm test` — vitest over `src/**/*.test.{ts,tsx}`. Single file: `pnpm vitest run src/server/routes.test.ts`; single test: add `-t "<name>"`.
- `pnpm db:push` — `drizzle-kit generate && migrate` (new migration from `drizzle/schema.ts`, then applies it). `pnpm db:migrate` only applies existing migrations.
- Docker: multi-stage `Dockerfile`, runner is `node server.js` from the standalone output with `HOSTNAME=0.0.0.0`.

## Architecture

- **Routes**: most `src/app/**/page.tsx` are thin re-exports of the page components in `src/views/*` (which carry `"use client"`). `src/app/layout.tsx` wraps everything in `Providers` (`src/app/providers.tsx`) and `SiteShell`. Pages using `useSearchParams` are wrapped in `<Suspense>` in their `page.tsx`.
- **Server rendering rule**: client components are still server-rendered, so never touch `window`, `document` or `localStorage` during render or in `useState` initializers. Read the query with `useSearchParams()` (not `window.location.search`, which is stale during soft navigation). `src/app/write` is the exception: the editor seeds state from localStorage, so `WriteClient.tsx` loads it with `dynamic(..., { ssr: false })`.
- **Navigation**: use `next/link` and `src/lib/navigation.ts` (`useLocation()` returns `[pathname, navigate]`, mirroring the old wouter API).
- **tRPC**: the whole `appRouter` lives in `src/server/routers.ts`, exposed by `src/app/api/trpc/[trpc]/route.ts` (fetch adapter, Node runtime). Clients are built in `src/lib/trpcClient.ts` (`createQueryClient` / `createTrpcClient`), one per browser session and per server render. Type import goes through `src/lib/trpc.ts`. Data helpers: `src/server/db.ts` (lazy drizzle connection) and `src/server/stanzaDb.ts`.
- **Server prefetch**: `src/app/explore/page.tsx` (also `/`), `src/app/profile/[username]/page.tsx` and `src/app/layout.tsx` (`auth.me`) prefetch with `getServerCaller()` (`src/server/serverTrpc.ts`, authenticated from request cookies) and `prefetchTrpc()` (`src/server/prefetch.ts`), then pass `dehydrate(queryClient)` through `HydrationBoundary`. The key and input must equal what the client component passes to `useQuery` (`trpcQueryKey` mirrors tRPC's key shape; `src/server/prefetch.test.ts` checks it against `getQueryKey`), otherwise the data is silently ignored. Failed prefetches are dropped and the client refetches. `createQueryClient` sets `staleTime` to 15s so hydrated data is not refetched on mount. Because the HTML embeds viewer-specific data, these pages must stay dynamic (Next sends `Cache-Control: private, no-store`).
- **Metadata**: `generateMetadata` in the profile page builds title/description/Open Graph from the profile, or from the poem when `?poem=<id>` belongs to that profile (`src/server/seo.ts`). It shares one request-scoped load with the page via React `cache`. No images are emitted: avatar URLs are user-supplied.
- **Runtime-neutral HTTP layer** (`src/server/_core/http.ts`): auth, CSRF and OAuth code take `HttpRequest` / `HttpResponse`, not framework types. `createFetchContext` (`src/server/_core/context.ts`) builds them from a fetch `Request`; cookies are written as `Set-Cookie` on the response headers. Do not import Express or `NextRequest` types into `src/server/`. The client IP for auth rate limiting is the rightmost `X-Forwarded-For` entry, so the app is expected to sit behind a proxy that sets it.
- **`src/server/_core/`** is platform scaffolding from the template (llm, storage, maps, sdk, notification, voice, image generation). App-specific logic belongs outside it.
- **Dual auth**: legacy Manus OAuth (`sdk.authenticateRequest`, callback logic in `handleOAuthCallback`, route at `src/app/api/oauth/callback`) and local email/password accounts (`src/server/_core/localAuth.ts`, SHA-256-hashed session tokens in `accountSessions`). `context.ts` picks one from the `stanza_auth_mode` cookie (`local` / `oauth` / `logged_out`), falling back to OAuth then local when unset.
- **CSRF**: every tRPC *mutation* must send `x-stanza-csrf` equal to the `__Host-stanza_csrf` cookie (`src/server/_core/trpc.ts`). `src/proxy.ts` issues that cookie on page requests and answers 400 for malformed `%` escapes (otherwise Next returns 500 on dynamic routes). Direct POSTs also need `Content-Type: application/json`.
- **Procedures**: `publicProcedure`, `protectedProcedure`, `adminProcedure` from `src/server/_core/trpc.ts`; all include the CSRF middleware.
- **Preferences**: language and theme are cookies (`stanza-language`, `stanza-theme`) so `src/app/layout.tsx` can render them on the server; persist changes with `persistPreference` (`src/lib/preferences.ts`), which also keeps localStorage in sync. Contexts take `initialLanguage` / `initialTheme` from the layout and adopt legacy localStorage values once.
- **i18n**: hand-rolled in `src/contexts/LanguageContext.tsx` (`id` / `en` maps keyed like `"write.draftSuccess"`; add keys to both). Server error messages are Indonesian.
- **Database**: schema in `drizzle/schema.ts` (relations in `drizzle/relations.ts`); generated SQL migrations and snapshots are checked in under `drizzle/`.
- **Path aliases**: `@/*` → `src/*`, `@shared/*` → `src/shared/*` (tsconfig and vitest). `src/app/` and route files import `src/server/` by relative path.
- **Platform notes**: `src/server/_core/publicConfig.ts` is the allowlist for runtime values exposed to the browser; keep private keys server-side. Managed `/manus-storage/` assets are served by the platform, so do not add another proxy.
