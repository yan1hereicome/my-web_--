"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.heat";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabase";
import { MapPhoto } from "@/lib/types";
import { fetchMapPhotos } from "@/lib/photosApi";
import { deletePhotoEverywhere } from "@/lib/savedUtils";
import { MapPin, ArrowLeft, Trash2, X, CalendarDays, ChevronLeft, ChevronRight, Share2, Loader2, Route, Flame } from "lucide-react";
import { sharePhoto } from "@/lib/shareUtils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl:       "/leaflet/marker-icon.png",
  shadowUrl:     "/leaflet/marker-shadow.png",
});

type Cluster = { key: string; lat: number; lng: number; photos: MapPhoto[] };

function makeClusterIcon(photo: MapPhoto, count: number): L.DivIcon {
  const badge = count > 1
    ? `<span style="position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:20px;">${count}</span>`
    : "";
  return L.divIcon({
    html: `<div style="position:relative;width:52px;height:52px;border-radius:50%;border:3px solid #2563eb;box-shadow:0 2px 10px rgba(0,0,0,0.3);overflow:visible;background:white;">
      <img src="${photo.imageUrl}" style="width:52px;height:52px;object-fit:cover;border-radius:50%;display:block;" />
      ${badge}
    </div>`,
    className: "", iconSize: [52, 52], iconAnchor: [26, 26],
  });
}

