-- Adds tagging people in a post (Instagram/Facebook-style: an explicit picker at
-- post time, not free-text @mention parsing — display names in `profiles` can
-- contain spaces, e.g. "Jeong min", which makes @mention parsing ambiguous
-- without a separate single-token username field this app doesn't have).
--
-- Run this whole file in the Supabase SQL editor (Database > SQL Editor > New query).

create table if not exists public.post_tags (
  post_id        uuid not null references public.posts(id) on delete cascade,
  tagged_user_id uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (post_id, tagged_user_id)
);

alter table public.post_tags enable row level security;

-- Same visibility rule as post_likes/post_comments (see 0003/0004): readable by
-- anyone who can already see the underlying post.
drop policy if exists "post_tags_select_if_post_visible" on public.post_tags;
create policy "post_tags_select_if_post_visible"
  on public.post_tags for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_tags.post_id
        and (p.user_id = auth.uid() or exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = p.user_id
        ))
    )
  );

-- Only the post's own author can tag people in it (or untag) — a plain RLS
-- policy is enough for these two, unlike creating the tag notification below.
drop policy if exists "post_tags_insert_by_post_owner" on public.post_tags;
create policy "post_tags_insert_by_post_owner"
  on public.post_tags for insert
  with check (exists (select 1 from public.posts p where p.id = post_tags.post_id and p.user_id = auth.uid()));

drop policy if exists "post_tags_delete_by_post_owner" on public.post_tags;
create policy "post_tags_delete_by_post_owner"
  on public.post_tags for delete
  using (exists (select 1 from public.posts p where p.id = post_tags.post_id and p.user_id = auth.uid()));

-- Tagging someone needs to write a notification row for THEM, not the caller —
-- `notifications` (like every other table here) only lets you insert your own
-- rows, so this has to go through a SECURITY DEFINER function, the same pattern
-- already used for join_collab_album/record_share_view. It does the tag insert
-- and the notification insert together so a client can't create one without
-- the other.
create or replace function public.tag_user_in_post(p_post_id uuid, p_tagged_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.posts where id = p_post_id and user_id = auth.uid()) then
    raise exception 'only the post owner can tag people in it';
  end if;

  insert into public.post_tags (post_id, tagged_user_id)
  values (p_post_id, p_tagged_user_id)
  on conflict (post_id, tagged_user_id) do nothing;

  insert into public.notifications (user_id, type, message, data)
  values (
    p_tagged_user_id,
    'tagged_in_post',
    'You were tagged in a post',
    jsonb_build_object('post_id', p_post_id, 'from_user_id', auth.uid())
  );
end;
$$;

grant execute on function public.tag_user_in_post(uuid, uuid) to authenticated;
