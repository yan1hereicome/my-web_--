"use client";

import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { toggleSaved, getSavedIds, deletePhotoEverywhere } from "@/lib/savedUtils";
import { supabase } from "@/lib/supabase";
import { MapPhoto } from "@/lib/types";
import { fetchMapPhotos, saveLandmarkResult, fetchTripDiary, saveTripDiary } from "@/lib/photosApi";
import {
  Images, Users, Image as ImageIcon, Star, Download, Trash2,
  X, CalendarDays, SlidersHorizontal, Search, Calendar, Share2, Loader2, MapPin, Sparkles, LayoutTemplate,
} from "lucide-react";
import { sharePhoto } from "@/lib/shareUtils";
import ShareCardModal from "@/components/ShareCardModal";
import { loadImage, drawImageCover } from "@/lib/canvasCard";

// Draws a 1080x1920 Instagram-story-style card for a single photo: the photo
// itself (cropped to a rounded frame), its location/date beneath it, and a
// small Travelries watermark — used by the "Story" button in PhotoModal.
async function drawPhotoStoryCard(ctx: CanvasRenderingContext2D, w: number, h: number, photo: MapPhoto) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0B1220");
  bg.addColorStop(1, "#1E293B");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const margin = 56;
  const photoTop = 130;
  const photoH = h * 0.6;
  const photoW = w - margin * 2;

  const img = await loadImage(photo.imageUrl);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(margin, photoTop, photoW, photoH, 36);
  ctx.clip();
  drawImageCover(ctx, img, margin, photoTop, photoW, photoH);
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(margin, photoTop, photoW, photoH, 36);
  ctx.stroke();

  let y = photoTop + photoH + 100;
  ctx.textAlign = "left";

  const loc = photo.location?.split(",")[0]?.trim();
  if (loc) {
    ctx.fillStyle = "#93C5FD";
    ctx.font = "600 36px system-ui, -apple-system, sans-serif";
    ctx.fillText(`📍 ${loc}`, margin, y);
    y += 64;
  }

  const dateLabel = photo.captureDate && photo.captureDate !== "Not available" && photo.captureDate !== "날짜 없음"
    ? photo.captureDate
    : (photo.uploadedAt?.slice(0, 10) ?? "");
  if (dateLabel) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 52px system-ui, -apple-system, sans-serif";
    ctx.fillText(dateLabel, margin, y);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "700 36px system-ui, -apple-system, sans-serif";
  ctx.fillText("✈ Travelries", w / 2, h - 80);
}

type Filter    = "All" | "With People" | "Scenery";
type DateRange = "all" | "week" | "month" | "year";

const BACKEND_URL = "http://localhost:8000";

// Downscale before sending to Claude — cuts image tokens (and cost) with no
// meaningful loss for landmark recognition. Server also enforces this as a backstop.
async function resizeImageForApi(blob: Blob, maxSize = 1024, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const resized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return resized ?? blob;
}

// Stable cache key for a trip's diary — the trip grouping itself is recomputed
// client-side from the currently filtered photo list, so trip.id (an array index)
// isn't safe to persist against. The sorted photo-id set is.
function tripKeyOf(trip: Trip): string {
  return trip.photos.map((p) => p.id).sort().join(",");
}

type Trip = {
  id: string;
  name: string;
  dateRange: string;
  photos: MapPhoto[];
  locations: string[];
};

