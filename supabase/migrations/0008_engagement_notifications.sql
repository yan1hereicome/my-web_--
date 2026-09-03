-- Notifies a post's author when someone likes or comments on it (tagging
-- already notifies via tag_user_in_post — see 0007_post_tags.sql). Uses AFTER
-- INSERT triggers rather than client-side RPCs: a like/comment can be inserted
-- directly from lib/socialUtils.ts (toggleLike/addComment), and a trigger
-- guarantees the notification happens no matter which code path does the
-- insert, without every call site needing to remember to also notify.
--
-- Trigger functions run as SECURITY DEFINER (like tag_user_in_post) because
-- `notifications` RLS only allows inserting your own rows — the trigger needs
-- to insert one for the POST AUTHOR, not the person doing the liking/commenting.
--
-- Run this whole file in the Supabase SQL editor (Database > SQL Editor > New query).

create or replace function public.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner from public.posts where id = new.post_id;

  if v_post_owner is not null and v_post_owner <> new.user_id then
    insert into public.notifications (user_id, type, message, data)
    values (
      v_post_owner,
      'post_liked',
      'Someone liked your post',
      jsonb_build_object('post_id', new.post_id, 'from_user_id', new.user_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_post_like_notify on public.post_likes;
create trigger on_post_like_notify
  after insert on public.post_likes
  for each row execute function public.notify_post_like();

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner from public.posts where id = new.post_id;

  if v_post_owner is not null and v_post_owner <> new.user_id then
    insert into public.notifications (user_id, type, message, data)
    values (
      v_post_owner,
      'post_commented',
      'Someone commented on your post',
      jsonb_build_object('post_id', new.post_id, 'from_user_id', new.user_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_post_comment_notify on public.post_comments;
create trigger on_post_comment_notify
  after insert on public.post_comments
  for each row execute function public.notify_post_comment();
