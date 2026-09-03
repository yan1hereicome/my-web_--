-- Adds comments on feed posts (public.posts, see 0003_social_features.sql).
-- Additive only — new table, no changes to existing tables/policies.
--
-- Run this whole file in the Supabase SQL editor (Database > SQL Editor > New query).
-- Postgres's CREATE POLICY has no IF NOT EXISTS, so policies use
-- DROP POLICY IF EXISTS + CREATE POLICY to stay re-runnable (see 0003's note).

create table if not exists public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_id_created_at_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

-- Readable by anyone who can already see the underlying post (same visibility
-- rule as post_likes — see 0003_social_features.sql).
drop policy if exists "post_comments_select_if_post_visible" on public.post_comments;
create policy "post_comments_select_if_post_visible"
  on public.post_comments for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and (p.user_id = auth.uid() or exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = p.user_id
        ))
    )
  );

drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own"
  on public.post_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own"
  on public.post_comments for delete
  using (auth.uid() = user_id);
