"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, CheckCheck, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  AppNotification,
  getNotifications,
  markAllRead,
  subscribeToNotifications,
} from "@/lib/notificationUtils";
import { profilesByIds } from "@/lib/socialUtils";

const TYPE_ICON: Record<string, string> = {
  share_viewed:       "👁️",
  collab_joined:      "🤝",
  collab_photo_added: "📸",
  post_liked:         "❤️",
  post_commented:     "💬",
  tagged_in_post:     "🏷️",
  comment_liked:      "❤️",
  comment_replied:    "💬",
};

// Only these types carry a `from_user_id` (the person who acted) in their `data` —
// share_viewed/collab_joined/collab_photo_added predate this and keep their static message.
const ACTION_TEXT: Record<string, string> = {
  post_liked:      "liked your post",
  post_commented:  "commented on your post",
  tagged_in_post:  "tagged you in a post",
  comment_liked:   "liked your comment",
  comment_replied: "replied to your comment",
};

export default function NotificationBell() {
  const [notes,  setNotes]  = useState<AppNotification[]>([]);
  const [open,   setOpen]   = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      getNotifications().then(setNotes);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const channel = subscribeToNotifications(userId, (n) => {
      setNotes((prev) => [n, ...prev]);
    });
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Resolves "who liked/commented/tagged you" — only fetches ids we don't already have a name for.
  useEffect(() => {
    const ids = [...new Set(
      notes.map((n) => (n.data?.from_user_id as string) ?? null).filter((id): id is string => !!id),
    )].filter((id) => !(id in actorNames));
    if (ids.length === 0) return;
    profilesByIds(ids).then((profiles) => {
      setActorNames((prev) => {
        const next = { ...prev };
        for (const p of profiles) next[p.id] = p.name || "Traveler";
        return next;
      });
    });
  }, [notes, actorNames]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!userId) return null;

  const unread = notes.filter((n) => !n.read).length;

  async function handleMarkAll() {
    await markAllRead();
    setNotes((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div ref={ref} className="fixed top-4 right-4 z-[2000]">
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-11 h-11 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
      >
        {unread > 0
          ? <BellRing size={20} className="text-violet-600" />
          : <Bell size={20} className="text-slate-400" />
        }
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-[320px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-violet-600" />
              <span className="font-bold text-slate-800 text-sm">Notifications</span>
              {unread > 0 && (
                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={handleMarkAll}
                  className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-800 transition-colors">
                  <CheckCheck size={12} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 p-0.5">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-50">
            {notes.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={28} className="text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">No notifications yet</p>
              </div>
            ) : (
              notes.map((n) => (
                <div key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${n.read ? "bg-white" : "bg-violet-50/60"}`}>
                  <span className="text-base flex-shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${n.read ? "text-slate-500" : "text-slate-800 font-semibold"}`}>
                      {(() => {
                        const fromUserId = (n.data?.from_user_id as string) ?? null;
                        const postId = (n.data?.post_id as string) ?? null;
                        const actionText = ACTION_TEXT[n.type];
                        if (fromUserId && actionText) {
                          return (
                            <>
                              <Link href={`/u/${fromUserId}`} onClick={() => setOpen(false)} className="font-bold hover:underline">
                                {actorNames[fromUserId] ?? "Someone"}
                              </Link>{" "}
                              {postId ? (
                                <Link href={`/post/${postId}`} onClick={() => setOpen(false)} className="hover:underline">
                                  {actionText}
                                </Link>
                              ) : actionText}
                            </>
                          );
                        }
                        return n.message;
                      })()}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
