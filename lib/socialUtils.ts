// Follow/feed/like layer on top of the new follows/posts/post_likes tables
// (see supabase/migrations/0003_social_features.sql). Posts are a denormalized
// snapshot of a photo taken at post time, so a feed read never needs cross-user
// access to the `photos` table.
import { supabase } from "./supabase";

export type Profile = { id: string; name: string; created_at: string; avatar_url?: string | null };

export type Post = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  imageUrl: string;
  caption: string | null;
  location: string | null;
  captureDate: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  // Set when this post is a repost — the original's id and (denormalized, so it
  // survives the original being deleted or its author renaming) author name.
  repostOf: { id: string; authorName: string } | null;
  taggedUsers: TaggedUser[];
};

export type TaggedUser = { id: string; name: string; avatarUrl: string | null };

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
  // null for a top-level comment; the parent comment's id for a reply. Replies
  // are one level deep only — a reply can't itself be replied to.
  parentCommentId: string | null;
  likeCount: number;
  likedByMe: boolean;
};

export async function searchProfiles(query: string, excludeUid: string): Promise<Profile[]> {
  // Strip a leading "@" — Instagram-style tagging habits mean people type "@name",
  // but `profiles.name` is never stored with one, so an un-stripped query never matches.
  const q = query.trim().replace(/^@/, "");
  if (!q) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("name", `%${q}%`)
    .neq("id", excludeUid)
    .limit(20);
  if (error) {
    console.error("searchProfiles failed:", error);
    return [];
  }
  return (data ?? []) as Profile[];
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Profile;
}

export async function isFollowing(uid: string, targetId: string): Promise<boolean> {
  const { data } = await supabase.from("follows").select("follower_id").eq("follower_id", uid).eq("following_id", targetId).maybeSingle();
  return !!data;
}

export async function getFollowCounts(uid: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", uid),
    supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", uid),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function getFollowingIds(uid: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", uid);
  if (error) {
    console.error("getFollowingIds failed:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.following_id as string));
}

export async function profilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", ids);
  if (error) {
    console.error("profilesByIds failed:", error);
    return [];
  }
  return (data ?? []) as Profile[];
}

export async function fetchFollowingProfiles(uid: string): Promise<Profile[]> {
  const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", uid);
  if (error) {
    console.error("fetchFollowingProfiles failed:", error);
    return [];
  }
  return profilesByIds((data ?? []).map((r) => r.following_id as string));
}

export async function fetchFollowerProfiles(uid: string): Promise<Profile[]> {
  const { data, error } = await supabase.from("follows").select("follower_id").eq("following_id", uid);
  if (error) {
    console.error("fetchFollowerProfiles failed:", error);
    return [];
  }
  return profilesByIds((data ?? []).map((r) => r.follower_id as string));
}

export async function followUser(uid: string, targetId: string): Promise<void> {
  const { error } = await supabase.from("follows").insert({ follower_id: uid, following_id: targetId });
  if (error) throw new Error(error.message);
}

export async function unfollowUser(uid: string, targetId: string): Promise<void> {
  const { error } = await supabase.from("follows").delete().eq("follower_id", uid).eq("following_id", targetId);
  if (error) throw new Error(error.message);
}

