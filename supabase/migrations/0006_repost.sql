-- Adds reposting. A repost is just a normal `posts` row owned by the reposter
-- with `repost_of` pointing at the original — it's already visible to the
-- reposter's followers via the existing "own or followed" select policy on
-- `posts`, so no new RLS policy is needed here.
--
-- `original_author_name` is denormalized (copied at repost time) so the
-- "Reposted from X" attribution survives the original post being deleted —
-- hence `on delete set null` on `repost_of` rather than cascade: a repost is a
-- snapshot (same philosophy as `posts.image_url` already being a snapshot of
-- the source photo), it shouldn't disappear just because the source did.
--
-- Run this whole file in the Supabase SQL editor (Database > SQL Editor > New query).

alter table public.posts
  add column if not exists repost_of uuid references public.posts(id) on delete set null,
  add column if not exists original_author_name text;

create index if not exists posts_repost_of_idx on public.posts (repost_of);
