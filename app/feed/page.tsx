"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { fetchMapPhotos } from "@/lib/photosApi";
import { MapPhoto } from "@/lib/types";
import { sharePhoto } from "@/lib/shareUtils";
import CommentThread from "@/components/CommentThread";
import {
  ensureProfile, searchProfiles, getFollowCounts, getFollowingIds,
  followUser, unfollowUser, createPost, deletePost, fetchFeed, toggleLike, createRepost,
  tagUserInPost,
  fetchFollowingProfiles, fetchFollowerProfiles,
  Profile, Post,
} from "@/lib/socialUtils";
import {
  Sparkles, Search, X, Heart, Plus, Loader2, MapPin, CalendarDays, Trash2, Users, UserPlus, UserCheck,
  MessageCircle, Repeat2, Share2, Check,
} from "lucide-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function NewPostModal({
  uid, photos, onClose, onPosted,
}: {
  uid: string; photos: MapPhoto[]; onClose: () => void;
  onPosted: (photoId: string, imageUrl: string, caption: string, taggedIds: string[], location?: string, captureDate?: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<MapPhoto | null>(null);
  const [caption,  setCaption]  = useState("");
  const [posting,  setPosting]  = useState(false);

  const [tagQuery,   setTagQuery]   = useState("");
  const [tagResults, setTagResults] = useState<Profile[]>([]);
  const [tagged,     setTagged]     = useState<Profile[]>([]);

  async function handleTagSearch(q: string) {
    setTagQuery(q);
    if (!q.trim()) { setTagResults([]); return; }
    setTagResults((await searchProfiles(q, uid)).filter((p) => !tagged.some((t) => t.id === p.id)));
  }

  function addTag(p: Profile) {
    setTagged((prev) => [...prev, p]);
    setTagResults((prev) => prev.filter((r) => r.id !== p.id));
    setTagQuery("");
  }

  function removeTag(id: string) {
    setTagged((prev) => prev.filter((t) => t.id !== id));
  }

  async function handlePost() {
    if (!selected) return;
    setPosting(true);
    await onPosted(selected.id, selected.imageUrl, caption, tagged.map((t) => t.id), selected.location, selected.captureDate);
    setPosting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-lg w-full shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-slate-900">New Post</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
        </div>

        {!selected ? (
          <div className="overflow-y-auto grid grid-cols-3 gap-2">
            {photos.length === 0 && (
              <p className="col-span-3 text-sm text-slate-400 text-center py-8">No photos yet — upload some from the home screen first.</p>
            )}
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.imageUrl} alt={p.fileName} onClick={() => setSelected(p)}
                className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.imageUrl} alt={selected.fileName} className="w-full max-h-64 object-contain bg-slate-100 rounded-xl" />
            <textarea
              value={caption} onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
            />

            {/* Tag people */}
            <div>
              {tagged.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tagged.map((t) => (
                    <span key={t.id} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
                      {t.name || "Traveler"}
                      <button onClick={() => removeTag(t.id)} className="hover:text-blue-900"><X size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
              <input
                value={tagQuery}
                onChange={(e) => handleTagSearch(e.target.value)}
                placeholder="Tag people..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              {tagResults.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {tagResults.map((p) => (
                    <button key={p.id} onClick={() => addTag(p)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left">
                      <Avatar name={p.name || "Traveler"} url={p.avatar_url} size="sm" />
                      <span className="text-sm font-semibold text-slate-800">{p.name || "Traveler"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} disabled={posting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-60">
                Back
              </button>
              <button onClick={handlePost} disabled={posting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60">
                {posting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FollowListModal({
  title, loading, profiles, uid, followingIds, onToggleFollow, onClose,
}: {
  title: string; loading: boolean; profiles: Profile[]; uid: string;
  followingIds: Set<string>; onToggleFollow: (id: string) => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-slate-900">{title}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto space-y-1">
          {loading && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5 py-6 justify-center"><Loader2 size={12} className="animate-spin" /> Loading...</p>
          )}
          {!loading && profiles.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No one here yet.</p>
          )}
          {!loading && profiles.map((p) => {
            const isSelf = p.id === uid;
            const isFollowing = followingIds.has(p.id);
            return (
              <div key={p.id} className="flex items-center gap-3 px-1 py-1.5 rounded-xl hover:bg-slate-50">
                <Link href={`/u/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={p.name || "Traveler"} url={p.avatar_url} />
                  <p className="text-sm font-semibold text-slate-800 truncate">{p.name || "Traveler"}</p>
                </Link>
                {!isSelf && (
                  <button onClick={() => onToggleFollow(p.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      isFollowing ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}>
                    {isFollowing ? <><UserCheck size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DeletePostConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[4000] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h2 className="text-lg font-black text-slate-900 text-center mb-1">Delete this post?</h2>
        <p className="text-sm text-slate-500 text-center mb-6">This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [uid,        setUid]        = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [posts,      setPosts]      = useState<Post[]>([]);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const [showNewPost, setShowNewPost] = useState(false);
  const [myPhotos, setMyPhotos] = useState<MapPhoto[]>([]);

  const [openComments, setOpenComments] = useState<Set<string>>(new Set());

  const [sharingId, setSharingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [followList, setFollowList] = useState<{ kind: "following" | "followers"; profiles: Profile[] } | null>(null);
  const [followListLoading, setFollowListLoading] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function reloadSocial(currentUid: string) {
    const [feed, counts, following] = await Promise.all([
      fetchFeed(currentUid),
      getFollowCounts(currentUid),
      getFollowingIds(currentUid),
    ]);
    setPosts(feed);
    setFollowCounts(counts);
    setFollowingIds(following);
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      await ensureProfile(user.id, (user.user_metadata?.name as string) || user.email || "Traveler");
      setUid(user.id);
      await reloadSocial(user.id);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (!uid) return;
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    setSearchResults(await searchProfiles(q, uid));
    setSearching(false);
  }

  async function handleFollowToggle(targetId: string) {
    if (!uid) return;
    if (followingIds.has(targetId)) {
      await unfollowUser(uid, targetId);
    } else {
      await followUser(uid, targetId);
    }
    await reloadSocial(uid);
  }

  async function openFollowList(kind: "following" | "followers") {
    if (!uid) return;
    setFollowList({ kind, profiles: [] });
    setFollowListLoading(true);
    const profiles = await (kind === "following" ? fetchFollowingProfiles(uid) : fetchFollowerProfiles(uid));
    setFollowList({ kind, profiles });
    setFollowListLoading(false);
  }

  async function handleLike(post: Post) {
    if (!uid) return;
    const nowLiked = await toggleLike(uid, post.id, post.likedByMe);
    setPosts((prev) => prev.map((p) => p.id === post.id
      ? { ...p, likedByMe: nowLiked, likeCount: p.likeCount + (nowLiked ? 1 : -1) }
      : p));
  }

  async function handleRepost(post: Post) {
    if (!uid) return;
    await createRepost(uid, post);
    await reloadSocial(uid);
  }

  // Reuses the existing photo-share link mechanism (lib/shareUtils.ts / /share/[id])
  // — post.imageUrl is already a public Storage URL, so sharePhoto skips re-uploading
  // and just creates a `shares` row pointing at it. A public link works for anyone,
  // including people who don't follow the poster (unlike the feed itself).
  async function handleShare(post: Post) {
    setSharingId(post.id);
    try {
      const url = await sharePhoto({
        id: post.id,
        fileName: post.caption || "Travelries post",
        imageUrl: post.imageUrl,
        location: post.location ?? undefined,
        captureDate: post.captureDate ?? undefined,
        faceCount: 0,
      });
      if (navigator.share) {
        await navigator.share({ title: "Travelries", text: post.caption ?? undefined, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedId(post.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") console.error("Share failed:", err);
    } finally {
      setSharingId(null);
    }
  }

  async function handleDelete(postId: string) {
    if (!uid) return;
    await deletePost(uid, postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setConfirmDeleteId(null);
  }

  async function openNewPost() {
    if (!uid) return;
    setMyPhotos(await fetchMapPhotos(uid));
    setShowNewPost(true);
  }

  async function handlePosted(photoId: string, imageUrl: string, caption: string, taggedIds: string[], location?: string, captureDate?: string) {
    if (!uid) return;
    const postId = await createPost(uid, { photoId, imageUrl, caption, location, captureDate });
    await Promise.all(taggedIds.map((tid) => tagUserInPost(postId, tid)));
    setShowNewPost(false);
    await reloadSocial(uid);
  }

  function toggleComments(postId: string) {
    setOpenComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
  }

  if (loading) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28">
      <div className="max-w-2xl mx-auto space-y-5">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
            <Sparkles size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Feed</h1>
            <p className="text-slate-500 text-sm">
              <button onClick={() => openFollowList("following")} className="hover:underline">
                <strong className="text-slate-700">{followCounts.following}</strong> following
              </button>
              {" · "}
              <button onClick={() => openFollowList("followers")} className="hover:underline">
                <strong className="text-slate-700">{followCounts.followers}</strong> followers
              </button>
            </p>
          </div>
          <button onClick={openNewPost}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200">
            <Plus size={16} /> Post
          </button>
        </div>

        {/* Find people */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="relative mb-2">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Find people by name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          {searching && <p className="text-xs text-slate-400 flex items-center gap-1.5 px-1"><Loader2 size={11} className="animate-spin" /> Searching...</p>}
          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <p className="text-xs text-slate-400 px-1">No one found.</p>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-1.5">
              {searchResults.map((p) => {
                const isFollowing = followingIds.has(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-slate-50">
                    <Link href={`/u/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar name={p.name || "Traveler"} url={p.avatar_url} />
                      <p className="text-sm font-semibold text-slate-800 truncate">{p.name || "Traveler"}</p>
                    </Link>
                    <button onClick={() => handleFollowToggle(p.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        isFollowing ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}>
                      {isFollowing ? <><UserCheck size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feed */}
        {posts.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <Users size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-700 mb-1">Your feed is empty</p>
            <p className="text-slate-400 text-sm">Follow other travelers, or post one of your own photos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {post.repostOf && (
                  <p className="flex items-center gap-1.5 px-4 pt-2.5 text-[11px] font-semibold text-slate-400">
                    <Repeat2 size={12} /> {post.authorName} reposted from {post.repostOf.authorName}
                  </p>
                )}
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <Link href={`/u/${post.userId}`} className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Avatar name={post.authorName} url={post.authorAvatarUrl} />
                    <p className="text-sm font-bold text-slate-800 truncate">{post.authorName}</p>
                  </Link>
                  <p className="text-xs text-slate-400">{timeAgo(post.createdAt)}</p>
                  {post.userId === uid && (
                    <button onClick={() => setConfirmDeleteId(post.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <Link href={`/post/${post.id}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.imageUrl} alt="" className="w-full max-h-96 object-cover" />
                </Link>
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleLike(post)} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-red-500 transition-colors">
                      <Heart size={18} className={post.likedByMe ? "fill-red-500 text-red-500" : ""} />
                      {post.likeCount > 0 && post.likeCount}
                    </button>
                    <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors">
                      <MessageCircle size={18} />
                      {post.commentCount > 0 && post.commentCount}
                    </button>
                    <button onClick={() => handleRepost(post)} title="Repost to your feed"
                      className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors">
                      <Repeat2 size={18} />
                    </button>
                    <button onClick={() => handleShare(post)} disabled={sharingId === post.id} title="Share"
                      className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors disabled:opacity-60">
                      {sharingId === post.id
                        ? <Loader2 size={18} className="animate-spin" />
                        : copiedId === post.id ? <Check size={18} className="text-emerald-600" /> : <Share2 size={18} />}
                    </button>
                  </div>
                  {post.caption && <p className="text-sm text-slate-700">{post.caption}</p>}
                  {post.taggedUsers.length > 0 && (
                    <p className="text-xs text-slate-500">
                      with{" "}
                      {post.taggedUsers.map((t, i) => (
                        <span key={t.id}>
                          <Link href={`/u/${t.id}`} className="font-semibold text-slate-700 hover:underline">{t.name}</Link>
                          {i < post.taggedUsers.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </p>
                  )}
                  {(post.location || post.captureDate) && (
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      {post.location && <span className="flex items-center gap-1"><MapPin size={10} />{post.location}</span>}
                      {post.captureDate && <span className="flex items-center gap-1"><CalendarDays size={10} />{post.captureDate}</span>}
                    </p>
                  )}
                </div>

                {openComments.has(post.id) && uid && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                    <CommentThread
                      uid={uid}
                      postId={post.id}
                      onCountChange={(count) => setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, commentCount: count } : p))}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showNewPost && uid && <NewPostModal uid={uid} photos={myPhotos} onClose={() => setShowNewPost(false)} onPosted={handlePosted} />}
      {confirmDeleteId && (
        <DeletePostConfirmModal
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {followList && uid && (
        <FollowListModal
          title={followList.kind === "following" ? "Following" : "Followers"}
          loading={followListLoading}
          profiles={followList.profiles}
          uid={uid}
          followingIds={followingIds}
          onToggleFollow={async (id) => { await handleFollowToggle(id); openFollowList(followList.kind); }}
          onClose={() => setFollowList(null)}
        />
      )}
      <BottomNav />
    </main>
  );
}
