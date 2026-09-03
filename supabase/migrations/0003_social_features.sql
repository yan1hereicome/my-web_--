-- Adds a lightweight social layer: follow other users, post a photo to your
-- followers' feed, and like posts. Entirely additive (new tables only) —
-- doesn't touch the existing `photos` table or its RLS.
--
-- `posts` stores a denormalized snapshot (image_url/caption/location/etc.) taken
-- at post time rather than a live FK into `photos`, so a follower's feed query
-- never needs SELECT access to another user's `photos` rows.
--
-- Run this whole file in the Supabase SQL editor (Database > SQL Editor > New query).
-- Double-check the `user_id`/`id` column types below match the live `photos` /
-- `profiles` tables before running.
--
-- Note: unlike CREATE TABLE, Postgres's CREATE POLICY has no IF NOT EXISTS —
-- policies below are made re-runnable with DROP POLICY IF EXISTS + CREATE POLICY instead.

create table if not exists public.follows (
  follower_id  uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

-- Anyone can see who follows whom (needed to render follower/following counts
-- and lists on a profile you don't own) — nothing in `follows` is sensitive on its own.
drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all"
  on public.follows for select
  using (true);

drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own"
  on public.follows for delete
  using (auth.uid() = follower_id);

create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  photo_id      uuid,                 -- the source photos.id, if the photo still exists — not a FK, just a reference
  image_url     text not null,
  caption       text,
  location      text,
  capture_date  text,
  created_at    timestamptz not null default now()
);

create index if not exists posts_user_id_created_at_idx on public.posts (user_id, created_at desc);

alter table public.posts enable row level security;

-- Visible to the author and to anyone who follows them.
drop policy if exists "posts_select_own_or_followed" on public.posts;
create policy "posts_select_own_or_followed"
  on public.posts for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.follows f
      where f.follower_id = auth.uid() and f.following_id = posts.user_id
    )
  );

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
  on public.posts for delete
  using (auth.uid() = user_id);

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_likes enable row level security;

-- Readable by anyone who can already see the underlying post (so like counts
-- render correctly on posts in your feed).
drop policy if exists "post_likes_select_if_post_visible" on public.post_likes;
create policy "post_likes_select_if_post_visible"
  on public.post_likes for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_likes.post_id
        and (p.user_id = auth.uid() or exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = p.user_id
        ))
    )
  );

drop policy if exists "post_likes_insert_own" on public.post_likes;
create policy "post_likes_insert_own"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "post_likes_delete_own" on public.post_likes;
create policy "post_likes_delete_own"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- The follow-search feature needs to look up other users' display names by
-- substring match, so `profiles` needs a select policy wider than "own row only."
-- This only ADDS a permissive policy — Postgres OR's multiple permissive SELECT
-- policies together, so it can only widen access, never narrow whatever's already there.
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);
