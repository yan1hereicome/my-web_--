"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, CalendarDays, Pencil, Check, X,
  KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, LogOut, Camera, Loader2,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabase";

type Profile = { id: string; name: string; created_at: string; avatar_url?: string | null };

// Downscales to a manageable square-ish size before upload — an avatar never
// needs to be full photo resolution, and this keeps Storage usage/bandwidth down.
async function resizeAvatarBlob(file: File, maxSize = 512, quality = 0.9): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const resized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return resized ?? file;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function ProfilePage() {
  const router = useRouter();

  const [email,   setEmail]   = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [draftName,   setDraftName]   = useState("");
  const [nameMsg,     setNameMsg]     = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password change
  const [showPwSection, setShowPwSection] = useState(false);
  const [oldPw,         setOldPw]         = useState("");
  const [newPw,         setNewPw]         = useState("");
  const [confirmPw,     setConfirmPw]     = useState("");
  const [showOld,       setShowOld]       = useState(false);
  const [showNew,       setShowNew]       = useState(false);
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [pwMsg,         setPwMsg]         = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pwLoading,     setPwLoading]     = useState(false);

  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg,       setAvatarMsg]       = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data as Profile);
      } else {
        // Profile missing (e.g. old account) — create it now.
        const name = (user.user_metadata?.name as string) ?? "";
        const { data: created } = await supabase
          .from("profiles")
          .upsert({ id: user.id, name }, { onConflict: "id" })
          .select()
          .single();
        if (created) setProfile(created as Profile);
      }
    }
    load();
  }, [router]);

  async function saveName() {
    const trimmed = draftName.trim();
    if (!trimmed) { setNameMsg({ type: "err", text: "Name cannot be empty." }); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").update({ name: trimmed }).eq("id", user.id);
    await supabase.auth.updateUser({ data: { name: trimmed } });

    setProfile((p) => p ? { ...p, name: trimmed } : p);
    setEditingName(false);
    setNameMsg({ type: "ok", text: "Name updated!" });
    setTimeout(() => setNameMsg(null), 3000);
  }

  async function savePassword() {
    setPwMsg(null);
    if (!oldPw || !newPw || !confirmPw) { setPwMsg({ type: "err", text: "Please fill in all fields." }); return; }
    if (newPw.length < 6)               { setPwMsg({ type: "err", text: "New password must be at least 6 characters." }); return; }
    if (newPw !== confirmPw)            { setPwMsg({ type: "err", text: "New passwords do not match." }); return; }

    setPwLoading(true);

    // Validate current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: oldPw });
    if (signInError) {
      setPwMsg({ type: "err", text: "Current password is incorrect." });
      setPwLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);

    if (error) {
      setPwMsg({ type: "err", text: error.message });
    } else {
      setOldPw(""); setNewPw(""); setConfirmPw("");
      setShowPwSection(false);
      setPwMsg({ type: "ok", text: "Password changed successfully!" });
      setTimeout(() => setPwMsg(null), 3000);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !profile) return;

    setAvatarUploading(true);
    setAvatarMsg(null);
    try {
      const blob = await resizeAvatarBlob(file);
      // A fresh filename per upload (rather than a fixed "avatar.jpg" with upsert)
      // only ever needs the same insert-your-own-path Storage permission that photo
      // uploads already use — no separate overwrite/update policy to depend on.
      const path = `${profile.id}/avatar-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("user-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) throw new Error(uploadError.message);

      const publicUrl = supabase.storage.from("user-photos").getPublicUrl(path).data.publicUrl;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", profile.id);
      if (updateError) throw new Error(updateError.message);

      setProfile((p) => p ? { ...p, avatar_url: publicUrl } : p);
    } catch (err) {
      setAvatarMsg(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setAvatarUploading(false);
    }
  }

  if (!profile) return null;

  const displayName = profile.name || email;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28">
      <div className="max-w-lg mx-auto space-y-5">

        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">My Profile</h1>

        {/* Avatar card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200 overflow-hidden disabled:opacity-70"
            >
              {avatarUploading ? (
                <Loader2 size={20} className="text-white animate-spin" />
              ) : profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-extrabold text-white">{initials(displayName)}</span>
              )}
            </button>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 transition-colors"
            >
              <Camera size={12} />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900 truncate">{displayName}</p>
            <p className="text-sm text-slate-500 truncate">{email}</p>
            {avatarMsg && <p className="text-xs text-red-500 font-medium mt-1">{avatarMsg}</p>}
          </div>
        </div>

        {/* Account info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <p className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
            Account Details
          </p>

          {/* Name row */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
              <User size={13} /> FULL NAME
            </div>
            {editingName ? (
              <div className="flex gap-2 mt-1">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  autoFocus
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <button onClick={saveName} className="bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                  <Check size={16} />
                </button>
                <button onClick={() => setEditingName(false)} className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-200 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{displayName}</p>
                <button
                  onClick={() => { setDraftName(displayName); setEditingName(true); setNameMsg(null); }}
                  className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )}
            {nameMsg && (
              <p className={`text-xs mt-1 font-medium flex items-center gap-1 ${nameMsg.type === "ok" ? "text-emerald-600" : "text-red-500"}`}>
                {nameMsg.type === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                {nameMsg.text}
              </p>
            )}
          </div>

          {/* Email row */}
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
              <Mail size={13} /> EMAIL
            </div>
            <p className="text-sm font-semibold text-slate-800">{email}</p>
          </div>

          {/* Member since */}
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold mb-1">
              <CalendarDays size={13} /> MEMBER SINCE
            </div>
            <p className="text-sm font-semibold text-slate-800">{formatDate(profile.created_at)}</p>
          </div>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            onClick={() => { setShowPwSection((v) => !v); setPwMsg(null); }}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <KeyRound size={18} className="text-slate-500" />
              <span className="text-sm font-bold text-slate-800">Change Password</span>
            </div>
            <span className="text-xs text-blue-600 font-semibold">{showPwSection ? "Cancel" : "Update"}</span>
          </button>

          {showPwSection && (
            <div className="px-6 pb-5 space-y-3 border-t border-slate-100 pt-4">
              {(["Current password", "New password", "Confirm new password"] as const).map((label, idx) => {
                const val     = [oldPw, newPw, confirmPw][idx];
                const setter  = [setOldPw, setNewPw, setConfirmPw][idx];
                const show    = [showOld, showNew, showConfirm][idx];
                const toggler = [() => setShowOld((v) => !v), () => setShowNew((v) => !v), () => setShowConfirm((v) => !v)][idx];
                return (
                  <div key={label}>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                    <div className="relative">
                      <input
                        type={show ? "text" : "password"} value={val}
                        onChange={(e) => setter(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                      />
                      <button type="button" onClick={toggler}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5">
                        {show ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {pwMsg && (
                <p className={`text-xs font-medium flex items-center gap-1 ${pwMsg.type === "ok" ? "text-emerald-600" : "text-red-500"}`}>
                  {pwMsg.type === "ok" ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {pwMsg.text}
                </p>
              )}

              <button
                onClick={savePassword} disabled={pwLoading}
                className={`w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all ${
                  pwLoading ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {pwLoading ? "Saving…" : "Save new password"}
              </button>
            </div>
          )}
        </div>

        {pwMsg && !showPwSection && (
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
            <CheckCircle2 size={16} /> {pwMsg.text}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-red-200 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors"
        >
          <LogOut size={16} /> Sign out
        </button>

      </div>
      <BottomNav />
    </main>
  );
}
