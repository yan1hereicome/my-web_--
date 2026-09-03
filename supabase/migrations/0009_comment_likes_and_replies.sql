-- Adds liking a comment and replying to a comment (one level deep — a reply
-- itself can't be replied to, same "flat thread" model Instagram/Facebook use
-- for comment replies). Additive only — new table + one new nullable column.
--
-- Run this whole file in the Supabase SQL editor (Database > SQL Editor > New query).

alter table public.post_comments
  add column if not exists parent_comment_id uuid references public.post_comments(id) on delete cascade;

create table if not exists public.comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.comment_likes enable row level security;

-- Same visibility rule as post_comments/post_likes (see 0003/0004) — readable by
-- anyone who can already see the underlying post.
drop policy if exists "comment_likes_select_if_comment_visible" on public.comment_likes;
create policy "comment_likes_select_if_comment_visible"
  on public.comment_likes for select
  using (
    exists (
      select 1 from public.post_comments c
      join public.posts p on p.id = c.post_id
      where c.id = comment_likes.comment_id
        and (p.user_id = auth.uid() or exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = p.user_id
        ))
    )
  );

drop policy if exists "comment_likes_insert_own" on public.comment_likes;
create policy "comment_likes_insert_own"
  on public.comment_likes for insert
  with check (user_id = auth.uid());

drop policy if exists "comment_likes_delete_own" on public.comment_likes;
create policy "comment_likes_delete_own"
  on public.comment_likes for delete
  using (user_id = auth.uid());

-- Notifies the comment's author when someone likes it (skip self-likes) — same
-- SECURITY DEFINER trigger pattern as notify_post_like/notify_post_comment in
-- 0008_engagement_notifications.sql, since `notifications` RLS only allows
-- inserting your own rows and this needs to insert one for the comment author.
create or replace function public.notify_comment_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment_owner uuid;
  v_post_id uuid;
begin
  select user_id, post_id into v_comment_owner, v_post_id from public.post_comments where id = new.comment_id;

  if v_comment_owner is not null and v_comment_owner <> new.user_id then
    insert into public.notifications (user_id, type, message, data)
    values (
      v_comment_owner,
      'comment_liked',
      'Someone liked your comment',
      jsonb_build_object('post_id', v_post_id, 'comment_id', new.comment_id, 'from_user_id', new.user_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_like_notify on public.comment_likes;
create trigger on_comment_like_notify
  after insert on public.comment_likes
  for each row execute function public.notify_comment_like();

-- Notifies the PARENT comment's author when someone replies to it (skip
-- self-replies). This is separate from notify_post_comment (still fires for
-- every comment, replies included, so the post author always hears about
-- activity on their post) — a reply additionally tells the person being
-- replied to, if that's a different person.
create or replace function public.notify_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_owner uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select user_id into v_parent_owner from public.post_comments where id = new.parent_comment_id;

  if v_parent_owner is not null and v_parent_owner <> new.user_id then
    insert into public.notifications (user_id, type, message, data)
    values (
      v_parent_owner,
      'comment_replied',
      'Someone replied to your comment',
      jsonb_build_object('post_id', new.post_id, 'comment_id', new.id, 'from_user_id', new.user_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_reply_notify on public.post_comments;
create trigger on_comment_reply_notify
  after insert on public.post_comments
  for each row execute function public.notify_comment_reply();