function getPhotoDate(p: MapPhoto): Date {
  const raw = (p.captureDate && p.captureDate !== "Not available" && p.captureDate !== "날짜 없음")
    ? p.captureDate : p.uploadedAt;
  if (!raw) return new Date(0);
  let d = new Date(raw);
  if (isNaN(d.getTime())) {
    const m = raw.match(/(\d{4})[.\-\s]+(\d{1,2})[.\-\s]+(\d{1,2})/);
    if (m) d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  }
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clusterByGps(photos: MapPhoto[], radiusKm = 1.5): { centLat: number; centLng: number; photos: MapPhoto[]; name: string }[] {
  const clusters: { centLat: number; centLng: number; photos: MapPhoto[]; name: string }[] = [];
  const noGps: MapPhoto[] = [];

  for (const photo of photos) {
    if (!photo.lat || !photo.lng) { noGps.push(photo); continue; }
    let nearest: typeof clusters[0] | null = null;
    let minDist = Infinity;
    for (const c of clusters) {
      const d = haversineKm(photo.lat, photo.lng, c.centLat, c.centLng);
      if (d < minDist) { minDist = d; nearest = c; }
    }
    if (nearest && minDist <= radiusKm) {
      const n = nearest.photos.length + 1;
      nearest.centLat = (nearest.centLat * (n - 1) + photo.lat) / n;
      nearest.centLng = (nearest.centLng * (n - 1) + photo.lng) / n;
      nearest.photos.push(photo);
    } else {
      clusters.push({ centLat: photo.lat, centLng: photo.lng, photos: [photo], name: photo.location?.split(",")[0]?.trim() || "Unknown" });
    }
  }

  if (noGps.length > 0) {
    if (clusters.length > 0) {
      clusters.reduce((a, b) => a.photos.length >= b.photos.length ? a : b).photos.push(...noGps);
    } else {
      clusters.push({ centLat: 0, centLng: 0, photos: noGps, name: "Unknown location" });
    }
  }

  return clusters.sort((a, b) => b.photos.length - a.photos.length);
}

function detectTrips(photos: MapPhoto[], gapDays = 4): Trip[] {
  if (photos.length === 0) return [];
  const dated = photos
    .map(p => ({ photo: p, date: getPhotoDate(p) }))
    .filter(({ date }) => date.getTime() > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (dated.length === 0) return [];

  // Step 1: group by date gap
  const dateGroups: { photo: MapPhoto; date: Date }[][] = [];
  let current: { photo: MapPhoto; date: Date }[] = [];
  for (const item of dated) {
    if (current.length === 0) { current.push(item); continue; }
    const gap = (item.date.getTime() - current[current.length - 1].date.getTime()) / 86400000;
    if (gap > gapDays) { dateGroups.push(current); current = [item]; }
    else current.push(item);
  }
  if (current.length > 0) dateGroups.push(current);

  const fmt = (d: Date) =>
    `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;

  const trips: Trip[] = [];

  // Step 2: within each date group, split by GPS location clusters
  for (const group of dateGroups) {
    const ps = group.map(g => g.photo);
    const ds = group.map(g => g.date);
    const start = ds[0], end = ds[ds.length - 1];
    const range = fmt(start) === fmt(end) ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;

    const locClusters = clusterByGps(ps);

    for (const lc of locClusters) {
      const clusterDates = lc.photos.map(p => getPhotoDate(p)).filter(d => d.getTime() > 0).sort((a, b) => a.getTime() - b.getTime());
      const cStart = clusterDates[0] ?? start;
      const cEnd = clusterDates[clusterDates.length - 1] ?? end;
      const cRange = locClusters.length === 1
        ? range
        : fmt(cStart) === fmt(cEnd) ? fmt(cStart) : `${fmt(cStart)} – ${fmt(cEnd)}`;
      const locs = [...new Set(lc.photos.map(p => p.location?.split(",")[0]?.trim()).filter(Boolean))] as string[];
      trips.push({ id: `trip-${trips.length}`, name: lc.name, dateRange: cRange, photos: lc.photos, locations: locs });
    }
  }

  return trips.reverse();
}

const FILTERS: Filter[] = ["All", "With People", "Scenery"];
const filterIcons: Record<Filter, React.ElementType> = {
  "All": SlidersHorizontal, "With People": Users, "Scenery": ImageIcon,
};

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "all",   label: "All Time"   },
  { value: "week",  label: "This Week"  },
  { value: "month", label: "This Month" },
  { value: "year",  label: "This Year"  },
];

function isInDateRange(photo: MapPhoto, range: DateRange): boolean {
  if (range === "all") return true;
  const raw = photo.uploadedAt;
  if (!raw) return true;
  const date = new Date(raw);
  const now   = new Date();
  if (range === "week") {
    return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (range === "month") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  if (range === "year") {
    return date.getFullYear() === now.getFullYear();
  }
  return true;
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
      <p className="text-[10px] text-slate-400 font-medium mb-0.5">{label}</p>
      <p className="text-xs font-bold text-slate-700 break-all">{value}</p>
    </div>
  );
}

function ShareLinkModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-[440px] w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-slate-900">Share link ready!</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-400 mb-3">Anyone with this link can view the photo.</p>
        <div className="flex gap-2">
          <input readOnly value={url}
            className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-600 truncate outline-none" />
          <button onClick={handleCopy}
            className="px-4 py-2.5 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors whitespace-nowrap">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DiaryModal({
  tripName, loading, diary, error, cached, onClose, onRegenerate,
}: {
  tripName: string; loading: boolean; diary: string | null; error: string | null; cached: boolean;
  onClose: () => void; onRegenerate: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[3000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-[440px] w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-blue-500" />
            <p className="font-bold text-slate-900">{tripName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1"><X size={18} /></button>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
            <Loader2 size={16} className="animate-spin" /> Writing your diary...
          </div>
        )}
        {!loading && error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">{error}</p>
        )}
        {!loading && diary && (
          <>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{diary}</p>
            {cached && <p className="text-[11px] text-slate-400 mt-2">Saved earlier — no new API call.</p>}
            <button onClick={onRegenerate}
              className="mt-3 flex items-center gap-1.5 text-xs font-bold text-blue-500 hover:text-blue-700 transition-colors">
              <Sparkles size={12} /> Re-generate
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PhotoModal({
  photo, onClose, onDelete, onDownload, onShare, sharing, uid, onLandmarkSaved,
}: {
  photo: MapPhoto; onClose: () => void;
  onDelete: (id: string) => void; onDownload: (photo: MapPhoto) => void;
  onShare: (photo: MapPhoto) => void; sharing: boolean;
  uid: string | null;
  onLandmarkSaved: (photoId: string, result: { landmarkName: string | null; landmarkConfidence: string | null; landmarkDescription: string | null }) => void;
}) {
  const alreadyAnalyzed = !!photo.landmarkAnalyzedAt;
  const [landmarkLoading, setLandmarkLoading] = useState(false);
  const [landmarkResult,  setLandmarkResult]  = useState<{ landmark: string | null; description: string | null } | null>(
    alreadyAnalyzed ? { landmark: photo.landmarkName ?? null, description: photo.landmarkDescription ?? null } : null,
  );
  const [landmarkError,   setLandmarkError]   = useState<string | null>(null);
  const [isReanalyzing,   setIsReanalyzing]   = useState(false);
  const [showStoryCard,   setShowStoryCard]   = useState(false);

  // A photo already carries its cached landmark_* fields from Supabase — this only
  // resets local state when the modal is reopened on a *different* photo, not on every
  // prop change (a fresh analysis already updates local state directly, see above).
  useEffect(() => {
    setLandmarkResult(photo.landmarkAnalyzedAt
      ? { landmark: photo.landmarkName ?? null, description: photo.landmarkDescription ?? null }
      : null);
    setLandmarkError(null);
    setIsReanalyzing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id]);

  async function handleRecognizeLandmark() {
    setLandmarkLoading(true);
    setLandmarkError(null);
    try {
      const imgRes = await fetch(photo.imageUrl);
      const rawBlob = await imgRes.blob();
      const resizedBlob = await resizeImageForApi(rawBlob);
      const form = new FormData();
      form.append("file", resizedBlob, photo.fileName || "photo.jpg");
      const qs = photo.lat != null && photo.lng != null ? `?lat=${photo.lat}&lng=${photo.lng}` : "";
      const res = await fetch(`${BACKEND_URL}/recognize-landmark${qs}`, { method: "POST", body: form });
      const data = await res.json();
      if (data.error) {
        setLandmarkError(data.error);
        return;
      }
      const result = { landmark: data.landmark ?? null, description: data.description ?? null };
      setLandmarkResult(result);
      if (uid) {
        const saved = {
          landmarkName: result.landmark,
          landmarkConfidence: data.confidence ?? null,
          landmarkDescription: result.description,
        };
        await saveLandmarkResult(uid, photo.id, saved);
        onLandmarkSaved(photo.id, saved);
      }
    } catch {
      setLandmarkError("백엔드 서버에 연결할 수 없어요.");
    } finally {
      setLandmarkLoading(false);
      setIsReanalyzing(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/85 z-[2000] flex items-center justify-center p-5" onClick={onClose}>
      <div className="max-w-[520px] w-full bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-sm truncate">{photo.fileName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {photo.location?.split(",")[0] || "Unknown location"} · {photo.captureDate || photo.uploadedAt?.slice(0, 10) || ""}
            </p>
          </div>
          <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-700 transition-colors p-1">
            <X size={20} />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.imageUrl} alt={photo.fileName} className="w-full max-h-[420px] object-contain bg-slate-100" />
        <div className="p-4 grid grid-cols-2 gap-2">
          {photo.captureDate && photo.captureDate !== "Not available" && <InfoChip label="Taken" value={photo.captureDate} />}
          {photo.location && <div className="col-span-2"><InfoChip label="Location" value={photo.location} /></div>}
          <InfoChip label="AI label" value={(photo.faceCount ?? 0) > 0 ? `With people (${photo.faceCount})` : "Scenery"} />
          {!landmarkResult && (
            <button onClick={handleRecognizeLandmark} disabled={landmarkLoading}
              className="flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors disabled:opacity-60">
              {landmarkLoading
                ? <><Loader2 size={12} className="animate-spin" /> Checking...</>
                : <><Sparkles size={12} /> {landmarkError ? "Retry" : "Identify Landmark"}</>
              }
            </button>
          )}
          {!landmarkResult && landmarkError && <div className="col-span-2"><InfoChip label="Landmark" value={landmarkError} /></div>}
          {landmarkResult && (
            <div className="col-span-2 space-y-1.5">
              <InfoChip
                label="Landmark"
                value={landmarkResult.landmark
                  ? `${landmarkResult.landmark}${landmarkResult.description ? ` — ${landmarkResult.description}` : ""}`
                  : "No landmark recognized"}
              />
              <button
                onClick={() => { setIsReanalyzing(true); handleRecognizeLandmark(); }}
                disabled={landmarkLoading}
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-60">
                {isReanalyzing && landmarkLoading
                  ? <><Loader2 size={10} className="animate-spin" /> Re-analyzing...</>
                  : <><Sparkles size={10} /> Re-analyze</>
                }
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-4 pt-3 border-t border-slate-100">
          <button onClick={() => setShowStoryCard(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-violet-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-violet-600 transition-colors">
            <LayoutTemplate size={15} /> Story
          </button>
          <button onClick={() => onShare(photo)} disabled={sharing}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-60">
            {sharing ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />} Share
          </button>
        </div>
        <div className="flex gap-2 px-4 pt-2 pb-3">
          <button onClick={() => onDownload(photo)}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors">
            <Download size={15} /> Download
          </button>
          <button onClick={() => { onClose(); onDelete(photo.id); }}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors">
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>
      {showStoryCard && (
        <ShareCardModal
          title="Story Card"
          fileName={`travelries-${photo.id}.png`}
          onClose={() => setShowStoryCard(false)}
          draw={(ctx, w, h) => drawPhotoStoryCard(ctx, w, h, photo)}
        />
      )}
    </div>
  );
}

function DeleteConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[4000] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={22} className="text-red-500" />
        </div>
        <h2 className="text-lg font-black text-slate-900 text-center mb-1">Delete this photo?</h2>
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

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function formatPhotoDate(raw: string | null | undefined): string {
  if (!raw || raw === "Not available" || raw === "날짜 없음") return "No date";
  let date = new Date(raw);
  if (isNaN(date.getTime())) {
    const m = raw.match(/(\d{4})[.\-\s]+(\d{1,2})[.\-\s]+(\d{1,2})/);
    if (m) date = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  }
  if (!date || isNaN(date.getTime())) return raw;
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${mo}.${d}`;
}

function AlbumsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {[0, 1].map((g) => (
        <div key={g} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <div className="w-4 h-4 bg-slate-200 rounded-full" />
            <div className="h-4 bg-slate-200 rounded-full w-32" />
            <div className="ml-auto h-5 bg-slate-200 rounded-full w-10" />
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <div className="w-full h-36 bg-slate-200" />
                <div className="p-2.5 space-y-2">
                  <div className="h-3 bg-slate-200 rounded-full w-3/4" />
                  <div className="h-3 bg-slate-200 rounded-full w-1/2" />
                  <div className="h-7 bg-slate-200 rounded-lg w-full mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AlbumsPage() {
  const [photos,           setPhotos]           = useState<MapPhoto[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [filter,           setFilter]           = useState<Filter>("All");
  const [dateRange,        setDateRange]        = useState<DateRange>("all");
  const [searchQuery,      setSearchQuery]      = useState("");
  const [selectedPhoto,    setSelectedPhoto]    = useState<MapPhoto | null>(null);
  const [savedIds,         setSavedIds]         = useState<Set<string>>(new Set());
  const [sharingId,        setSharingId]        = useState<string | null>(null);
  const [shareResultUrl,   setShareResultUrl]   = useState<string | null>(null);
  const [confirmDeleteId,  setConfirmDeleteId]  = useState<string | null>(null);
  const [personFilterNames, setPersonFilterNames] = useState<Set<string> | null>(null);
  const [personFilterLabel, setPersonFilterLabel] = useState<string | null>(null);
  const [viewMode,          setViewMode]          = useState<"monthly" | "trips">("monthly");
  const [expandedTripId,    setExpandedTripId]    = useState<string | null>(null);
  const [diaryTrip,         setDiaryTrip]         = useState<Trip | null>(null);
  const [diaryLoading,      setDiaryLoading]      = useState(false);
  const [diaryText,         setDiaryText]         = useState<string | null>(null);
  const [diaryError,        setDiaryError]        = useState<string | null>(null);
  const [diaryCached,       setDiaryCached]       = useState(false);
  const [uid,               setUid]               = useState<string | null>(null);

  async function handleGenerateDiary(trip: Trip, forceRegenerate = false) {
    setDiaryTrip(trip);
    setDiaryLoading(true);
    setDiaryText(null);
    setDiaryError(null);
    setDiaryCached(false);
    const key = tripKeyOf(trip);
    try {
      if (!forceRegenerate && uid) {
        const cached = await fetchTripDiary(uid, key);
        if (cached) {
          setDiaryText(cached);
          setDiaryCached(true);
          return; // cache hit — no Claude call
        }
      }
      const res = await fetch(`${BACKEND_URL}/generate-diary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: "ko",
          entries: trip.photos.map((p) => ({
            fileName: p.fileName,
            location: p.location,
            captureDate: p.captureDate,
            captureTime: p.captureTime,
            faceCount: p.faceCount ?? 0,
          })),
        }),
      });
      const data = await res.json();
      if (data.diary) {
        setDiaryText(data.diary);
        if (uid) await saveTripDiary(uid, key, data.diary, "ko");
      } else {
        setDiaryError(data.error ?? "일기를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    } catch {
      setDiaryError("백엔드 서버에 연결할 수 없어요 (uvicorn이 꺼져있을 수 있어요).");
    } finally {
      setDiaryLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const resolvedUid = user?.id ?? "guest";
      setUid(resolvedUid === "guest" ? null : resolvedUid);
      const stored = resolvedUid === "guest" ? [] : await fetchMapPhotos(resolvedUid);
      setPhotos(stored);
      setSavedIds(await getSavedIds());
      setLoading(false);
      const params = new URLSearchParams(window.location.search);
      const faceNames = params.get("faceNames");
      if (faceNames) {
        setPersonFilterNames(new Set(faceNames.split(",")));
        setPersonFilterLabel(params.get("personLabel"));
      }
    }
    load();
  }, []);

  function handleLandmarkSaved(
    photoId: string,
    result: { landmarkName: string | null; landmarkConfidence: string | null; landmarkDescription: string | null },
  ) {
    setPhotos((prev) => prev.map((p) => p.id === photoId
      ? { ...p, landmarkName: result.landmarkName ?? undefined, landmarkConfidence: result.landmarkConfidence ?? undefined, landmarkDescription: result.landmarkDescription ?? undefined, landmarkAnalyzedAt: new Date().toISOString() }
      : p));
    setSelectedPhoto((prev) => prev && prev.id === photoId
      ? { ...prev, landmarkName: result.landmarkName ?? undefined, landmarkConfidence: result.landmarkConfidence ?? undefined, landmarkDescription: result.landmarkDescription ?? undefined, landmarkAnalyzedAt: new Date().toISOString() }
      : prev);
  }

  async function handleToggleSaved(e: React.MouseEvent, photo: MapPhoto) {
    e.stopPropagation();
    const nowSaved = await toggleSaved(photo.id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nowSaved) next.add(photo.id); else next.delete(photo.id);
      return next;
    });
  }

  async function handleDelete(id: string) {
    const fileName = photos.find((p) => p.id === id)?.fileName;
    await deletePhotoEverywhere(id, fileName);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setConfirmDeleteId(null);
  }

  function handleDownload(photo: MapPhoto) {
    const a = document.createElement("a");
    a.href = photo.imageUrl;
    a.download = photo.fileName;
    a.click();
  }

  async function handleShare(photo: MapPhoto) {
    setSharingId(photo.id);
    try {
      const url = await sharePhoto(photo);
      setShareResultUrl(url);
    } catch (err) {
      alert(`Failed to create share link:\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSharingId(null);
    }
  }

  function clearAllFilters() {
    setSearchQuery("");
    setFilter("All");
    setDateRange("all");
  }

  const counts = useMemo(() => ({
    "All":         photos.length,
    "With People": photos.filter((p) => (p.faceCount ?? 0) > 0).length,
    "Scenery":     photos.filter((p) => (p.faceCount ?? 0) === 0).length,
  }), [photos]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return photos.filter((p) => {
      if (filter === "With People" && (p.faceCount ?? 0) === 0) return false;
      if (filter === "Scenery"     && (p.faceCount ?? 0) > 0)  return false;
      if (!isInDateRange(p, dateRange)) return false;
      if (personFilterNames && !personFilterNames.has(p.fileName)) return false;
      if (q) {
        const inName     = p.fileName.toLowerCase().includes(q);
        const inLocation = (p.location ?? "").toLowerCase().includes(q);
        if (!inName && !inLocation) return false;
      }
      return true;
    });
  }, [photos, filter, dateRange, searchQuery, personFilterNames]);

  const trips = useMemo(() => detectTrips(filtered), [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<string, { photos: MapPhoto[]; sortDate: number }>();
    for (const photo of filtered) {
      const raw = (photo.captureDate && photo.captureDate !== "Not available" && photo.captureDate !== "날짜 없음")
        ? photo.captureDate
        : photo.uploadedAt;
      let date = raw ? new Date(raw) : null;
      if (date && isNaN(date.getTime())) {
        const m = raw!.match(/(\d{4})[.\-\s]+(\d{1,2})[.\-\s]+(\d{1,2})/);
        if (m) date = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      }
      const valid = date && !isNaN(date.getTime()) && date.getFullYear() > 1970;
      const key = valid ? `${MONTHS[date!.getMonth()]} ${date!.getFullYear()}` : "Unknown date";
      const sortDate = valid ? new Date(date!.getFullYear(), date!.getMonth(), 1).getTime() : 0;
      if (!map.has(key)) map.set(key, { photos: [], sortDate });
      map.get(key)!.photos.push(photo);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].sortDate - a[1].sortDate)
      .map(([key, { photos }]) => [key, photos] as [string, MapPhoto[]]);
  }, [filtered]);

  const isFiltering = searchQuery.trim() !== "" || filter !== "All" || dateRange !== "all";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
            <Images size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Albums</h1>
            <p className="text-slate-500 text-sm">Browse your saved travel photos by date.</p>
          </div>
        </div>

        {/* Person filter banner */}
        {personFilterNames && (
          <div className="flex items-center gap-2 mb-4 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
            <Users size={14} className="text-blue-600 flex-shrink-0" />
            <p className="text-sm font-bold text-blue-700 flex-1">
              Photos of <span className="text-blue-900">{personFilterLabel || "person"}</span>
            </p>
            <button
              onClick={() => {
                setPersonFilterNames(null);
                setPersonFilterLabel(null);
                window.history.replaceState({}, "", "/albums");
              }}
              className="text-blue-400 hover:text-blue-600 transition-colors p-1">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename or location..."
            className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all shadow-sm"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 flex-wrap mb-3">
          {FILTERS.map((f) => {
            const active = filter === f;
            const Icon = filterIcons[f];
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}>
                <Icon size={14} />
                {f}
                <span className={`ml-0.5 text-xs ${active ? "text-blue-100" : "text-slate-400"}`}>{counts[f]}</span>
              </button>
            );
          })}
        </div>

        {/* Date range chips */}
        <div className="flex gap-2 flex-wrap mb-5">
          {DATE_RANGES.map(({ value, label }) => {
            const active = dateRange === value;
            return (
              <button key={value} onClick={() => setDateRange(value)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  active ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}>
                <Calendar size={12} />
                {label}
              </button>
            );
          })}
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1.5 mb-4 bg-white rounded-2xl p-1.5 border border-slate-100 shadow-sm">
          {([
            { key: "monthly" as const, label: "By Month", icon: CalendarDays },
            { key: "trips"   as const, label: "Trips",    icon: MapPin       },
          ]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setViewMode(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                viewMode === key
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Result count + clear */}
        {photos.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-400">
              {isFiltering
                ? <><strong className="text-slate-700">{filtered.length}</strong> found (total {photos.length})</>
                : <><strong className="text-slate-700">{photos.length}</strong> photos</>
              }
            </p>
            {isFiltering && (
              <button onClick={clearAllFilters}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* Grid, skeleton, or empty state */}
        {loading ? <AlbumsSkeleton /> : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              {isFiltering
                ? <Search size={28} className="text-slate-300" />
                : <Images size={28} className="text-slate-300" />
              }
            </div>
            <p className="font-bold text-slate-700 mb-1">
              {isFiltering ? "No results found" : filter === "All" ? "No photos yet" : filter === "With People" ? "No photos with people" : "No scenery photos"}
            </p>
            <p className="text-slate-400 text-sm">
              {isFiltering
                ? <button onClick={clearAllFilters} className="text-violet-500 font-semibold hover:underline">reset filters</button>
                : "Upload photos from the home screen."
              }
            </p>
          </div>
        ) : viewMode === "trips" ? (
          trips.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
              <MapPin size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-700 mb-1">No trips detected</p>
              <p className="text-slate-400 text-sm">Photos need date info to be grouped into trips.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {trips.map((trip) => {
                const isExpanded = expandedTripId === trip.id;
                const n = trip.photos.length;
                const photoWord = n === 1 ? "photo" : "photos";
                return (
                <div key={trip.id} className="rounded-3xl overflow-hidden shadow-md bg-white border border-slate-100">

                  {/* ── Cover collage with gradient overlay ── */}
                  <div className="relative h-52 overflow-hidden cursor-pointer"
                    onClick={() => trip.photos[0] && setSelectedPhoto(trip.photos[0])}>
                    {n >= 4 ? (
                      <div className="grid grid-cols-2 h-full gap-0.5">
                        {trip.photos.slice(0, 4).map((photo, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={i} src={photo.imageUrl} alt="" onClick={(e) => { e.stopPropagation(); setSelectedPhoto(photo); }}
                            className="w-full h-full object-cover hover:brightness-95 transition-all" />
                        ))}
                      </div>
                    ) : n >= 2 ? (
                      <div className="flex h-full gap-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={trip.photos[0].imageUrl} alt="" onClick={(e) => { e.stopPropagation(); setSelectedPhoto(trip.photos[0]); }}
                          className="flex-[2] h-full object-cover hover:brightness-95 transition-all" />
                        <div className="flex flex-col gap-0.5 flex-1">
                          {trip.photos.slice(1, 3).map((photo, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={photo.imageUrl} alt="" onClick={(e) => { e.stopPropagation(); setSelectedPhoto(photo); }}
                              className="flex-1 w-full object-cover hover:brightness-95 transition-all" />
                          ))}
                        </div>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={trip.photos[0].imageUrl} alt=""
                        className="w-full h-full object-cover" />
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />

                    {/* Photo count badge top-right */}
                    <div className="absolute top-3.5 right-3.5 bg-black/40 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full pointer-events-none">
                      {n} {photoWord}
                    </div>

                    {/* Location + date at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pointer-events-none">
                      <div className="flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <MapPin size={14} className="text-white/90 flex-shrink-0" />
                            <h2 className="font-black text-white text-lg leading-tight truncate drop-shadow">{trip.name}</h2>
                          </div>
                          {trip.locations.length > 1 && (
                            <p className="text-white/70 text-xs ml-[22px] truncate">{trip.locations.slice(1, 3).join(" · ")}</p>
                          )}
                        </div>
                        <p className="text-white/70 text-xs flex-shrink-0 text-right leading-snug">{trip.dateRange}</p>
                      </div>
                    </div>
                  </div>

                  {/* ── View all / AI diary ── */}
                  <div className="flex divide-x divide-slate-100 border-t border-slate-100">
                    <button
                      onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-blue-500 hover:text-blue-700 hover:bg-blue-50 py-3 transition-colors">
                      {isExpanded
                        ? <><span className="text-xs">▲</span> Hide</>
                        : <><span className="text-xs">▼</span> View all {n} {photoWord}</>
                      }
                    </button>
                    <button
                      onClick={() => handleGenerateDiary(trip)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-sm font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 py-3 transition-colors">
                      <Sparkles size={14} /> AI Diary
                    </button>
                  </div>

                  {/* ── Expanded grid ── */}
                  {isExpanded && (
                    <div className="px-3 pb-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                      {trip.photos.map((photo) => (
                        <div key={photo.id} onClick={() => setSelectedPhoto(photo)}
                          className="cursor-pointer rounded-xl overflow-hidden group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.imageUrl} alt={photo.fileName}
                            className="w-full h-28 object-cover group-hover:brightness-90 transition-all" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )
        ) : (
          <>
            {grouped.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 mb-4" style={{ scrollbarWidth: "none" }}>
                {grouped.map(([groupName]) => (
                  <button key={groupName}
                    onClick={() => document.getElementById(`group-${groupName}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all whitespace-nowrap shadow-sm">
                    <CalendarDays size={11} />
                    {groupName}
                  </button>
                ))}
              </div>
            )}
          <div className="space-y-5">
            {grouped.map(([groupName, items]) => (
              <section key={groupName} id={`group-${groupName}`} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                  <CalendarDays size={16} className="text-blue-500 flex-shrink-0" />
                  <h2 className="font-bold text-slate-800 text-base flex-1">{groupName}</h2>
                  <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{items.length} photos</span>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {items.map((photo) => {
                    const isPortrait = (photo.faceCount ?? 0) > 0;
                    return (
                      <div key={photo.id} onClick={() => setSelectedPhoto(photo)}
                        className="photo-card rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.imageUrl} alt={photo.fileName} className="w-full h-36 object-contain bg-slate-100" />
                        <div className="p-2.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5 ${
                            isPortrait ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {isPortrait ? <Users size={9} /> : <ImageIcon size={9} />}
                            {isPortrait ? "Person" : "Scene"}
                          </span>
                          <p className="font-bold text-slate-800 text-xs truncate">{photo.fileName}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <CalendarDays size={9} />{formatPhotoDate(photo.captureDate)}
                          </p>
                          <div className="flex gap-1.5 mt-2">
                            <button onClick={(e) => handleToggleSaved(e, photo)}
                              className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                                savedIds.has(photo.id) ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                              }`}>
                              <Star size={11} className={savedIds.has(photo.id) ? "fill-amber-500" : ""} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleShare(photo); }} disabled={sharingId === photo.id}
                              className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors disabled:opacity-50">
                              {sharingId === photo.id ? <Loader2 size={11} className="animate-spin" /> : <Share2 size={11} />}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDownload(photo); }}
                              className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                              <Download size={11} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(photo.id); }}
                              className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          </>
        )}
      </div>

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onDelete={(id) => { setSelectedPhoto(null); setConfirmDeleteId(id); }}
          onDownload={handleDownload}
          onShare={handleShare}
          sharing={sharingId === selectedPhoto.id}
          uid={uid}
          onLandmarkSaved={handleLandmarkSaved}
        />
      )}
      {confirmDeleteId && (
        <DeleteConfirmModal
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {shareResultUrl && <ShareLinkModal url={shareResultUrl} onClose={() => setShareResultUrl(null)} />}
      {diaryTrip && (
        <DiaryModal
          tripName={diaryTrip.name}
          loading={diaryLoading}
          diary={diaryText}
          error={diaryError}
          cached={diaryCached}
          onClose={() => setDiaryTrip(null)}
          onRegenerate={() => handleGenerateDiary(diaryTrip, true)}
        />
      )}
      <BottomNav />
    </main>
  );
}
