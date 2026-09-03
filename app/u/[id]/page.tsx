"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import {
  fetchProfile, getFollowCounts, isFollowing as checkIsFollowing, followUser, unfollowUser, fetchUserPosts,
  Profile, Post,
} from "@/lib/socialUtils";
import { ArrowLeft, UserPlus, UserCheck, Lock, Loader2, Heart, MessageCircle } from "lucide-react";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const targetId = params.id as string;

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUid(user.id);

    const [p, c, isFollowingTarget] = await Promise.all([
      fetchProfile(targetId),
      getFollowCounts(targetId),
      user.id === targetId ? Promise.resolve(false) : checkIsFollowing(user.id, targetId),
    ]);
    setProfile(p);
    setCounts(c);
    setFollowing(isFollowingTarget);
    setPosts(await fetchUserPosts(user.id, targetId));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  async function handleFollowToggle() {
    if (!uid) return;
    setFollowBusy(true);
    if (following) await unfollowUser(uid, targetId);
    else await followUser(uid, targetId);
    setFollowing(!following);
    setCounts((prev) => ({ ...prev, followers: prev.followers + (following ? -1 : 1) }));
    // Following someone reveals their posts (RLS), so refetch rather than just flip a flag.
    setPosts(await fetchUserPosts(uid, targetId));
    setFollowBusy(false);
  }

  if (loading) return null;
  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28 flex items-center justify-center">
        <p className="text-slate-400 text-sm">User not found.</p>
        <BottomNav />
      </main>
    );
  }

  const isSelf = uid === targetId;
  const canSeePosts = isSelf || following;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28">
      <div className="max-w-2xl mx-auto space-y-5">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-5">
          <Avatar name={profile.name || "Traveler"} url={profile.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-slate-900 truncate">{profile.name || "Traveler"}</p>
            <p className="text-sm text-slate-500">
              <strong className="text-slate-700">{counts.following}</strong> following ·{" "}
              <strong className="text-slate-700">{counts.followers}</strong> followers
            </p>
          </div>
          {isSelf ? (
            <Link href="/profile" className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
              Edit profile
            </Link>
          ) : (
            <button onClick={handleFollowToggle} disabled={followBusy}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-colors disabled:opacity-60 ${
                following ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"
              }`}>
              {followBusy
                ? <Loader2 size={14} className="animate-spin" />
                : following ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>
              }
            </button>
          )}
        </div>

        {!canSeePosts ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <Lock size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-700 mb-1">Follow to see their posts</p>
            <p className="text-slate-400 text-sm">Posts are only visible to people {profile.name || "this traveler"} follows back.</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-14 text-center">
            <p className="font-bold text-slate-700 mb-1">No posts yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {posts.map((post) => (
              <Link key={post.id} href={`/post/${post.id}`} className="relative aspect-square rounded-lg overflow-hidden group block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                  <span className="flex items-center gap-1 text-white text-xs font-bold"><Heart size={13} className="fill-white" /> {post.likeCount}</span>
                  <span className="flex items-center gap-1 text-white text-xs font-bold"><MessageCircle size={13} /> {post.commentCount}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