function bearingDeg(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1] = [toRad(a[0]), toRad(a[1])];
  const [lat2, lon2] = [toRad(b[0]), toRad(b[1])];
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function makeArrowIcon(bearing: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:24px;height:24px;transform:rotate(${bearing}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.35));">
      <svg width="24" height="24" viewBox="0 0 24 24"><path d="M12 3 L19 20 L12 15.5 L5 20 Z" fill="#2563eb" stroke="white" stroke-width="1.6" stroke-linejoin="round" /></svg>
    </div>`,
    className: "", iconSize: [24, 24], iconAnchor: [12, 12],
  });
}

function RouteLayer({ positions }: { positions: [number, number][] }) {
  const segments = useMemo(() => {
    const segs: { key: string; mid: [number, number]; bearing: number }[] = [];
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i], b = positions[i + 1];
      if (a[0] === b[0] && a[1] === b[1]) continue; // same spot, no arrow needed
      segs.push({
        key: `${i}`,
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        bearing: bearingDeg(a, b),
      });
    }
    return segs;
  }, [positions]);

  return (
    <>
      {/* White casing underneath so the route reads clearly against any tile color */}
      <Polyline positions={positions} pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9, lineCap: "round", lineJoin: "round" }} interactive={false} />
      <Polyline positions={positions} pathOptions={{ color: "#2563eb", weight: 4, opacity: 1, lineCap: "round", lineJoin: "round", dashArray: "14 12", className: "route-flow-line" }} interactive={false} />
      {segments.map((seg) => (
        <Marker key={seg.key} position={seg.mid} icon={makeArrowIcon(seg.bearing)} interactive={false} />
      ))}
    </>
  );
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const layer = L.heatLayer(points, { radius: 30, blur: 22, maxZoom: 12 }).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, points]);

  return null;
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
      <p className="text-[10px] text-slate-400 font-medium mb-0.5">{label}</p>
      <p className="text-xs font-bold text-slate-700 break-all">{value}</p>
    </div>
  );
}

function PhotoModal({ cluster, onClose }: { cluster: Cluster; onClose: () => void }) {
  const [idx,          setIdx]          = useState(0);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl,     setShareUrl]     = useState<string | null>(null);
  const [copied,       setCopied]       = useState(false);
  const photo = cluster.photos[idx];
  const total = cluster.photos.length;

  useEffect(() => { setShareUrl(null); setCopied(false); }, [idx]);

  async function handleShare() {
    setShareLoading(true);
    try {
      const url = await sharePhoto(photo);
      setShareUrl(url);
    } catch (err) {
      alert(`Failed to create share link:\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setShareLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(shareUrl!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/88 z-[3000] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-[520px] w-full overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 text-sm truncate">{photo.fileName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {photo.location?.split(",")[0] || "Unknown location"} · {photo.captureDate || photo.uploadedAt?.slice(0, 10) || ""}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            {total > 1 && <span className="text-xs text-slate-400 font-semibold">{idx + 1} / {total}</span>}
            <button onClick={handleShare} disabled={shareLoading}
              className="text-slate-400 hover:text-blue-500 transition-colors p-1" title="Share">
              {shareLoading ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1"><X size={20} /></button>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.imageUrl} alt={photo.fileName} className="w-full max-h-[420px] object-contain bg-slate-100" />
        {total > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${idx === 0 ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-700"}`}>
              <ChevronLeft size={16} /> Prev
            </button>
            <div className="flex gap-1.5 overflow-x-auto max-w-[55%]">
              {cluster.photos.map((p, i) => (
                <div key={p.id} onClick={() => setIdx(i)}
                  className={`w-9 h-9 rounded-lg overflow-hidden cursor-pointer flex-shrink-0 border-2 transition-all ${i === idx ? "border-blue-500" : "border-slate-200"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={p.fileName} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <button onClick={() => setIdx((i) => Math.min(total - 1, i + 1))} disabled={idx === total - 1}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${idx === total - 1 ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-700"}`}>
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
        <div className="p-4 grid grid-cols-2 gap-2 border-t border-slate-100">
          {photo.captureDate && photo.captureDate !== "Not available" && <InfoChip label="Taken" value={photo.captureDate} />}
          {photo.location && <div className="col-span-2"><InfoChip label="Location" value={photo.location} /></div>}
          {(photo.faceCount ?? 0) > 0 && <InfoChip label="Faces detected" value={`${photo.faceCount}`} />}
        </div>
        {shareUrl && (
          <div className="px-4 py-3 border-t border-emerald-100 bg-emerald-50">
            <p className="text-xs font-bold text-emerald-700 mb-2">Share link ready!</p>
            <div className="flex gap-2">
              <input readOnly value={shareUrl}
                className="flex-1 text-xs bg-white border border-emerald-200 rounded-lg px-3 py-2 text-slate-600 truncate outline-none" />
              <button onClick={handleCopy}
                className="px-3 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors whitespace-nowrap">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>
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
        <h2 className="text-lg font-black text-slate-900 text-center mb-1">Delete All Photos?</h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          Once deleted, recovery is not possible.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">
            Back
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

export default function MapPage() {
  const [photos,        setPhotos]        = useState<MapPhoto[]>([]);
  const [activeCluster, setActiveCluster] = useState<Cluster | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRoute,   setShowRoute]   = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? "guest";
      const stored = uid === "guest" ? [] : await fetchMapPhotos(uid);
      setPhotos(stored.filter((p) => p.lat != null && p.lng != null));
    }
    load();
  }, []);

  const clusters = useMemo<Cluster[]>(() => {
    const map: Record<string, Cluster> = {};
    photos.forEach((p) => {
      const key = `${Math.round(p.lat! * 100)},${Math.round(p.lng! * 100)}`;
      if (!map[key]) map[key] = { key, lat: p.lat!, lng: p.lng!, photos: [] };
      map[key].photos.push(p);
    });
    return Object.values(map);
  }, [photos]);

  const center = useMemo<[number, number]>(() => {
    if (photos.length === 0) return [36.5, 127.8];
    return [photos[0].lat!, photos[0].lng!];
  }, [photos]);

  // captureDate/captureTime are locale-formatted display strings and aren't reliably
  // sortable — captureTimestamp (ISO) is the real chronological key, falling back to
  // uploadedAt for photos saved before that field existed.
  const routePositions = useMemo<[number, number][]>(() => {
    const sorted = [...photos].sort((a, b) => {
      const ta = a.captureTimestamp ?? a.uploadedAt ?? "";
      const tb = b.captureTimestamp ?? b.uploadedAt ?? "";
      return ta.localeCompare(tb);
    });
    return sorted.map((p) => [p.lat!, p.lng!]);
  }, [photos]);

  const heatPoints = useMemo<[number, number, number][]>(
    () => photos.map((p) => [p.lat!, p.lng!, 1]),
    [photos]
  );

  async function handleClear() {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? "guest";
    if (uid !== "guest") {
      for (const p of photos) {
        await deletePhotoEverywhere(p.id, p.fileName);
      }
    }
    setPhotos([]);
    setActiveCluster(null);
    setShowDeleteConfirm(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <MapPin size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Photo Map</h1>
              <p className="text-slate-500 text-sm">Click a marker to view photos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors">
              <ArrowLeft size={15} /> Back
            </Link>
            {photos.length > 0 && (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors">
                <Trash2 size={15} /> Delete All
              </button>
            )}
          </div>
        </div>

        {photos.length > 1 && (
          <div className="flex gap-2 mb-3">
            <button onClick={() => setShowRoute((v) => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                showRoute ? "bg-blue-500 border-blue-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              <Route size={14} /> Route
            </button>
            <button onClick={() => setShowHeatmap((v) => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                showHeatmap ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}>
              <Flame size={14} /> Heatmap
            </button>
          </div>
        )}

        <div className="h-[380px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 mb-6">
          <MapContainer center={center} zoom={7} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {showRoute && routePositions.length > 1 && <RouteLayer positions={routePositions} />}
            {showHeatmap && <HeatmapLayer points={heatPoints} />}
            {!showHeatmap && clusters.map((cluster) => (
              <Marker key={cluster.key} position={[cluster.lat, cluster.lng]}
                icon={makeClusterIcon(cluster.photos[0], cluster.photos.length)}
                eventHandlers={{ click: () => setActiveCluster(cluster) }} />
            ))}
          </MapContainer>
        </div>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <MapPin size={16} className="text-blue-500" />
            <h2 className="font-bold text-slate-800">Saved Photos</h2>
            <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full ml-auto">{photos.length} photos</span>
          </div>
          {photos.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-slate-400 text-sm">No photos saved yet. Upload photos from the home screen.</p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} onClick={() => { const c = clusters.find((cl) => cl.photos.some((p) => p.id === photo.id)); if (c) setActiveCluster(c); }}
                  className="photo-card bg-slate-50 rounded-xl overflow-hidden cursor-pointer border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.imageUrl} alt={photo.fileName} className="w-full h-24 object-contain bg-slate-100" />
                  <div className="p-2">
                    <p className="font-bold text-slate-800 text-[11px] truncate">{photo.fileName}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                      <CalendarDays size={8} /> {photo.captureDate || "No date"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {activeCluster && <PhotoModal cluster={activeCluster} onClose={() => setActiveCluster(null)} />}
      {showDeleteConfirm && (
        <DeleteConfirmModal onConfirm={handleClear} onCancel={() => setShowDeleteConfirm(false)} />
      )}
      <BottomNav />
    </main>
  );
}