// Returns the new post's id, so callers can attach tags (tagUserInPost) right after.
export async function createPost(
  uid: string,
  input: { photoId?: string; imageUrl: string; caption?: string; location?: string; captureDate?: string },
): Promise<string> {
  const { data, error } = await supabase.from("posts").insert({
    user_id: uid,
    photo_id: input.photoId ?? null,
    image_url: input.imageUrl,
    caption: input.caption?.trim() || null,
    location: input.location ?? null,
    capture_date: input.captureDate ?? null,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deletePost(uid: string, postId: string): Promise<void> {
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", uid);
  if (error) throw new Error(error.message);
}

// Reposts a post into the current user's own feed — a normal `posts` row owned by
// `uid` with `repost_of` set, so it's visible to `uid`'s followers via the exact
// same "own or followed" RLS policy as any other post (no new policy needed).
// image_url/location/capture_date are copied from the original, consistent with
// how a regular post already snapshots its source photo rather than joining it live.
export async function createRepost(uid: string, original: Post): Promise<void> {
  const { error } = await supabase.from("posts").insert({
    user_id: uid,
    photo_id: null,
    image_url: original.imageUrl,
    caption: original.caption,
    location: original.location,
    capture_date: original.captureDate,
    repost_of: original.repostOf?.id ?? original.id,
    original_author_name: original.repostOf?.authorName ?? original.authorName,
  });
  if (error) throw new Error(error.message);
}

// Ensures a `profiles` row exists for this user (mirrors the lazy-create in
// app/profile/page.tsx) — posts don't FK into profiles (a user can post before
// ever visiting /profile), so feed rendering falls back to "Traveler" for
// whichever authors don't have one yet rather than failing.
export async function ensureProfile(uid: string, fallbackName: string): Promise<void> {
  const { data } = await supabase.from("profiles").select("id").eq("id", uid).maybeSingle();
  if (!data) {
    await supabase.from("profiles").upsert({ id: uid, name: fallbackName }, { onConflict: "id" });
  }
}

// Own posts + posts from everyone the current user follows, newest first, with
// like counts and "did I like this" resolved via follow-up queries (avoids an
// N+1 query per post). No FK-based embed — posts.user_id has no FK to profiles
// (a user can post before a profiles row exists for them), so author names are
// joined in client-side with a "Traveler" fallback.
export async function fetchFeed(uid: string): Promise<Post[]> {
  const { data: postRows, error } = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("fetchFeed failed:", error);
    return [];
  }
  return enrichPosts(uid, postRows ?? []);
}

// One person's posts, newest first — same enrichment as fetchFeed, just scoped
// to a single author. RLS ("own or followed") applies exactly as it does for
// the main feed, so this naturally comes back empty for someone you don't
// follow rather than needing a separate permission check here.
export async function fetchUserPosts(uid: string, authorId: string): Promise<Post[]> {
  const { data: postRows, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", authorId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("fetchUserPosts failed:", error);
    return [];
  }
  return enrichPosts(uid, postRows ?? []);
}

// Single post lookup, used by the post detail page (/post/[id]) reached from
// notifications ("who liked/commented on your post") and from a profile's post
// grid. Same enrichment as fetchFeed/fetchUserPosts, so like/comment counts and
// tagged users come back consistent with the feed. RLS naturally returns no row
// (rather than an error) if the current user can't see this post (not the
// author and not following them), which the page treats as "not found".
export async function fetchPostById(uid: string, postId: string): Promise<Post | null> {
  const { data: row, error } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
  if (error || !row) return null;
  const posts = await enrichPosts(uid, [row]);
  return posts[0] ?? null;
}

async function enrichPosts(uid: string, rows: Record<string, unknown>[]): Promise<Post[]> {
  if (rows.length === 0) return [];

  const postIds = rows.map((r) => r.id as string);
  const authorIds = [...new Set(rows.map((r) => r.user_id as string))];
  const [{ data: likeRows }, { data: commentRows }, { data: tagRows }, { data: profileRows }] = await Promise.all([
    supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
    supabase.from("post_comments").select("post_id").in("post_id", postIds),
    supabase.from("post_tags").select("post_id, tagged_user_id").in("post_id", postIds),
    supabase.from("profiles").select("id, name, avatar_url").in("id", authorIds),
  ]);

  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const like of likeRows ?? []) {
    const pid = like.post_id as string;
    likeCounts.set(pid, (likeCounts.get(pid) ?? 0) + 1);
    if (like.user_id === uid) likedByMe.add(pid);
  }
  const commentCounts = new Map<string, number>();
  for (const c of commentRows ?? []) {
    const pid = c.post_id as string;
    commentCounts.set(pid, (commentCounts.get(pid) ?? 0) + 1);
  }
  const tagsByPost = new Map<string, string[]>();
  for (const t of tagRows ?? []) {
    const pid = t.post_id as string;
    if (!tagsByPost.has(pid)) tagsByPost.set(pid, []);
    tagsByPost.get(pid)!.push(t.tagged_user_id as string);
  }
  // A second profiles lookup for tagged users — they're frequently not post authors,
  // so the authorIds set above won't already cover them.
  const taggedUserIds = [...new Set((tagRows ?? []).map((t) => t.tagged_user_id as string))];
  const { data: taggedProfileRows } = taggedUserIds.length > 0
    ? await supabase.from("profiles").select("id, name, avatar_url").in("id", taggedUserIds)
    : { data: [] as { id: string; name: string; avatar_url: string | null }[] };
  const profilesByAuthor = new Map((profileRows ?? []).map((p) => [p.id as string, p]));
  const profilesByTagged = new Map((taggedProfileRows ?? []).map((p) => [p.id as string, p]));

  return rows.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    authorName: profilesByAuthor.get(r.user_id as string)?.name || "Traveler",
    authorAvatarUrl: (profilesByAuthor.get(r.user_id as string)?.avatar_url as string) ?? null,
    imageUrl: r.image_url as string,
    caption: (r.caption as string) ?? null,
    location: (r.location as string) ?? null,
    captureDate: (r.capture_date as string) ?? null,
    createdAt: r.created_at as string,
    likeCount: likeCounts.get(r.id as string) ?? 0,
    likedByMe: likedByMe.has(r.id as string),
    commentCount: commentCounts.get(r.id as string) ?? 0,
    repostOf: r.repost_of ? { id: r.repost_of as string, authorName: (r.original_author_name as string) || "Traveler" } : null,
    taggedUsers: (tagsByPost.get(r.id as string) ?? []).map((tid) => ({
      id: tid,
      name: profilesByTagged.get(tid)?.name || "Traveler",
      avatarUrl: (profilesByTagged.get(tid)?.avatar_url as string) ?? null,
    })),
  }));
}

