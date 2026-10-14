# Stanza — Ruang untuk Kata

Platform puisi berbahasa Indonesia: menulis, membaca, dan berbagi puisi. Next.js 16 (App Router) dengan Supabase (Auth + Postgres + RLS) untuk akun, puisi, komentar, laporan, dan kuesioner.

## Setup lokal

1. Pasang dependency: `pnpm install` (atau `corepack pnpm install` jika `pnpm` tidak ada di PATH).
2. Salin `.env.local.example` menjadi `.env.local`, lalu isi dua variabel di bawah.
3. Terapkan migration (lihat bagian berikutnya).
4. `pnpm dev`, lalu buka http://localhost:3000.

## Environment variable

| Variabel | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari Supabase (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key. Aman untuk browser; keamanan data dijaga RLS. |

Nilai `NEXT_PUBLIC_*` di-inline saat **build**, jadi set di Vercel (Project Settings → Environment Variables) sebelum deploy, lalu deploy ulang setiap kali nilainya berubah. Untuk Docker, kirim sebagai `--build-arg` (lihat `Dockerfile`).

**Jangan** pernah memakai `SUPABASE_SERVICE_ROLE_KEY` di kode klien atau memberinya awalan `NEXT_PUBLIC_`. Aplikasi ini tidak membutuhkannya.

## Migration database

Semua perubahan skema ada di `supabase/migrations/` dan dijalankan berurutan:

1. `20261014000000_init_stanza.sql`: tabel `profiles`, `poems`, `comments`, `feedback`, trigger, dan RLS.
2. `20261014010000_hardening.sql`: rate limit, tabel `reports`, dan pengerasan fungsi.

Cara menerapkan, pilih salah satu:

- **SQL Editor:** buka dashboard Supabase → SQL Editor, tempel isi tiap file berurutan, lalu Run. Jalankan sekali saja.
- **CLI:** `npx supabase login`, `npx supabase link --project-ref <ref>`, lalu `npx supabase db push`.

## Pengaturan di dashboard Supabase

- **Authentication → URL Configuration:** Site URL = domain produksi; Redirect URLs = `<domain>/auth/callback` (dan `http://localhost:3000/auth/callback` untuk dev).
- **Authentication → Emails:** pasang SMTP sendiri. Layanan email bawaan hanya mengizinkan beberapa email per jam, sehingga pendaftaran akun baru bisa gagal dengan "email rate limit exceeded".
- Tabel `feedback` dan `reports` sengaja tanpa policy baca: lihat isinya lewat Table Editor.

## Perintah

- `pnpm dev`: server pengembangan.
- `pnpm build` / `pnpm start`: build standalone ke `.next/standalone`, lalu jalankan.
- `pnpm check`: typecheck. `pnpm test`: tes.

## Catatan

Fitur profil, notifikasi, dan pengaturan akun masih memakai backend lama (tRPC + Drizzle/MySQL, perlu `DATABASE_URL`) dan belum dipindah ke Supabase. Lihat `CLAUDE.md` untuk arsitektur bagian itu.

---

Next.js (App Router) / tRPC / Drizzle app, adapted from the Sandbox web-db-user template.

- `pnpm dev`: development server (Next.js); honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build a standalone Next.js server into `.next/standalone` (static assets and `public/` are copied in by `scripts/postbuild.mjs`) and serve it. The Docker image runs the same output with `node server.js`.
- `pnpm db:migrate`: apply checked-in migrations. `pnpm db:push`: generate and apply new schema changes. Both need `DATABASE_URL`.
- `pnpm check` / `pnpm test`: types and application tests.

Start with the Webdev skill's default-template guide. Platform login, storage, payments and service contracts live in its shared references; read the relevant capability before extending its helper.

`src/server/_core/publicConfig.ts` exposes only named public runtime values (served at `/api/platform/config.js`). Private keys stay server-side. The platform serves managed `/manus-storage/` assets; the application does not register a second proxy.

Platform configuration is readable and editable through `webdev.config`. Default settings are initial values, not enforced constraints. The agent may modify the files, commands and configuration or follow the flexible guide for another stack.
