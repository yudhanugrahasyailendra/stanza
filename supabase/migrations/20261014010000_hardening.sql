-- Fase 7: rate limit, laporan konten, dan pengerasan keamanan.

-- ============ RATE LIMIT ============
-- SQLSTATE 'RL001' dipakai agar aplikasi bisa membedakan penolakan rate limit dari galat lain.
-- security definer supaya hitungan tidak terpengaruh RLS; EXECUTE dicabut di bawah.
create function public.enforce_comment_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (
    select count(*) from public.comments
    where author_id = new.author_id and created_at > now() - interval '1 minute'
  ) >= 5 then
    raise exception 'Terlalu banyak komentar. Tunggu sebentar sebelum berkomentar lagi (maksimal 5 per menit).'
      using errcode = 'RL001';
  end if;
  return new;
end;
$$;

create trigger comments_rate_limit
  before insert on public.comments
  for each row execute function public.enforce_comment_rate_limit();

create function public.enforce_poem_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (
    select count(*) from public.poems
    where author_id = new.author_id and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Terlalu banyak puisi baru. Coba lagi nanti (maksimal 10 per jam).'
      using errcode = 'RL001';
  end if;
  return new;
end;
$$;

create trigger poems_rate_limit
  before insert on public.poems
  for each row execute function public.enforce_poem_rate_limit();

-- ============ LAPORAN KONTEN ============
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('poem', 'comment')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  -- satu laporan per pelapor per target
  unique (reporter_id, target_type, target_id)
);

alter table public.reports enable row level security;

-- Hanya insert oleh user login atas nama dirinya. Sengaja tanpa policy select/update/delete:
-- laporan dibaca lewat dashboard Supabase.
create policy "reports_insert_own" on public.reports
  for insert to authenticated with check ((select auth.uid()) = reporter_id);

create function public.enforce_report_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (
    select count(*) from public.reports
    where reporter_id = new.reporter_id and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Terlalu banyak laporan. Coba lagi nanti (maksimal 10 per jam).'
      using errcode = 'RL001';
  end if;
  return new;
end;
$$;

create trigger reports_rate_limit
  before insert on public.reports
  for each row execute function public.enforce_report_rate_limit();

-- ============ PENGERASAN ============
-- Fungsi trigger tidak boleh bisa dipanggil sebagai RPC oleh anon/authenticated.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.poems_set_timestamps() from public, anon, authenticated;
revoke execute on function public.enforce_comment_rate_limit() from public, anon, authenticated;
revoke execute on function public.enforce_poem_rate_limit() from public, anon, authenticated;
revoke execute on function public.enforce_report_rate_limit() from public, anon, authenticated;

-- Index untuk foreign key dan hitungan rate limit (saran advisor performa).
create index comments_author_created_idx on public.comments (author_id, created_at desc);
create index feedback_user_idx on public.feedback (user_id);
