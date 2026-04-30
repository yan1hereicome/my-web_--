"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import BottomNav from "@/components/BottomNav";
import { MapPin, ArrowLeft, Trash2, X, CalendarDays, Clock, ChevronLeft, ChevronRight } from "lucide-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  iconUrl:       "/leaflet/marker-icon.png",
  shadowUrl:     "/leaflet/marker-shadow.png",
});

type MapPhoto = {
  id: string;
  fileName: string;
  imageUrl: string;
  lat: number;
  lng: number;
  location?: string;
  captureDate?: string;
  captureTime?: string;
  uploadedAt?: string;
  faceCount?: number;
};

type Cluster = { key: string; lat: number; lng: number; photos: MapPhoto[] };

const STORAGE_KEY = "photoMapPhotos";

function makeClusterIcon(photo: MapPhoto, count: number): L.DivIcon {
  const badge = count > 1
    ? `<span style="position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;border-radius:50%;width:20px;height:20px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:20px;">${count}</span>`
    : "";
  return L.divIcon({
    html: `<div style="position:relative;width:52px;height:52px;border-radius:50%;border:3px solid #2563eb;box-shadow:0 2px 10px rgba(0,0,0,0.3);overflow:visible;background:white;">
      <img src="${photo.imageUrl}" style="width:52px;height:52px;object-fit:cover;border-radius:50%;display:block;" />
      ${badge}
    </div>`,
    className: "",
    iconSize:   [52, 52],
    iconAnchor: [26, 26],
  });
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
  const [idx, setIdx] = useState(0);
  const photo = cluster.photos[idx];
  const total = cluster.photos.length;

  return (
    <div
      className="fixed inset-0 bg-black/88 z-[3000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-[520px] w-full overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 text-sm truncate">{photo.fileName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {photo.location?.split(",")[0] || "위치 정보 없음"} · {photo.captureDate || photo.uploadedAt || ""}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            {total > 1 && (
              <span className="text-xs text-slate-400 font-semibold">{idx + 1} / {total}</span>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.imageUrl} alt={photo.fileName}
          className="w-full max-h-[420px] object-contain bg-slate-100" />

        {/* Navigation for clusters */}
        {total > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                idx === 0
                  ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                  : "bg-slate-900 text-white hover:bg-slate-700"
              }`}
            >
              <ChevronLeft size={16} /> 이전
            </button>

            <div className="flex gap-1.5 overflow-x-auto max-w-[55%]">
              {cluster.photos.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => setIdx(i)}
                  className={`w-9 h-9 rounded-lg overflow-hidden cursor-pointer flex-shrink-0 border-2 transition-all ${
                    i === idx ? "border-blue-500" : "border-slate-200"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={p.fileName} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            <button
              onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
              disabled={idx === total - 1}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                idx === total - 1
                  ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                  : "bg-slate-900 text-white hover:bg-slate-700"
              }`}
            >
              다음 <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Info grid */}
        <div className="p-4 grid grid-cols-2 gap-2 border-t border-slate-100">
          {photo.captureDate && photo.captureDate !== "Not available" && (
            <InfoChip label="촬영일" value={photo.captureDate} />
          )}
          {photo.captureTime && photo.captureTime !== "Not available" && (
            <InfoChip label="촬영 시간" value={photo.captureTime} />
          )}
          {photo.location && (
            <div className="col-span-2">
              <InfoChip label="위치" value={photo.location} />
            </div>
          )}
          {(photo.faceCount ?? 0) > 0 && (
            <InfoChip label="감지된 얼굴" value={`${photo.faceCount}명`} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  const [photos, setPhotos] = useState<MapPhoto[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  });
  const [activeCluster, setActiveCluster] = useState<Cluster | null>(null);

  const clusters = useMemo<Cluster[]>(() => {
    const map: Record<string, Cluster> = {};
    photos.forEach((p) => {
      const key = `${Math.round(p.lat * 100)},${Math.round(p.lng * 100)}`;
      if (!map[key]) map[key] = { key, lat: p.lat, lng: p.lng, photos: [] };
      map[key].photos.push(p);
    });
    return Object.values(map);
  }, [photos]);

  const center = useMemo<[number, number]>(() => {
    if (photos.length === 0) return [36.5, 127.8];
    return [photos[0].lat, photos[0].lng];
  }, [photos]);

  void useEffect;

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY);
    setPhotos([]);
    setActiveCluster(null);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <MapPin size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Photo Map</h1>
              <p className="text-slate-500 text-sm">마커를 클릭하면 사진 전체보기</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft size={15} /> Back
            </Link>
            {photos.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors"
              >
                <Trash2 size={15} /> 전체 삭제
              </button>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="h-[600px] w-full rounded-2xl overflow-hidden shadow-sm border border-slate-200 mb-6">
          <MapContainer center={center} zoom={7} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {clusters.map((cluster) => (
              <Marker
                key={cluster.key}
                position={[cluster.lat, cluster.lng]}
                icon={makeClusterIcon(cluster.photos[0], cluster.photos.length)}
                eventHandlers={{ click: () => setActiveCluster(cluster) }}
              />
            ))}
          </MapContainer>
        </div>

        {/* Photo list */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <MapPin size={16} className="text-emerald-500" />
            <h2 className="font-bold text-slate-800">Saved Photos</h2>
            <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full ml-auto">{photos.length}장</span>
          </div>

          {photos.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-slate-400 text-sm">아직 저장된 사진이 없습니다. 홈에서 사진을 업로드하고 저장해보세요.</p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => {
                    const c = clusters.find((cl) => cl.photos.some((p) => p.id === photo.id));
                    if (c) setActiveCluster(c);
                  }}
                  className="photo-card bg-slate-50 rounded-xl overflow-hidden cursor-pointer border border-slate-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.imageUrl}
                    alt={photo.fileName}
                    className="w-full h-24 object-contain bg-slate-100"
                  />
                  <div className="p-2">
                    <p className="font-bold text-slate-800 text-[11px] truncate">{photo.fileName}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                      <CalendarDays size={8} /> {photo.captureDate || "날짜 없음"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {activeCluster && (
        <PhotoModal cluster={activeCluster} onClose={() => setActiveCluster(null)} />
      )}
      <BottomNav />
    </main>
  );
}
