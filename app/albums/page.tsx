"use client";

import { useMemo, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { toggleSaved } from "@/lib/savedUtils";

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

type Filter = "전체" | "인물 사진" | "일반 사진";
const FILTERS: Filter[] = ["전체", "인물 사진", "일반 사진"];
const STORAGE_KEY = "photoMapPhotos";

// ── 사진 상세 모달 ─────────────────────────────────────────────
function PhotoModal({
  photo,
  onClose,
  onDelete,
  onDownload,
}: {
  photo: MapPhoto;
  onClose: () => void;
  onDelete: (id: string) => void;
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

        <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
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
          <InfoChip
            label="AI 분류"
            value={(photo.faceCount ?? 0) > 0 ? `인물 사진 (${photo.faceCount}명)` : "일반 사진"}
          />
        </div>

        {/* 다운로드 + 삭제 버튼 */}
        <div style={{ display: "flex", gap: "8px", padding: "12px 18px", borderTop: "1px solid #e2e8f0" }}>
          <button
            onClick={() => onDownload(photo)}
            style={{
              flex: 1, background: "#0f172a", color: "white", border: "none",
              borderRadius: "10px", padding: "11px", fontWeight: 700,
              fontSize: "14px", cursor: "pointer",
            }}
          >
            다운로드
          </button>
          <button
            onClick={() => { onDelete(photo.id); onClose(); }}
            style={{
              flex: 1, background: "#ef4444", color: "white", border: "none",
              borderRadius: "10px", padding: "11px", fontWeight: 700,
              fontSize: "14px", cursor: "pointer",
            }}
          >
            삭제
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
export default function AlbumsPage() {
  const [photos, setPhotos] = useState<MapPhoto[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  });

  const [filter, setFilter]               = useState<Filter>("전체");
  const [selectedPhoto, setSelectedPhoto] = useState<MapPhoto | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const raw = localStorage.getItem("savedPhotos");
    const list = raw ? JSON.parse(raw) : [];
    return new Set(list.map((p: MapPhoto) => p.id));
  });

  function handleToggleSaved(e: React.MouseEvent, photo: MapPhoto) {
    e.stopPropagation();
    const nowSaved = toggleSaved(photo);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nowSaved) next.add(photo.id); else next.delete(photo.id);
      return next;
    });
  }

  function handleDelete(id: string) {
    const next = photos.filter((p) => p.id !== id);
    setPhotos(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (selectedPhoto?.id === id) setSelectedPhoto(null);
  }

  function handleDownload(photo: MapPhoto) {
    const a = document.createElement("a");
    a.href = photo.imageUrl;
    a.download = photo.fileName;
    a.click();
  }

  const counts = useMemo(() => ({
    "전체":    photos.length,
    "인물 사진": photos.filter((p) => (p.faceCount ?? 0) > 0).length,
    "일반 사진": photos.filter((p) => (p.faceCount ?? 0) === 0).length,
  }), [photos]);

  const filtered = useMemo(() => {
    if (filter === "인물 사진") return photos.filter((p) => (p.faceCount ?? 0) > 0);
    if (filter === "일반 사진") return photos.filter((p) => (p.faceCount ?? 0) === 0);
    return photos;
  }, [photos, filter]);

  // 위치별 그룹핑
  const grouped = useMemo(() => {
    const map = new Map<string, MapPhoto[]>();
    for (const photo of filtered) {
      const key = (photo.location || "위치 정보 없음").split(",")[0].trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(photo);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", paddingBottom: "110px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>

        {/* 헤더 */}
        <h1 style={{ fontSize: "48px", fontWeight: 800, marginBottom: "4px" }}>Albums</h1>
        <p style={{ color: "#475569", marginBottom: "20px" }}>
          지도에 저장된 사진을 위치별로 묶어서 보여줍니다.
        </p>

        {/* 필터 탭 */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "9px 20px", borderRadius: "999px", border: "none",
                  background: active ? "#2563eb" : "white",
                  color: active ? "white" : "#475569",
                  fontWeight: 700, cursor: "pointer", fontSize: "14px",
                  boxShadow: active
                    ? "0 2px 8px rgba(37,99,235,0.3)"
                    : "0 1px 4px rgba(0,0,0,0.08)",
                  transition: "all 0.15s",
                }}
              >
                {f === "인물 사진" ? "👤 " : f === "일반 사진" ? "🖼️ " : "📋 "}
                {f} ({counts[f]})
              </button>
            );
          })}
        </div>

        {/* 사진 없음 */}
        {grouped.length === 0 ? (
          <div style={{
            background: "white", borderRadius: "18px", padding: "48px 24px",
            textAlign: "center", border: "2px dashed #e2e8f0",
          }}>
            <p style={{ fontSize: "36px", margin: "0 0 12px" }}>
              {filter === "인물 사진" ? "👤" : filter === "일반 사진" ? "🖼️" : "📂"}
            </p>
            <p style={{ fontWeight: 700, color: "#334155", margin: "0 0 6px" }}>
              {filter === "전체"
                ? "아직 저장된 사진이 없습니다"
                : `${filter}이 없습니다`}
            </p>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
              홈에서 사진을 업로드하고 지도에 저장해보세요.
            </p>
          </div>
        ) : (
          grouped.map(([groupName, items]) => (
            <section
              key={groupName}
              style={{
                background: "white", borderRadius: "18px", padding: "20px",
                marginBottom: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              {/* 그룹 헤더 */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <span style={{ fontSize: "18px" }}>📍</span>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>{groupName}</h2>
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>({items.length}장)</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
                {items.map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    style={{
                      borderRadius: "14px", overflow: "hidden", cursor: "pointer",
                      border: "1px solid #e2e8f0", background: "#f8fafc",
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
                        width: "100%", height: "140px",
                        objectFit: "contain", display: "block", background: "#f1f5f9",
                      }}
                    />
                    <div style={{ padding: "8px 10px" }}>
                      <span style={{
                        display: "inline-block", fontSize: "10px", fontWeight: 700,
                        padding: "2px 7px", borderRadius: "4px", marginBottom: "4px",
                        background: (photo.faceCount ?? 0) > 0 ? "#dbeafe" : "#f1f5f9",
                        color:      (photo.faceCount ?? 0) > 0 ? "#1d4ed8"  : "#64748b",
                      }}>
                        {(photo.faceCount ?? 0) > 0 ? `👤 인물 사진` : "🖼️ 일반 사진"}
                      </span>
                      <p style={{
                        margin: 0, fontWeight: 700, fontSize: "12px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {photo.fileName}
                      </p>
                      <p style={{ margin: "2px 0 0", color: "#94a3b8", fontSize: "11px" }}>
                        {photo.captureDate || "날짜 없음"}
                      </p>
                      {/* 카드 하단 버튼 */}
                      <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                        <button
                          onClick={(e) => handleToggleSaved(e, photo)}
                          style={{
                            flex: 1, border: "none", borderRadius: "6px",
                            padding: "5px 0", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                            background: savedIds.has(photo.id) ? "#fef9c3" : "#f1f5f9",
                            color:      savedIds.has(photo.id) ? "#854d0e" : "#64748b",
                          }}
                        >
                          {savedIds.has(photo.id) ? "⭐" : "☆"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(photo); }}
                          style={{
                            flex: 1, background: "#f1f5f9", border: "none", borderRadius: "6px",
                            padding: "5px 0", fontSize: "11px", fontWeight: 700,
                            color: "#334155", cursor: "pointer",
                          }}
                        >
                          ↓
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                          style={{
                            flex: 1, background: "#fee2e2", border: "none", borderRadius: "6px",
                            padding: "5px 0", fontSize: "11px", fontWeight: 700,
                            color: "#ef4444", cursor: "pointer",
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDelete}
          onDownload={handleDownload}
        />
      )}

      <BottomNav />
    </main>
  );
}
