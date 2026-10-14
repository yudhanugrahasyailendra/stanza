# Stanza — Implementation Plan (Supabase)

Stanza adalah platform puisi berbahasa Indonesia ("ruang untuk menulis, membaca, dan berbagi puisi") yang sudah live di https://stanza-kappa.vercel.app/ (frontend di Vercel). Tujuan plan ini: menambahkan backend Supabase agar pengguna bisa mendaftar, menulis puisi, membaca puisi orang lain, berkomentar, dan mengisi kuesioner, secara online.

## Aturan kerja untuk Claude Code

1. **Baca repo dulu sebelum mengubah apa pun.** Cek framework dan versinya, struktur folder (`app/` atau `pages/`), file halaman `/login`, `/write`, `/explore`, `/feedback`, library UI, dan cara data ditampilkan sekarang (data statis, mock, atau state lokal). Sesuaikan plan ini dengan kenyataan di repo, dan laporkan perbedaannya.
2. Plan ini mengasumsikan **Next.js (App Router) + TypeScript**. Jika ternyata berbeda, adaptasi caranya tetapi pertahankan skema database dan aturan keamanannya.
3. Kerjakan **per fase**, satu commit per fase, dan jalankan build/lint/typecheck di akhir tiap fase. Berhenti dan minta konfirmasi sebelum lanjut ke fase berikutnya.
4. **Jangan pernah** meng-commit secret. `SUPABASE_SERVICE_ROLE_KEY` tidak boleh dipakai di kode client dan tidak boleh diawali `NEXT_PUBLIC_`.
5. Pertahankan tampilan dan teks Bahasa Indonesia yang sudah ada. Ubah UI seminimal mungkin; fokus pada menyambungkan data.
6. Semua perubahan skema lewat file migration di `supabase/migrations/`, bukan lewat klik manual di dashboard.
7. Setiap tabel di schema `public` wajib RLS aktif sebelum fase selesai.

## Hal yang butuh tindakan manual dari saya (pemilik proyek)

Claude Code tidak bisa melakukan ini; minta saya dan berhenti sampai selesai:

- Membuat project Supabase di https://supabase.com dan memberikan `Project URL` serta `anon/publishable key`.
- Mengisi environment variable di Vercel (Project Settings → Environment Variables).
- Mengaktifkan provider login (misalnya Google) dan mengatur Site URL / Redirect URLs di Supabase Auth.
- Menjalankan `supabase login` dan `supabase link` di terminal saya bila perlu.

## Fase 0 — Persiapan

- [ ] Audit repo dan tulis ringkasan temuan (framework, routing, state saat ini, komponen yang akan disentuh).
- [ ] Install dependency: `@supabase/supabase-js` dan `@supabase/ssr`.
- [ ] Install Supabase CLI sebagai dev dependency atau gunakan `npx supabase`, lalu `supabase init`.
- [ ] Buat `.env.local.example` berisi:
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  ```
  Pastikan `.env.local` ada di `.gitignore`.
- [ ] Buat helper client di `lib/supabase/`:
  - `client.ts` → `createBrowserClient` untuk Client Components
  - `server.ts` → `createServerClient` dengan cookies untuk Server Components, Route Handlers, dan Server Actions
  - `middleware.ts` (helper) → me-refresh sesi auth
- [ ] Buat `middleware.ts` di root yang memanggil helper refresh sesi.

**Selesai jika:** build lulus dan helper client sudah ada, tanpa mengubah perilaku halaman.

## Fase 1 — Skema database dan RLS

Buat migration `supabase/migrations/<timestamp>_init_stanza.sql` dengan isi berikut, lalu terapkan (`supabase db push`, atau minta saya menjalankannya di SQL Editor).

```sql
-- ============ TABEL ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  pen_name text not null check (char_length(pen_name) between 1 and 40),
  bio text check (char_length(bio) <= 300),
  created_at timestamptz not null default now()
);