// Returns the post's new liked state (true = now liked).
export async function toggleLike(uid: string, postId: string, currentlyLiked: boolean): Promise<boolean> {
  if (currentlyLiked) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", uid);
    return false;
  }
  await supabase.from("post_likes").insert({ post_id: postId, user_id: uid });
  return true;
}

// Comments are loaded per-post on demand (not batched into fetchFeed), so
// author names are joined in with a small follow-up query scoped to just this
// post's commenters, same "Traveler" fallback pattern as fetchFeed. `uid` is
// needed (unlike before comment likes existed) to resolve "did I like this".
export async function fetchComments(uid: string, postId: string): Promise<Comment[]> {
  const { data: rows, error } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("fetchComments failed:", error);
    return [];
  }
  const commentRows = rows ?? [];
  if (commentRows.length === 0) return [];

  const commentIds = commentRows.map((r) => r.id as string);
  const authorIds = [...new Set(commentRows.map((r) => r.user_id as string))];
  const [{ data: profileRows }, { data: likeRows }] = await Promise.all([
    supabase.from("profiles").select("id, name, avatar_url").in("id", authorIds),
    supabase.from("comment_likes").select("comment_id, user_id").in("comment_id", commentIds),
  ]);
  const profilesByAuthor = new Map((profileRows ?? []).map((p) => [p.id as string, p]));
  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const like of likeRows ?? []) {
    const cid = like.comment_id as string;
    likeCounts.set(cid, (likeCounts.get(cid) ?? 0) + 1);
    if (like.user_id === uid) likedByMe.add(cid);
  }

  return commentRows.map((r) => ({
    id: r.id as string,
    postId: r.post_id as string,
    userId: r.user_id as string,
    authorName: profilesByAuthor.get(r.user_id as string)?.name || "Traveler",
    authorAvatarUrl: (profilesByAuthor.get(r.user_id as string)?.avatar_url as string) ?? null,
    content: r.content as string,
    createdAt: r.created_at as string,
    parentCommentId: (r.parent_comment_id as string) ?? null,
    likeCount: likeCounts.get(r.id as string) ?? 0,
    likedByMe: likedByMe.has(r.id as string),
  }));
}

export async function addComment(uid: string, postId: string, content: string, parentCommentId?: string): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;
  const { error } = await supabase.from("post_comments").insert({
    post_id: postId, user_id: uid, content: trimmed, parent_comment_id: parentCommentId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteComment(uid: string, commentId: string): Promise<void> {
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId).eq("user_id", uid);
  if (error) throw new Error(error.message);
}

// Returns the comment's new liked state (true = now liked) — same pattern as toggleLike.
export async function toggleCommentLike(uid: string, commentId: string, currentlyLiked: boolean): Promise<boolean> {
  if (currentlyLiked) {
    await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", uid);
    return false;
  }
  await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: uid });
  return true;
}

// Tagging writes a notification for the TAGGED user, not the caller — `notifications`
// (like every other table here) only allows inserting your own rows, so this has to
// go through the tag_user_in_post RPC (SECURITY DEFINER), same pattern as
// join_collab_album/record_share_view. It also validates the caller owns the post.
export async function tagUserInPost(postId: string, taggedUserId: string): Promise<void> {
  const { error } = await supabase.rpc("tag_user_in_post", { p_post_id: postId, p_tagged_user_id: taggedUserId });
  if (error) throw new Error(error.message);
}

// Untagging is just a delete of your own post's row — the post_tags RLS delete
// policy (post owner only) already covers this, no RPC needed.
export async function untagUserInPost(postId: string, taggedUserId: string): Promise<void> {
  const { error } = await supabase.from("post_tags").delete().eq("post_id", postId).eq("tagged_user_id", taggedUserId);
  if (error) throw new Error(error.message);
}
