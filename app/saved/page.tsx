'use client';

import dynamic from 'next/dynamic';

const MapPlaceholder = dynamic(() => import('../../components/MapPlaceholder'), {
  ssr: false,
});

export default function MapPage() {
  return <MapPlaceholder />;
}

import { useState } from "react";
import BottomNav from "@/components/BottomNav";

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

export const SAVED_KEY = "savedPhotos";

// ── 유틸: 즐겨찾기 토글 (다른 페이지에서도 사용) ──────────────
export function toggleSaved(photo: MapPhoto): boolean {
  const raw  = localStorage.getItem(SAVED_KEY);
  const list: MapPhoto[] = raw ? JSON.parse(raw) : [];
  const exists = list.some((p) => p.id === photo.id);
  const next   = exists ? list.filter((p) => p.id !== photo.id) : [photo, ...list];
  localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  return !exists; // 저장됐으면 true, 제거됐으면 false
}

export function isSaved(id: string): boolean {
  const raw = localStorage.getItem(SAVED_KEY);
  if (!raw) return false;
  return (JSON.parse(raw) as MapPhoto[]).some((p) => p.id === id);
}

// ── 사진 상세 모달 ─────────────────────────────────────────────
function PhotoModal({
  photo,
  onClose,
  onRemove,
  onDownload,
}: {
  photo: MapPhoto;
  onClose: () => void;
  onRemove: (id: string) => void;
  onDownload: (photo: MapPhoto) => void;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        zIndex: 2000, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        style={{ maxWidth: "520px", width: "100%", background: "white", borderRadius: "20px", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 18px", borderBottom: "1px solid #e2e8f0",
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "15px" }}>{photo.fileName}</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              {photo.location?.split(",")[0] || "위치 정보 없음"} · {photo.captureDate || photo.uploadedAt || ""}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#64748b" }}>✕</button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt={photo.fileName}
          style={{ width: "100%", maxHeight: "420px", objectFit: "contain", display: "block", background: "#f1f5f9" }}
        />

        <div style={{ padding: "10px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {photo.captureDate && photo.captureDate !== "Not available" && (
            <InfoChip label="촬영일" value={photo.captureDate} />
          )}
          {photo.location && (
            <div style={{ gridColumn: "1 / -1" }}>
              <InfoChip label="위치" value={photo.location} />
            </div>
          )}
          <InfoChip label="AI 분류" value={(photo.faceCount ?? 0) > 0 ? `인물 사진 (${photo.faceCount}명)` : "일반 사진"} />
        </div>

        <div style={{ display: "flex", gap: "8px", padding: "12px 18px", borderTop: "1px solid #e2e8f0" }}>
          <button
            onClick={() => onDownload(photo)}
            style={{
              flex: 1, background: "#0f172a", color: "white", border: "none",
              borderRadius: "10px", padding: "11px", fontWeight: 700, fontSize: "14px", cursor: "pointer",
            }}
          >
            다운로드
          </button>
          <button
            onClick={() => { onRemove(photo.id); onClose(); }}
            style={{
              flex: 1, background: "#fef9c3", color: "#854d0e", border: "none",
              borderRadius: "10px", padding: "11px", fontWeight: 700, fontSize: "14px", cursor: "pointer",
            }}
          >
            ⭐ 저장 취소
          </button>
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
export default function SavedPage() {
  const [saved, setSaved] = useState<MapPhoto[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  });
  const [selectedPhoto, setSelectedPhoto] = useState<MapPhoto | null>(null);

  function handleRemove(id: string) {
    const next = saved.filter((p) => p.id !== id);
    setSaved(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    if (selectedPhoto?.id === id) setSelectedPhoto(null);
  }

  function handleDownload(photo: MapPhoto) {
    const a = document.createElement("a");
    a.href = photo.imageUrl;
    a.download = photo.fileName;
    a.click();
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", paddingBottom: "110px" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>

        {/* 헤더 */}
        <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "4px" }}>⭐ Saved</h1>
        <p style={{ color: "#64748b", marginBottom: "24px", fontSize: "14px" }}>
          Albums에서 ⭐ 버튼을 눌러 저장한 사진들이 여기에 모입니다.
        </p>

        {saved.length === 0 ? (
          <div style={{
            background: "white", borderRadius: "16px", padding: "48px 24px",
            textAlign: "center", border: "2px dashed #e2e8f0",
          }}>
            <p style={{ fontSize: "40px", margin: "0 0 12px" }}>⭐</p>
            <p style={{ fontWeight: 700, color: "#334155", margin: "0 0 6px" }}>저장된 사진이 없습니다</p>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
              Albums 페이지에서 사진의 ⭐ 버튼을 눌러 저장해보세요.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "16px" }}>
              총 {saved.length}장 저장됨
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
              {saved.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  style={{
                    background: "white", borderRadius: "14px", overflow: "hidden",
                    border: "1px solid #fde68a", cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    transition: "transform 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.imageUrl}
                    alt={photo.fileName}
                    style={{ width: "100%", height: "130px", objectFit: "contain", background: "#f1f5f9", display: "block" }}
                  />
                  <div style={{ padding: "8px 10px" }}>
                    <p style={{
                      margin: 0, fontWeight: 700, fontSize: "12px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {photo.fileName}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>
                      {photo.location?.split(",")[0] || "위치 없음"}
                    </p>
                    <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(photo); }}
                        style={{
                          flex: 1, background: "#f1f5f9", border: "none", borderRadius: "6px",
                          padding: "5px 0", fontSize: "11px", fontWeight: 700, color: "#334155", cursor: "pointer",
                        }}
                      >
                        ↓ 저장
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(photo.id); }}
                        style={{
                          flex: 1, background: "#fef9c3", border: "none", borderRadius: "6px",
                          padding: "5px 0", fontSize: "11px", fontWeight: 700, color: "#854d0e", cursor: "pointer",
                        }}
                      >
                        ⭐ 취소
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onRemove={handleRemove}
          onDownload={handleDownload}
        />
      )}

      <BottomNav />
    </main>
  );
}