create table public.poems (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 10000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index poems_published_idx on public.poems (published_at desc) where status = 'published';
create index poems_author_idx on public.poems (author_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  poem_id uuid not null references public.poems(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index comments_poem_idx on public.comments (poem_id, created_at);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

-- ============ TRIGGER ============
-- Buat profil otomatis saat user mendaftar
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, pen_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'pen_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Jaga updated_at dan published_at
create function public.poems_set_timestamps() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger poems_timestamps
  before insert or update on public.poems
  for each row execute function public.poems_set_timestamps();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.poems enable row level security;
alter table public.comments enable row level security;
alter table public.feedback enable row level security;

-- profiles: publik dibaca, hanya pemilik yang mengubah
create policy "profiles_select_all" on public.profiles
  for select using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- poems: puisi terbit terlihat semua orang, draft hanya penulisnya
create policy "poems_select_published_or_own" on public.poems
  for select using (status = 'published' or (select auth.uid()) = author_id);
create policy "poems_insert_own" on public.poems
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "poems_update_own" on public.poems
  for update to authenticated
  using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
create policy "poems_delete_own" on public.poems
  for delete to authenticated using ((select auth.uid()) = author_id);

-- comments: terlihat jika puisinya terlihat; hanya user login yang menulis
create policy "comments_select_visible_poem" on public.comments
  for select using (
    exists (
      select 1 from public.poems p
      where p.id = poem_id
        and (p.status = 'published' or p.author_id = (select auth.uid()))
    )
  );
create policy "comments_insert_own_on_published" on public.comments
  for insert to authenticated with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.poems p where p.id = poem_id and p.status = 'published')
  );
create policy "comments_delete_own_or_poem_author" on public.comments
  for delete to authenticated using (
    (select auth.uid()) = author_id
    or exists (select 1 from public.poems p where p.id = poem_id and p.author_id = (select auth.uid()))
  );

-- feedback: siapa pun boleh mengirim, tidak ada yang boleh membaca lewat API
create policy "feedback_insert_anyone" on public.feedback
  for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
```

Catatan: tabel `feedback` sengaja tanpa policy `select`. Hasilnya dibaca lewat dashboard Supabase atau service role di sisi server, bukan dari browser.

**Selesai jika:** migration berhasil diterapkan, keempat tabel muncul dengan RLS aktif, dan percobaan `insert` ke `poems` dengan `author_id` milik orang lain ditolak.

## Fase 2 — Autentikasi (`/login`)

- [ ] Hubungkan form di `/login` ke Supabase Auth. Mulai dengan email + password (daftar dan masuk); tambahkan Google login hanya jika saya sudah mengaktifkannya.
- [ ] Saat daftar, kirim `pen_name` lewat `options.data` agar trigger membuat profil dengan nama pena yang benar.
- [ ] Buat route callback `app/auth/callback/route.ts` untuk menukar `code` menjadi sesi (diperlukan untuk magic link / OAuth).
- [ ] Buat aksi keluar (sign out).
- [ ] Header: tombol "Masuk" berubah menjadi nama pena/menu akun saat user login.
- [ ] Di sisi server, gunakan `supabase.auth.getUser()` untuk memeriksa user, bukan `getSession()`.
- [ ] Lindungi `/write`: user yang belum login diarahkan ke `/login` (lewat middleware atau pengecekan di halaman).

**Selesai jika:** saya bisa daftar, masuk, keluar, dan `/write` menolak pengunjung yang belum login.

## Fase 3 — Menulis puisi (`/write`)

- [ ] Hubungkan form menulis ke tabel `poems` lewat Server Action atau Route Handler. `author_id` selalu diambil dari user yang login di server, jangan dari input form.
- [ ] Dua aksi: **simpan draft** (`status = 'draft'`) dan **terbitkan** (`status = 'published'`).
- [ ] Validasi di server (panjang judul dan isi sesuai batas di skema); tampilkan pesan error berbahasa Indonesia.
- [ ] Setelah terbit, arahkan ke halaman puisi tersebut.
- [ ] Halaman "Puisi saya" (atau bagian di profil) untuk melihat, mengedit, dan menghapus draft maupun puisi sendiri. Ikuti struktur rute yang sudah ada di repo.

**Selesai jika:** puisi yang diterbitkan tersimpan di Supabase, draft tidak terlihat orang lain, dan penulis bisa mengedit atau menghapus miliknya sendiri.

## Fase 4 — Menjelajah dan membaca (`/explore` + halaman puisi)

- [ ] `/explore`: ambil puisi `published` terbaru dengan join ke `profiles` untuk nama pena, urut `published_at desc`, dengan pagination (misalnya 12 per halaman).
- [ ] Halaman detail puisi (rute dinamis, ikuti konvensi repo): tampilkan judul, isi (pertahankan baris baru dan spasi), nama pena, dan tanggal terbit.
- [ ] Beranda: ganti keadaan "Belum ada puisi" dengan puisi terbaru; pertahankan tampilan kosong yang sekarang bila belum ada data.
- [ ] Render sebagai Server Component agar cepat dan ramah SEO; atur `revalidate` yang wajar atau gunakan dynamic rendering.
- [ ] Teks puisi harus ditampilkan sebagai teks biasa (React sudah meng-escape), jangan memakai `dangerouslySetInnerHTML`.

**Selesai jika:** puisi dari satu akun terlihat oleh pengunjung anonim di `/explore` dan di halaman detailnya.

## Fase 5 — Komentar

- [ ] Di halaman puisi, tampilkan daftar komentar (urut lama → baru) beserta nama pena penulisnya.
- [ ] Form komentar hanya untuk user yang login; pengunjung anonim melihat ajakan masuk.
- [ ] Simpan komentar lewat Server Action (`author_id` dari user server), lalu refresh daftar tanpa reload penuh.
- [ ] Pemilik komentar dan penulis puisi bisa menghapus komentar.

**Selesai jika:** komentar muncul untuk semua pembaca, hanya user login yang bisa menulis, dan penghapusan sesuai aturan.

## Fase 6 — Kuesioner (`/feedback`)

- [ ] Simpan jawaban form ke tabel `feedback` (kolom `answers` berupa JSON; sertakan `user_id` jika login).
- [ ] Tampilkan pesan terima kasih setelah terkirim dan cegah kirim ganda yang tidak sengaja.

**Selesai jika:** jawaban masuk ke tabel `feedback` dan tidak bisa dibaca lewat API publik.

## Fase 7 — Pengamanan sebelum dibuka untuk umum

- [ ] **Rate limit komentar dan puisi** di level database, misalnya trigger yang menolak lebih dari 5 komentar per menit per user dan 10 puisi per jam per user. Pesan error harus jelas.
- [ ] **Laporkan konten:** tabel `reports` (id, reporter_id, target_type, target_id, reason, created_at) dengan RLS insert untuk user login; tombol "Laporkan" pada puisi dan komentar. Pembacaan laporan hanya lewat dashboard.
- [ ] Atur Redirect URLs dan Site URL produksi di Supabase Auth (domain Vercel dan, jika ada, domain kustom).
- [ ] Aktifkan konfirmasi email bila ingin mencegah akun palsu, dan sesuaikan alur UI-nya.
- [ ] Verifikasi bahwa `SUPABASE_SERVICE_ROLE_KEY` tidak muncul di bundle client (cari di build output).
- [ ] Aktifkan backup database (sesuai paket Supabase) atau jadwalkan ekspor berkala.
- [ ] Jalankan Supabase advisor (Security & Performance) di dashboard dan perbaiki temuan penting.

## Fase 8 — Deploy dan uji akhir

- [ ] Pastikan env var produksi sudah ada di Vercel, lalu deploy ulang.
- [ ] Uji alur ujung ke ujung di produksi dengan dua akun berbeda (A dan B):
  1. A daftar, masuk, menulis draft → B dan pengunjung anonim tidak melihatnya.
  2. A menerbitkan → muncul di `/explore` untuk semua.
  3. B berkomentar → komentar tampil; pengunjung anonim tidak bisa berkomentar.
  4. B mencoba mengedit atau menghapus puisi A → ditolak.
  5. A menghapus puisi → komentar ikut terhapus (cascade).
  6. Pengunjung anonim mengisi `/feedback` → tersimpan.
- [ ] Jalankan lint, typecheck, dan build; perbaiki semua error.
- [ ] Tulis `README` singkat: cara setup lokal, daftar env var, cara menjalankan migration.

## Di luar cakupan (jangan dikerjakan sekarang)

Like/bookmark, pencarian teks lengkap, notifikasi, foto profil (Supabase Storage), tema atau tag puisi, dan aplikasi mobile. Catat sebagai ide lanjutan saja.

## Cara melapor di akhir tiap fase

Tulis: apa yang berubah (file utama), perintah yang dijalankan, hasil uji, hal yang butuh tindakan manual dari saya, dan fase berikutnya. Jangan lanjut ke fase berikutnya sebelum saya konfirmasi.
