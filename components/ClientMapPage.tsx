"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import {useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import BottomNav from "@/components/BottomNav";

useEffect(() => {
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/leaflet/marker-icon-2x.png",
    iconUrl: "/leaflet/marker-icon.png",
    shadowUrl: "/leaflet/marker-shadow.png",
  });
}, []);

// ── 타입 ─────────────────────────────────────────────────────
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

type Cluster = {
  key: string;
  lat: number;
  lng: number;
  photos: MapPhoto[];
};

const STORAGE_KEY = "photoMapPhotos";

// ── 클러스터 마커 아이콘 (썸네일 + 개수 뱃지) ───────────────
function makeClusterIcon(photo: MapPhoto, count: number): L.DivIcon {
  const badge =
    count > 1
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

// ── 전체보기 모달 ─────────────────────────────────────────────
function PhotoModal({
  cluster,
  onClose,
}: {
  cluster: Cluster;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const photo = cluster.photos[idx];
  const total = cluster.photos.length;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
        zIndex: 3000, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white", borderRadius: "20px",
          maxWidth: "520px", width: "100%", overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              margin: 0, fontWeight: 700, fontSize: "15px",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {photo.fileName}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              {photo.location?.split(",")[0] || "위치 정보 없음"} ·{" "}
              {photo.captureDate || photo.uploadedAt || ""}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            {total > 1 && (
              <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>
                {idx + 1} / {total}
              </span>
            )}
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#64748b" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 전체 이미지 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt={photo.fileName}
          style={{
            width: "100%", maxHeight: "420px",
            objectFit: "contain", display: "block", background: "#f1f5f9",
          }}
        />

        {/* 같은 위치 여러 사진: 네비게이션 */}
        {total > 1 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", borderTop: "1px solid #f1f5f9",
          }}>
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              style={{
                background: idx === 0 ? "#f1f5f9" : "#0f172a",
                color: idx === 0 ? "#94a3b8" : "white",
                border: "none", borderRadius: "10px", padding: "8px 16px",
                fontWeight: 700, cursor: idx === 0 ? "default" : "pointer",
                fontSize: "13px",
              }}
            >
              ◀ 이전
            </button>

            {/* 썸네일 스트립 */}
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", maxWidth: "60%" }}>
              {cluster.photos.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => setIdx(i)}
                  style={{
                    width: "36px", height: "36px", borderRadius: "6px",
                    border: `2.5px solid ${i === idx ? "#2563eb" : "#e2e8f0"}`,
                    overflow: "hidden", cursor: "pointer", flexShrink: 0,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.imageUrl}
                    alt={p.fileName}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
              disabled={idx === total - 1}
              style={{
                background: idx === total - 1 ? "#f1f5f9" : "#0f172a",
                color: idx === total - 1 ? "#94a3b8" : "white",
                border: "none", borderRadius: "10px", padding: "8px 16px",
                fontWeight: 700, cursor: idx === total - 1 ? "default" : "pointer",
                fontSize: "13px",
              }}
            >
              다음 ▶
            </button>
          </div>
        )}

        {/* 상세 정보 */}
        <div style={{
          padding: "12px 18px", borderTop: "1px solid #e2e8f0",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px",
        }}>
          {photo.captureDate && photo.captureDate !== "Not available" && (
            <InfoChip label="촬영일" value={photo.captureDate} />
          )}
          {photo.captureTime && photo.captureTime !== "Not available" && (
            <InfoChip label="촬영 시간" value={photo.captureTime} />
          )}
          {photo.location && (
            <div style={{ gridColumn: "1 / -1" }}>
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

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "6px 10px" }}>
      <p style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: "12px", fontWeight: 700, wordBreak: "break-all" }}>{value}</p>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function MapPage() {
  const [photos] = useState<MapPhoto[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  });
  const [activeCluster, setActiveCluster] = useState<Cluster | null>(null);

  // 0.01° ≈ 1km 반경으로 클러스터링
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


  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", paddingBottom: "110px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>

        {/* 헤더 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "20px", gap: "12px", flexWrap: "wrap",
        }}>
          <div>
            <h1 style={{ fontSize: "48px", fontWeight: 800, margin: 0 }}>Photo Map</h1>
            <p style={{ color: "#475569", marginTop: "8px" }}>
              마커를 클릭하면 사진 전체보기 — 같은 위치 사진은 하나로 묶어서 보여줍니다.
            </p>
          </div>
          <Link href="/" style={{
            padding: "12px 18px", background: "#0f172a", color: "white",
            borderRadius: "12px", textDecoration: "none", fontWeight: 700,
          }}>
            Back to Upload
          </Link>
        </div>

        {/* 지도 */}
        <div style={{
          height: "640px", width: "100%", borderRadius: "18px",
          overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <MapContainer
            center={center}
            zoom={7}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
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

        {/* 저장된 사진 목록 */}
        <section style={{
          marginTop: "20px", background: "white", borderRadius: "18px",
          padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, marginTop: 0 }}>
            Saved Photos ({photos.length})
          </h2>
          {photos.length === 0 ? (
            <p style={{ color: "#64748b" }}>
              아직 저장된 사진이 없습니다. 홈에서 사진을 업로드하고 저장해보세요.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => {
                    const c = clusters.find((cl) => cl.photos.some((p) => p.id === photo.id));
                    if (c) setActiveCluster(c);
                  }}
                  style={{
                    background: "#f8fafc", borderRadius: "12px", overflow: "hidden",
                    cursor: "pointer", border: "1px solid #e2e8f0",
                    transition: "transform 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.imageUrl}
                    alt={photo.fileName}
                    style={{
                      width: "100%", height: "110px",
                      objectFit: "contain", background: "#f1f5f9", display: "block",
                    }}
                  />
                  <div style={{ padding: "8px 10px" }}>
                    <p style={{
                      margin: 0, fontWeight: 700, fontSize: "12px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {photo.fileName}
                    </p>
                    <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "11px" }}>
                      {photo.captureDate || "날짜 없음"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 전체보기 모달 */}
      {activeCluster && (
        <PhotoModal cluster={activeCluster} onClose={() => setActiveCluster(null)} />
      )}

      <BottomNav />
    </main>
  );
}
