# Stanza — Ruang untuk Kata

Next.js (App Router) / tRPC / Drizzle app, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server (Next.js); honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build a standalone Next.js server into `.next/standalone` (static assets and `public/` are copied in by `scripts/postbuild.mjs`) and serve it. The Docker image runs the same output with `node server.js`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes. Both need `DATABASE_URL`.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`server/_core/publicConfig.ts` exposes only named public runtime values (served at `/api/platform/config.js`). Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.
