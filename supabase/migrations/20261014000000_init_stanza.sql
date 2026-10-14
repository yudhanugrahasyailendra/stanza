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
