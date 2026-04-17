"use client";

import { useState, useRef, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import type { FacePhoto } from "@/app/page";

const FACES_STORAGE_KEY = "facesPhotos";

// ── 저장된 바운딩 박스를 캔버스에 그리기 ──────────────────────
function PhotoWithBoxes({ photo }: { photo: FacePhoto }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = photo.imageUrl;
    img.onload = () => {
      canvas.width  = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const boxes = photo.boxes;
      if (!boxes || boxes.length === 0) return;

      const lineW    = Math.max(3, img.width / 150);
      const labelH   = Math.max(26, img.height / 22);
      const fontSize = Math.max(13, labelH * 0.62);

      boxes.forEach((box, i) => {
        const x = box.x * img.width;
        const y = box.y * img.height;
        const w = box.width  * img.width;
        const h = box.height * img.height;

        // 바운딩 박스
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth   = lineW;
        ctx.strokeRect(x, y, w, h);

        // 라벨: 박스 안쪽 상단에 그리기 (위치 문제 없음)
        const lh = Math.min(labelH, h * 0.35);
        ctx.fillStyle = "rgba(37,99,235,0.85)";
        ctx.fillRect(x, y, w, lh);
        ctx.fillStyle  = "white";
        ctx.font       = `bold ${fontSize}px sans-serif`;
        ctx.textAlign  = "left";
        ctx.fillText(`#${i + 1}`, x + 6, y + lh * 0.8);
      });
    };
  }, [photo]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

// ── 얼굴 크롭 원형 칩 ─────────────────────────────────────────
function FaceChip({
  imageUrl,
  box,
  index,
}: {
  imageUrl: string;
  box: { x: number; y: number; width: number; height: number };
  index: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const px  = box.x      * img.width;
      const py  = box.y      * img.height;
      const pw  = box.width  * img.width;
      const ph  = box.height * img.height;
      const pad = Math.min(pw, ph) * 0.22;
      const sx  = Math.max(0, px - pad);
      const sy  = Math.max(0, py - pad);
      const sw  = Math.min(img.width  - sx, pw + pad * 2);
      const sh  = Math.min(img.height - sy, ph + pad * 2);

      canvas.width  = 80;
      canvas.height = 80;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 80, 80);
    };
  }, [imageUrl, box]);

  return (
    <div style={{ textAlign: "center" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "58px", height: "58px", borderRadius: "50%",
          border: "3px solid #2563eb", display: "block",
        }}
      />
      <span style={{ fontSize: "11px", color: "#64748b", marginTop: "3px", display: "block" }}>
        #{index + 1}
      </span>
    </div>
  );
}

// ── 전체보기 모달 ─────────────────────────────────────────────
function PhotoModal({
  photo,
  onClose,
  onDelete,
}: {
  photo: FacePhoto;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        zIndex: 2000, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "20px", overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{ maxWidth: "600px", width: "100%", background: "white", borderRadius: "20px", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid #e2e8f0",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
              {photo.fileName}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              얼굴 {photo.faceCount}명 · {photo.uploadedAt}
              {photo.location && ` · ${photo.location.split(",")[0]}`}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#64748b" }}
          >
            ✕
          </button>
        </div>

        {/* 이미지 + 바운딩 박스 */}
        <div style={{ background: "#f1f5f9" }}>
          <PhotoWithBoxes photo={photo} />
        </div>

        {/* 얼굴 칩 */}
        {photo.boxes && photo.boxes.length > 0 && (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
            <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#64748b" }}>
              감지된 얼굴 ({photo.faceCount}명)
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {photo.boxes.map((box, i) => (
                <FaceChip key={i} imageUrl={photo.imageUrl} box={box} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* 삭제 버튼 */}
        <div style={{ padding: "14px 20px" }}>
          <button
            onClick={() => { onDelete(photo.id); onClose(); }}
            style={{
              width: "100%", background: "#ef4444", color: "white", border: "none",
              borderRadius: "10px", padding: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer",
            }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 날짜 파싱 (한국 로케일 문자열 포함) ─────────────────────
function parseDate(str: string): Date {
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  // "2026. 4. 16. 오후 11:34:05" 형식 처리
  const m = str.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return new Date(0);
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function FacesPage() {
  const [storedPhotos, setStoredPhotos] = useState<FacePhoto[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(FACES_STORAGE_KEY);
    const photos = raw ? (JSON.parse(raw) as FacePhoto[]) : [];
    // 날짜 내림차순 정렬
    return [...photos].sort(
      (a, b) => parseDate(b.uploadedAt).getTime() - parseDate(a.uploadedAt).getTime()
    );
  });
  const [selectedPhoto, setSelectedPhoto] = useState<FacePhoto | null>(null);

  function handleDelete(id: string) {
    const next = storedPhotos.filter((p) => p.id !== id);
    setStoredPhotos(next);
    localStorage.setItem(FACES_STORAGE_KEY, JSON.stringify(next));
  }

  // 위치가 있으면 도시 기준 그룹, 없으면 월 기준 그룹
  function getGroupKey(photo: FacePhoto): string {
    if (photo.location) {
      const parts = photo.location.split(",").map((s) => s.trim());
      return parts.slice(-2).join(", ");
    }
    const d = parseDate(photo.uploadedAt);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return (y > 1970) ? `${y}년 ${m}월` : "기타";
  }

  const groups: Record<string, FacePhoto[]> = {};
  storedPhotos.forEach((p) => {
    const key = getGroupKey(p);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  return (
    <div style={{ padding: "20px 20px 120px", maxWidth: "680px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "4px" }}>Faces</h1>
      <p style={{ color: "#64748b", marginBottom: "24px", fontSize: "14px" }}>
        홈에서 얼굴이 감지된 사진이 자동으로 저장됩니다. 사진을 눌러 전체 보기·삭제를 할 수 있습니다.
      </p>

      {storedPhotos.length === 0 ? (
        <div style={{
          background: "white", borderRadius: "16px", padding: "48px 24px",
          textAlign: "center", border: "2px dashed #e2e8f0",
        }}>
          <p style={{ fontSize: "40px", margin: "0 0 12px" }}>📂</p>
          <p style={{ fontWeight: 700, color: "#334155", margin: "0 0 6px" }}>
            아직 저장된 얼굴 사진이 없습니다
          </p>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            홈 화면에서 사진을 업로드하면<br />얼굴이 감지된 사진이 자동으로 여기에 모입니다.
          </p>
        </div>
      ) : (
        Object.entries(groups).map(([groupKey, photos]) => (
          <div key={groupKey} style={{ marginBottom: "28px" }}>
            {/* 그룹 헤더 */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "16px" }}>
                {photos[0]?.location ? "📍" : "📅"}
              </span>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                {groupKey}
              </h3>
              <span style={{ fontSize: "13px", color: "#94a3b8" }}>({photos.length}장)</span>
            </div>

            {/* 2열 그리드 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  style={{
                    background: "white", borderRadius: "14px", overflow: "hidden",
                    border: "1px solid #e2e8f0", cursor: "pointer",
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
                    style={{
                      width: "100%", height: "160px", objectFit: "contain",
                      display: "block", background: "#f1f5f9",
                    }}
                  />
                  <div style={{ padding: "8px 10px" }}>
                    <p style={{
                      margin: 0, fontSize: "12px", fontWeight: 700, color: "#1e293b",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {photo.fileName}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>
                      얼굴 {photo.faceCount}명 · {photo.uploadedAt.slice(0, 10)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* 전체보기 모달 */}
      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onDelete={handleDelete}
        />
      )}

      <BottomNav />
    </div>
  );
}
