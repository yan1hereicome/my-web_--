"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { fetchComments, addComment, deleteComment, toggleCommentLike, Comment } from "@/lib/socialUtils";
import { Heart, Send, Trash2, Loader2 } from "lucide-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// Self-contained comment section: fetches its own comments, and owns
// add/reply/like/delete. Used by both the feed (mounted only while a post's
// comment panel is expanded) and the post detail page (mounted once, always
// visible) so neither page has to duplicate this state.
export default function CommentThread({
  uid, postId, onCountChange,
}: {
  uid: string;
  postId: string;
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  async function load() {
    setLoading(true);
    const list = await fetchComments(uid, postId);
    setComments(list);
    onCountChange?.(list.length);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function handleAdd(parentCommentId?: string) {
    const text = (parentCommentId ? replyDraft : draft).trim();
    if (!text) return;
    await addComment(uid, postId, text, parentCommentId);
    if (parentCommentId) { setReplyDraft(""); setReplyingTo(null); } else setDraft("");
    await load();
  }

  async function handleDelete(commentId: string) {
    await deleteComment(uid, commentId);
    await load();
  }

  async function handleLike(comment: Comment) {
    const nowLiked = await toggleCommentLike(uid, comment.id, comment.likedByMe);
    setComments((prev) => prev.map((c) => c.id === comment.id
      ? { ...c, likedByMe: nowLiked, likeCount: c.likeCount + (nowLiked ? 1 : -1) }
      : c));
  }

  const topLevel = comments.filter((c) => !c.parentCommentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentCommentId === id);

  function CommentRow({ c, isReply }: { c: Comment; isReply?: boolean }) {
    return (
      <div className={`flex items-start gap-2 ${isReply ? "ml-9" : ""}`}>
        <div className="mt-0.5"><Avatar name={c.authorName} url={c.authorAvatarUrl} size="sm" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-800">
            <Link href={`/u/${c.userId}`} className="font-bold hover:underline">{c.authorName}</Link> {c.content}
          </p>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-[10px] text-slate-400">{timeAgo(c.createdAt)}</p>
            <button onClick={() => handleLike(c)}
              className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors">
              <Heart size={11} className={c.likedByMe ? "fill-red-500 text-red-500" : ""} />
              {c.likeCount > 0 && c.likeCount}
            </button>
            {!isReply && (
              <button
                onClick={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyDraft(""); }}
                className="text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors">
                Reply
              </button>
            )}
          </div>
          {replyingTo === c.id && (
            <div className="flex items-center gap-2 mt-1.5">
              <input
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(c.id); }}
                placeholder={`Reply to ${c.authorName}...`}
                autoFocus
                className="flex-1 text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <button onClick={() => handleAdd(c.id)}
                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                <Send size={11} />
              </button>
            </div>
          )}
        </div>
        {c.userId === uid && (
          <button onClick={() => handleDelete(c.id)} className="text-slate-300 hover:text-red-500 transition-colors p-0.5 flex-shrink-0">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {loading && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Loading comments...</p>
      )}
      {!loading && comments.length === 0 && <p className="text-xs text-slate-400">No comments yet.</p>}
      {topLevel.map((c) => (
        <div key={c.id} className="space-y-2">
          <CommentRow c={c} />
          {repliesOf(c.id).map((r) => <CommentRow key={r.id} c={r} isReply />)}
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Add a comment..."
          className="flex-1 text-xs bg-white border border-slate-200 rounded-full px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
        />
        <button onClick={() => handleAdd()}
          className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
