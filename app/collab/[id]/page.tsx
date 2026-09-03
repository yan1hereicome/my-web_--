"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabase";
import { MapPhoto } from "@/lib/types";
import { fetchMapPhotos } from "@/lib/photosApi";
import {
  getAlbum, getAlbumMembers, getAlbumPhotos,
  addPhotoToAlbum, removePhotoFromAlbum,
  leaveAlbum, deleteAlbum, removeMember,
  getReactions, toggleReaction, getComments, addComment,
  CollabAlbum, CollabMember, CollabPhoto, CollabReaction, CollabComment,
} from "@/lib/collabUtils";
import {
  FolderOpen, ArrowLeft, Copy, Check, Plus, Trash2, UserMinus,
  Users, Images, X, LogOut, Loader2, CalendarDays, UserPlus, Share2,
  MessageCircle, Send,
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  owner:       "bg-violet-100 text-violet-700",
  contributor: "bg-blue-100 text-blue-700",
  viewer:      "bg-slate-100 text-slate-500",
};

function InviteModal({ inviteCode, onClose }: { inviteCode: string; onClose: () => void }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const inviteLink = `${window.location.origin}/collab/join?code=${inviteCode}`;

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function copyCode() {
    await navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  async function nativeShare() {
    if (!navigator.share) return;
    await navigator.share({ title: "Join my Collab Album", url: inviteLink });
  }

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-[460px] w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Invite Members</h2>
            <p className="text-xs text-slate-400 mt-0.5">Share the link or code with others</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Invite link */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-1.5">Invite Link</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLink}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-600 truncate outline-none" />
              <button onClick={copyLink}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  linkCopied ? "bg-emerald-500 text-white" : "bg-slate-900 text-white hover:bg-slate-700"
                }`}>
                {linkCopied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Link</>}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Anyone with this link can join the album.
            </p>
          </div>

          {/* Raw code */}
          <div>
            <p className="text-xs font-bold text-slate-600 mb-1.5">Or share the code</p>
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <code className="flex-1 text-2xl font-mono font-bold text-violet-600 tracking-[0.3em]">
                {inviteCode}
              </code>
              <button onClick={copyCode}
                className="text-slate-400 hover:text-violet-600 transition-colors p-1">
                {codeCopied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              They can enter this code at <strong className="text-slate-600">Collab → Join</strong>.
            </p>
          </div>

          {/* Native share button (mobile) */}
          {canNativeShare && (
            <button onClick={nativeShare}
              className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-colors">
              <Share2 size={16} /> Share via...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PhotoPicker({
  onAdd,
  onClose,
}: {
  onAdd: (photos: MapPhoto[]) => Promise<void>;
  onClose: () => void;
}) {
  const [localPhotos, setLocalPhotos] = useState<MapPhoto[]>([]);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [adding,      setAdding]      = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? "guest";
      // Same source Albums reads from (is_map_photo rows in Supabase) — a stale
      // pre-Supabase localStorage array was used here before, which showed photos
      // that no longer existed (or hid ones that did) versus what Albums showed.
      setLocalPhotos(uid === "guest" ? [] : await fetchMapPhotos(uid));
    }
    load();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    const toAdd = localPhotos.filter((p) => selected.has(p.id));
    if (!toAdd.length) return;
    setAdding(true);
    try {
      await onAdd(toAdd);
      onClose();
    } catch (err) {
      alert(`Failed to add photos: ${err instanceof Error ? err.message : String(err)}`);
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-[600px] w-full shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-900">Add Photos</h2>
            <p className="text-xs text-slate-400 mt-0.5">Select from your photos · {selected.size} selected</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {localPhotos.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No photos saved yet. Upload photos from the home screen.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {localPhotos.map((photo) => {
                const isSelected = selected.has(photo.id);
                return (
                  <div key={photo.id} onClick={() => toggle(photo.id)}
                    className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                      isSelected ? "border-violet-500 shadow-lg shadow-violet-100" : "border-slate-200 hover:border-slate-300"
                    }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.imageUrl} alt={photo.fileName}
                      className="w-full h-24 object-cover bg-slate-100" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                        <div className="w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center">
                          <Check size={14} className="text-white" />
                        </div>
                      </div>
                    )}
                    <p className="text-[9px] font-bold text-slate-700 truncate px-1.5 py-1 bg-white">
                      {photo.fileName}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100">
          <button onClick={handleAdd} disabled={selected.size === 0 || adding}
            className="w-full py-3 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {adding
              ? <><Loader2 size={16} className="animate-spin" /> Uploading...</>
              : `Add ${selected.size} Photo${selected.size !== 1 ? "s" : ""}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

const REACTION_EMOJIS = ["❤️", "😊", "🔥", "✨"];

function CollabPhotoModal({
  photo, myUid, canDelete,
  onClose, onRemove,
}: {
  photo: CollabPhoto;
  myUid: string | null;
  canDelete: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const [reactions, setReactions] = useState<CollabReaction[]>([]);
  const [comments,  setComments]  = useState<CollabComment[]>([]);
  const [draft,     setDraft]     = useState("");
  const [sending,   setSending]   = useState(false);

  useEffect(() => {
    getReactions(photo.id).then(setReactions);
    getComments(photo.id).then(setComments);
  }, [photo.id]);

  async function handleToggle(emoji: string) {
    try {
      await toggleReaction(photo.id, emoji);
      setReactions(await getReactions(photo.id));
    } catch { /* table may not exist yet */ }
  }

  async function handleSendComment() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const c = await addComment(photo.id, draft.trim());
      setComments(prev => [...prev, c]);
      setDraft("");
    } catch { /* table may not exist yet */ }
    setSending(false);
  }

  const reactionCounts: Record<string, number> = {};
  const myReactions = new Set<string>();
  reactions.forEach(r => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1;
    if (r.user_id === myUid) myReactions.add(r.emoji);
  });

  return (
    <div className="fixed inset-0 bg-black/80 z-[3000] flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto"
      onClick={onClose}>
      <div className="w-full sm:max-w-[520px] bg-white sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-sm truncate">{photo.file_name}</p>
            {photo.added_by_email && (
              <p className="text-[10px] text-slate-400 mt-0.5">by {photo.added_by_email.split("@")[0]}</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 ml-3 flex-shrink-0"><X size={18} /></button>
        </div>

        {/* Photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.image_url} alt={photo.file_name} className="w-full max-h-[40vh] object-contain bg-slate-100 flex-shrink-0" />

        {/* Reactions */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 flex-shrink-0">
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => handleToggle(emoji)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold transition-all ${
                myReactions.has(emoji)
                  ? "bg-rose-100 ring-1 ring-rose-300"
                  : "bg-slate-50 hover:bg-slate-100"
              }`}>
              {emoji}
              {reactionCounts[emoji] ? <span className="text-[11px] text-slate-600">{reactionCounts[emoji]}</span> : null}
            </button>
          ))}
        </div>

        {/* Comments */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-[80px]">
          {comments.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">No comments yet. Be the first!</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-violet-700">
                    {((c.user_email ?? c.user_id)[0] ?? "?").toUpperCase()}
                  </span>
                </div>
                <div className="bg-slate-50 rounded-xl px-3 py-1.5 flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-500">{c.user_email?.split("@")[0] ?? "user"}</p>
                  <p className="text-xs text-slate-800 mt-0.5 break-words">{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment input */}
        <div className="flex gap-2 px-4 py-3 border-t border-slate-100 flex-shrink-0">
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendComment()}
            placeholder="Add a comment..."
            className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition-all"
          />
          <button onClick={handleSendComment} disabled={!draft.trim() || sending}
            className="w-9 h-9 flex items-center justify-center bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-40 flex-shrink-0">
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>

        {/* Remove */}
        {canDelete && (
          <div className="px-4 pb-4 flex-shrink-0">
            <button onClick={() => { onRemove(photo.id); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 text-sm font-bold transition-colors">
              <Trash2 size={14} /> Remove from album
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CollabAlbumPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [album,              setAlbum]              = useState<CollabAlbum | null | undefined>(undefined);
  const [members,            setMembers]            = useState<CollabMember[]>([]);
  const [photos,             setPhotos]             = useState<CollabPhoto[]>([]);
  const [myUid,              setMyUid]              = useState<string | null>(null);
  const [tab,                setTab]                = useState<"photos" | "members">("photos");
  const [showPicker,         setShowPicker]         = useState(false);
  const [showInvite,         setShowInvite]         = useState(false);
  const [selectedCollabPhoto,setSelectedCollabPhoto]= useState<CollabPhoto | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setMyUid(user?.id ?? null);
      const [a, m, p] = await Promise.all([
        getAlbum(id),
        getAlbumMembers(id),
        getAlbumPhotos(id),
      ]);
      setAlbum(a);
      setMembers(m);
      setPhotos(p);
    }
    load();
  }, [id]);

  async function handleAddPhotos(toAdd: MapPhoto[]) {
    const added: CollabPhoto[] = [];
    for (const photo of toAdd) {
      const cp = await addPhotoToAlbum(id, photo);
      added.push(cp);
    }
    setPhotos((prev) => [...added, ...prev]);
  }

  async function handleRemovePhoto(photoId: string) {
    if (!confirm("Remove this photo from the album?")) return;
    await removePhotoFromAlbum(photoId);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  async function handleLeave() {
    if (!confirm("Leave this album?")) return;
    try {
      await leaveAlbum(id);
      router.push("/collab");
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleDelete() {
    if (!confirm("Deleting this album will remove all photos and members. Continue?")) return;
    try {
      await deleteAlbum(id);
      router.push("/collab");
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm("Remove this member?")) return;
    try {
      await removeMember(id, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const isOwner      = album?.owner_id === myUid;
  const canContribute = album?.role === "owner" || album?.role === "contributor";

  if (album === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={28} className="text-slate-300" />
          </div>
          <p className="font-bold text-slate-700 mb-2">Album not found</p>
          <Link href="/collab" className="text-sm text-violet-600 font-semibold hover:underline">← Back to albums</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/collab"
              className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors">
              <ArrowLeft size={20} className="text-slate-600" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{album.name}</h1>
                {album.role && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[album.role] ?? ""}`}>
                    {album.role}
                  </span>
                )}
              </div>
              {album.description && <p className="text-slate-400 text-sm mt-0.5">{album.description}</p>}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors shadow-md shadow-violet-200">
              <UserPlus size={15} /> Invite Members
            </button>
            {isOwner ? (
              <button onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors">
                <Trash2 size={15} /> Delete
              </button>
            ) : (
              <button onClick={handleLeave}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-red-50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors">
                <LogOut size={15} /> Leave
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setTab("photos")}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              tab === "photos"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-200"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}>
            <Images size={15} /> Photos
            <span className={`text-xs ml-0.5 ${tab === "photos" ? "text-violet-200" : "text-slate-400"}`}>{photos.length}</span>
          </button>
          <button onClick={() => setTab("members")}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              tab === "members"
                ? "bg-violet-600 text-white shadow-lg shadow-violet-200"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}>
            <Users size={15} /> Members
            <span className={`text-xs ml-0.5 ${tab === "members" ? "text-violet-200" : "text-slate-400"}`}>{members.length}</span>
          </button>
          {canContribute && (
            <button onClick={() => setShowPicker(true)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-colors">
              <Plus size={15} /> Add Photos
            </button>
          )}
        </div>

        {/* Photos */}
        {tab === "photos" && (
          photos.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Images size={28} className="text-slate-300" />
              </div>
              <p className="font-bold text-slate-700 mb-1">No photos yet</p>
              <p className="text-slate-400 text-sm mb-4">Members can add photos here.</p>
              {canContribute && (
                <button onClick={() => setShowPicker(true)}
                  className="px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors">
                  Add your first photo
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo) => (
                <div key={photo.id}
                  onClick={() => setSelectedCollabPhoto(photo)}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.image_url} alt={photo.file_name}
                    className="w-full h-36 object-contain bg-slate-100" />
                  <div className="p-2.5">
                    <p className="font-bold text-slate-800 text-xs truncate">{photo.file_name}</p>
                    {photo.capture_date && (
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                        <CalendarDays size={9} /> {photo.capture_date}
                      </p>
                    )}
                    {photo.added_by_email && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        by {photo.added_by_email.split("@")[0]}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1.5">
                      <MessageCircle size={10} className="text-slate-300" />
                      <span className="text-[10px] text-slate-400">tap to react &amp; comment</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Members */}
        {tab === "members" && (
          <div className="space-y-2">
            {members.map((member) => {
              const isMe      = member.user_id === myUid;
              const canRemove = isOwner && !isMe;
              return (
                <div key={member.id}
                  className="bg-white rounded-xl border border-slate-200 px-5 py-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-violet-700 font-bold text-sm">
                      {((member.email ?? member.user_id)[0] ?? "?").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate">
                      {member.email ?? `${member.user_id.slice(0, 8)}...`}
                      {isMe && <span className="text-violet-400 font-normal ml-1">(me)</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Joined {new Date(member.joined_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${ROLE_COLORS[member.role] ?? ""}`}>
                    {member.role}
                  </span>
                  {canRemove && (
                    <button onClick={() => handleRemoveMember(member.user_id)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1 ml-1">
                      <UserMinus size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPicker && (
        <PhotoPicker onAdd={handleAddPhotos} onClose={() => setShowPicker(false)} />
      )}
      {showInvite && album && (
        <InviteModal inviteCode={album.invite_code} onClose={() => setShowInvite(false)} />
      )}
      {selectedCollabPhoto && (
        <CollabPhotoModal
          photo={selectedCollabPhoto}
          myUid={myUid}
          canDelete={selectedCollabPhoto.added_by === myUid || isOwner}
          onClose={() => setSelectedCollabPhoto(null)}
          onRemove={(photoId) => {
            handleRemovePhoto(photoId);
            setSelectedCollabPhoto(null);
          }}
        />
      )}
      <BottomNav />
    </main>
  );
}
