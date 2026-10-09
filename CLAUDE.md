# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Stanza is an Indonesian-first poetry writing/reading app: Next.js 16 (App Router) + tRPC 11 + Drizzle/MySQL, migrated from a Vite SPA + Express server (the pre-migration state is git commit `632c91c`). Package manager is pnpm; if `pnpm` is not on PATH use `corepack pnpm`.

## Commands

- `pnpm dev` — `next dev`. Needs `DATABASE_URL` for anything DB-backed; `getDb()` returns null without it, so pages render but queries fail.
- `pnpm build` — `next build` then `scripts/postbuild.mjs`, which copies `.next/static` and `public/` into `.next/standalone` (Next's standalone output omits them). `pnpm start` runs `node .next/standalone/server.js`.
- `pnpm check` — `tsc --noEmit` (test files are excluded from typechecking).
- `pnpm test` — vitest over `server/**/*.test.ts` and `client/src/**/*.test.{ts,tsx}`. Single file: `pnpm vitest run server/routes.test.ts`; single test: add `-t "<name>"`.
- `pnpm db:push` — `drizzle-kit generate && migrate` (new migration from `drizzle/schema.ts`, then applies it). `pnpm db:migrate` only applies existing migrations.
- Docker: multi-stage `Dockerfile`, runner is `node server.js` from the standalone output with `HOSTNAME=0.0.0.0`.

## Architecture

- **Routes**: `app/**/page.tsx` are thin re-exports of the page components in `client/src/pages/*` (which carry `"use client"`). `app/layout.tsx` wraps everything in `Providers` (`app/providers.tsx`) and `SiteShell`. Pages using `useSearchParams` are wrapped in `<Suspense>` in their `page.tsx`.
- **Server rendering rule**: client components are still server-rendered, so never touch `window`, `document` or `localStorage` during render or in `useState` initializers. Read the query with `useSearchParams()` (not `window.location.search`, which is stale during soft navigation). `app/write` is the exception: the editor seeds state from localStorage, so `WriteClient.tsx` loads it with `dynamic(..., { ssr: false })`.
- **Navigation**: use `next/link` and `client/src/lib/navigation.ts` (`useLocation()` returns `[pathname, navigate]`, mirroring the old wouter API).
- **tRPC**: the whole `appRouter` lives in `server/routers.ts`, exposed by `app/api/trpc/[trpc]/route.ts` (fetch adapter, Node runtime). Clients are built in `client/src/lib/trpcClient.ts` (`createQueryClient` / `createTrpcClient`), one per browser session and per server render. Type import goes through `client/src/lib/trpc.ts`. Data helpers: `server/db.ts` (lazy drizzle connection) and `server/stanzaDb.ts`.
- **Runtime-neutral HTTP layer** (`server/_core/http.ts`): auth, CSRF and OAuth code take `HttpRequest` / `HttpResponse`, not framework types. `createFetchContext` (`server/_core/context.ts`) builds them from a fetch `Request`; cookies are written as `Set-Cookie` on the response headers. Do not import Express or `NextRequest` types into `server/`. The client IP for auth rate limiting is the rightmost `X-Forwarded-For` entry, so the app is expected to sit behind a proxy that sets it.
- **`server/_core/`** is platform scaffolding from the template (llm, storage, maps, sdk, notification, voice, image generation). App-specific logic belongs outside it.
- **Dual auth**: legacy Manus OAuth (`sdk.authenticateRequest`, callback logic in `handleOAuthCallback`, route at `app/api/oauth/callback`) and local email/password accounts (`server/_core/localAuth.ts`, SHA-256-hashed session tokens in `accountSessions`). `context.ts` picks one from the `stanza_auth_mode` cookie (`local` / `oauth` / `logged_out`), falling back to OAuth then local when unset.
- **CSRF**: every tRPC *mutation* must send `x-stanza-csrf` equal to the `__Host-stanza_csrf` cookie (`server/_core/trpc.ts`). `proxy.ts` issues that cookie on page requests and answers 400 for malformed `%` escapes (otherwise Next returns 500 on dynamic routes). Direct POSTs also need `Content-Type: application/json`.
- **Procedures**: `publicProcedure`, `protectedProcedure`, `adminProcedure` from `server/_core/trpc.ts`; all include the CSRF middleware.
- **Preferences**: language and theme are cookies (`stanza-language`, `stanza-theme`) so `app/layout.tsx` can render them on the server; persist changes with `persistPreference` (`client/src/lib/preferences.ts`), which also keeps localStorage in sync. Contexts take `initialLanguage` / `initialTheme` from the layout and adopt legacy localStorage values once.
- **i18n**: hand-rolled in `client/src/contexts/LanguageContext.tsx` (`id` / `en` maps keyed like `"write.draftSuccess"`; add keys to both). Server error messages are Indonesian.
- **Database**: schema in `drizzle/schema.ts` (relations in `drizzle/relations.ts`); generated SQL migrations and snapshots are checked in under `drizzle/`.
- **Path aliases**: `@/*` → `client/src/*`, `@shared/*` → `shared/*` (tsconfig and vitest). `app/` and route files import `server/` by relative path.
- **Platform notes**: `server/_core/publicConfig.ts` is the allowlist for runtime values exposed to the browser; keep private keys server-side. Managed `/manus-storage/` assets are served by the platform, so do not add another proxy.
