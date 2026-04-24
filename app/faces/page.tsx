"use client";

<<<<<<< HEAD
import { useState, useRef, useEffect } from "react";
=======
import { useState, useRef, useEffect, useMemo } from "react";
>>>>>>> 85f8f6b (update project)
import BottomNav from "@/components/BottomNav";
import type { FacePhoto } from "@/app/page";

const FACES_STORAGE_KEY = "facesPhotos";

<<<<<<< HEAD
// ── 저장된 바운딩 박스를 캔버스에 그리기 ──────────────────────
=======
// ── Person clustering types ───────────────────────────────────
type FaceEntry = {
  photo: FacePhoto;
  boxIndex: number;
};

type PersonCluster = {
  id: string;
  label: string;
  faces: FaceEntry[];
  centroid: number[];
};

// ── Clustering utilities ──────────────────────────────────────
function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

// Greedy nearest-centroid clustering (professor's suggestion #2)
function clusterByPerson(photos: FacePhoto[], threshold: number): PersonCluster[] {
  const clusters: PersonCluster[] = [];

  for (const photo of photos) {
    if (!photo.descriptors?.length || !photo.boxes?.length) continue;
    for (let i = 0; i < photo.descriptors.length; i++) {
      const desc = photo.descriptors[i];
      if (!desc?.length) continue;

      let nearest: PersonCluster | null = null;
      let minDist = Infinity;
      for (const c of clusters) {
        const d = euclidean(desc, c.centroid);
        if (d < minDist) { minDist = d; nearest = c; }
      }

      if (nearest && minDist < threshold) {
        nearest.faces.push({ photo, boxIndex: i });
        // Update centroid as running average
        const n = nearest.faces.length;
        nearest.centroid = nearest.centroid.map((v, j) => (v * (n - 1) + desc[j]) / n);
      } else {
        clusters.push({
          id: `p${clusters.length}`,
          label: `Person ${clusters.length + 1}`,
          faces: [{ photo, boxIndex: i }],
          centroid: [...desc],
        });
      }
    }
  }

  // Re-label after sorting by frequency
  return clusters
    .sort((a, b) => b.faces.length - a.faces.length)
    .map((c, i) => ({ ...c, label: `Person ${i + 1}` }));
}

// ── Canvas helpers ────────────────────────────────────────────
>>>>>>> 85f8f6b (update project)
function PhotoWithBoxes({ photo }: { photo: FacePhoto }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
<<<<<<< HEAD

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
=======
    const img = new Image();
    img.src = photo.imageUrl;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      if (!photo.boxes?.length) return;
      const lineW = Math.max(3, img.width / 150);
      const labelH = Math.max(26, img.height / 22);
      const fontSize = Math.max(13, labelH * 0.62);
      photo.boxes.forEach((box, i) => {
        const x = box.x * img.width;
        const y = box.y * img.height;
        const w = box.width * img.width;
        const h = box.height * img.height;
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = lineW;
        ctx.strokeRect(x, y, w, h);
        const lh = Math.min(labelH, h * 0.35);
        ctx.fillStyle = "rgba(37,99,235,0.85)";
        ctx.fillRect(x, y, w, lh);
        ctx.fillStyle = "white";
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "left";
>>>>>>> 85f8f6b (update project)
        ctx.fillText(`#${i + 1}`, x + 6, y + lh * 0.8);
      });
    };
  }, [photo]);

<<<<<<< HEAD
  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}

// ── 얼굴 크롭 원형 칩 ─────────────────────────────────────────
=======
  return <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block" }} />;
}

>>>>>>> 85f8f6b (update project)
function FaceChip({
  imageUrl,
  box,
  index,
<<<<<<< HEAD
=======
  size = 58,
>>>>>>> 85f8f6b (update project)
}: {
  imageUrl: string;
  box: { x: number; y: number; width: number; height: number };
  index: number;
<<<<<<< HEAD
=======
  size?: number;
>>>>>>> 85f8f6b (update project)
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
<<<<<<< HEAD

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
=======
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const px = box.x * img.width;
      const py = box.y * img.height;
      const pw = box.width * img.width;
      const ph = box.height * img.height;
      const pad = Math.min(pw, ph) * 0.22;
      const sx = Math.max(0, px - pad);
      const sy = Math.max(0, py - pad);
      const sw = Math.min(img.width - sx, pw + pad * 2);
      const sh = Math.min(img.height - sy, ph + pad * 2);
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
    };
  }, [imageUrl, box, size]);
>>>>>>> 85f8f6b (update project)

  return (
    <div style={{ textAlign: "center" }}>
      <canvas
        ref={canvasRef}
<<<<<<< HEAD
        style={{
          width: "58px", height: "58px", borderRadius: "50%",
          border: "3px solid #2563eb", display: "block",
        }}
=======
        style={{ width: `${size}px`, height: `${size}px`, borderRadius: "50%", border: "3px solid #2563eb", display: "block" }}
>>>>>>> 85f8f6b (update project)
      />
      <span style={{ fontSize: "11px", color: "#64748b", marginTop: "3px", display: "block" }}>
        #{index + 1}
      </span>
    </div>
  );
}

<<<<<<< HEAD
// ── 전체보기 모달 ─────────────────────────────────────────────
=======
// ── Photo detail modal ────────────────────────────────────────
>>>>>>> 85f8f6b (update project)
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
<<<<<<< HEAD
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
        zIndex: 2000, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "20px", overflowY: "auto",
      }}
=======
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", overflowY: "auto" }}
>>>>>>> 85f8f6b (update project)
      onClick={onClose}
    >
      <div
        style={{ maxWidth: "600px", width: "100%", background: "white", borderRadius: "20px", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
<<<<<<< HEAD
        {/* 헤더 */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid #e2e8f0",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
              {photo.fileName}
            </h3>
=======
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>{photo.fileName}</h3>
>>>>>>> 85f8f6b (update project)
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              얼굴 {photo.faceCount}명 · {photo.uploadedAt}
              {photo.location && ` · ${photo.location.split(",")[0]}`}
            </p>
          </div>
<<<<<<< HEAD
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#64748b" }}
          >
=======
          <button onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#64748b" }}>
>>>>>>> 85f8f6b (update project)
            ✕
          </button>
        </div>

<<<<<<< HEAD
        {/* 이미지 + 바운딩 박스 */}
=======
>>>>>>> 85f8f6b (update project)
        <div style={{ background: "#f1f5f9" }}>
          <PhotoWithBoxes photo={photo} />
        </div>

<<<<<<< HEAD
        {/* 얼굴 칩 */}
=======
>>>>>>> 85f8f6b (update project)
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

<<<<<<< HEAD
        {/* 삭제 버튼 */}
        <div style={{ padding: "14px 20px" }}>
          <button
            onClick={() => { onDelete(photo.id); onClose(); }}
            style={{
              width: "100%", background: "#ef4444", color: "white", border: "none",
              borderRadius: "10px", padding: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer",
            }}
=======
        <div style={{ padding: "14px 20px" }}>
          <button
            onClick={() => { onDelete(photo.id); onClose(); }}
            style={{ width: "100%", background: "#ef4444", color: "white", border: "none",
              borderRadius: "10px", padding: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
>>>>>>> 85f8f6b (update project)
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

<<<<<<< HEAD
// ── 날짜 파싱 (한국 로케일 문자열 포함) ─────────────────────
function parseDate(str: string): Date {
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  // "2026. 4. 16. 오후 11:34:05" 형식 처리
=======
// ── Person cluster modal ──────────────────────────────────────
function PersonModal({ cluster, onClose }: { cluster: PersonCluster; onClose: () => void }) {
  // Show each occurrence (same person can appear multiple times in one photo)
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        style={{ maxWidth: "640px", width: "100%", background: "white", borderRadius: "20px",
          overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 20px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>{cluster.label}</h3>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              {cluster.faces.length}번 등장 · {new Set(cluster.faces.map(f => f.photo.id)).size}장의 사진
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer", color: "#64748b" }}>
            ✕
          </button>
        </div>

        {/* Scrollable grid */}
        <div style={{ padding: "16px 20px", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {cluster.faces.map((face, idx) => {
              const box = face.photo.boxes?.[face.boxIndex];
              return (
                <div key={`${face.photo.id}_${face.boxIndex}_${idx}`}
                  style={{ background: "#f8fafc", borderRadius: "12px", overflow: "hidden",
                    border: "1px solid #e2e8f0" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={face.photo.imageUrl} alt={face.photo.fileName}
                    style={{ width: "100%", height: "110px", objectFit: "cover", display: "block", background: "#f1f5f9" }} />
                  <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: "8px" }}>
                    {box && (
                      <div style={{ flexShrink: 0 }}>
                        <FaceChip imageUrl={face.photo.imageUrl} box={box} index={face.boxIndex} size={44} />
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {face.photo.fileName}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>
                        {face.photo.uploadedAt.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Date parsing ──────────────────────────────────────────────
function parseDate(str: string): Date {
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
>>>>>>> 85f8f6b (update project)
  const m = str.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return new Date(0);
}

<<<<<<< HEAD
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
=======
// ── Main page ─────────────────────────────────────────────────
export default function FacesPage() {
  const [storedPhotos, setStoredPhotos] = useState<FacePhoto[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(FACES_STORAGE_KEY);
      const photos: FacePhoto[] = raw ? JSON.parse(raw) : [];
      return [...photos].sort(
        (a, b) => parseDate(b.uploadedAt).getTime() - parseDate(a.uploadedAt).getTime()
      );
    } catch { return []; }
  });

  const [activeTab,       setActiveTab]       = useState<"people" | "photos">("people");
  const [threshold,       setThreshold]       = useState(0.50);
  const [selectedPhoto,   setSelectedPhoto]   = useState<FacePhoto | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<PersonCluster | null>(null);
>>>>>>> 85f8f6b (update project)

  function handleDelete(id: string) {
    const next = storedPhotos.filter((p) => p.id !== id);
    setStoredPhotos(next);
    localStorage.setItem(FACES_STORAGE_KEY, JSON.stringify(next));
  }

<<<<<<< HEAD
  // 위치가 있으면 도시 기준 그룹, 없으면 월 기준 그룹
=======
  // People clusters (recompute when threshold changes)
  const clusters = useMemo(
    () => clusterByPerson(storedPhotos, threshold),
    [storedPhotos, threshold]
  );

  const hasDescriptors = storedPhotos.some((p) => p.descriptors?.length);

  // Photos grouped by location or month (existing logic)
>>>>>>> 85f8f6b (update project)
  function getGroupKey(photo: FacePhoto): string {
    if (photo.location) {
      const parts = photo.location.split(",").map((s) => s.trim());
      return parts.slice(-2).join(", ");
    }
    const d = parseDate(photo.uploadedAt);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
<<<<<<< HEAD
    return (y > 1970) ? `${y}년 ${m}월` : "기타";
  }

  const groups: Record<string, FacePhoto[]> = {};
  storedPhotos.forEach((p) => {
    const key = getGroupKey(p);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
=======
    return y > 1970 ? `${y}년 ${m}월` : "기타";
  }

  const photoGroups: Record<string, FacePhoto[]> = {};
  storedPhotos.forEach((p) => {
    const key = getGroupKey(p);
    if (!photoGroups[key]) photoGroups[key] = [];
    photoGroups[key].push(p);
>>>>>>> 85f8f6b (update project)
  });

  return (
    <div style={{ padding: "20px 20px 120px", maxWidth: "680px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "4px" }}>Faces</h1>
<<<<<<< HEAD
      <p style={{ color: "#64748b", marginBottom: "24px", fontSize: "14px" }}>
        홈에서 얼굴이 감지된 사진이 자동으로 저장됩니다. 사진을 눌러 전체 보기·삭제를 할 수 있습니다.
      </p>

      {storedPhotos.length === 0 ? (
        <div style={{
          background: "white", borderRadius: "16px", padding: "48px 24px",
          textAlign: "center", border: "2px dashed #e2e8f0",
        }}>
=======
      <p style={{ color: "#64748b", marginBottom: "16px", fontSize: "14px" }}>
        홈에서 얼굴이 감지된 사진이 자동으로 저장됩니다.
      </p>

      {storedPhotos.length === 0 ? (
        <div style={{ background: "white", borderRadius: "16px", padding: "48px 24px",
          textAlign: "center", border: "2px dashed #e2e8f0" }}>
>>>>>>> 85f8f6b (update project)
          <p style={{ fontSize: "40px", margin: "0 0 12px" }}>📂</p>
          <p style={{ fontWeight: 700, color: "#334155", margin: "0 0 6px" }}>
            아직 저장된 얼굴 사진이 없습니다
          </p>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            홈 화면에서 사진을 업로드하면<br />얼굴이 감지된 사진이 자동으로 여기에 모입니다.
          </p>
        </div>
      ) : (
<<<<<<< HEAD
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
=======
        <>
          {/* ── Tabs ── */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "20px",
            background: "#f1f5f9", borderRadius: "12px", padding: "4px" }}>
            {(["people", "photos"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: "9px", border: "none", borderRadius: "9px",
                fontWeight: 700, fontSize: "14px", cursor: "pointer",
                background: activeTab === tab ? "white" : "transparent",
                color: activeTab === tab ? "#0f172a" : "#64748b",
                boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}>
                {tab === "people" ? "🙂 사람별" : "📷 사진별"}
              </button>
            ))}
          </div>

          {/* ── People tab ── */}
          {activeTab === "people" && (
            <div>
              {!hasDescriptors ? (
                /* No descriptors: model files not downloaded yet */
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a",
                  borderRadius: "14px", padding: "18px 20px" }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "14px", color: "#92400e" }}>
                    ⚠️ 향상 모델이 필요합니다
                  </p>
                  <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#78350f", lineHeight: 1.7 }}>
                    사람별 분류를 쓰려면 SSD + Face Recognition 모델 파일이 필요합니다.<br />
                    터미널에서 아래 명령어를 실행하고 앱을 재시작하세요.
                  </p>
                  <code style={{ display: "block", background: "#1e293b", color: "#86efac",
                    borderRadius: "8px", padding: "10px 14px", fontSize: "13px" }}>
                    bash _scripts/download-models.sh
                  </code>
                </div>
              ) : (
                <>
                  {/* Similarity threshold slider */}
                  <div style={{ background: "white", borderRadius: "14px", padding: "16px 18px",
                    marginBottom: "16px", border: "1px solid #e2e8f0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#334155" }}>
                        얼굴 유사도 기준
                      </span>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "#2563eb" }}>
                        {clusters.length}명 감지됨
                      </span>
                    </div>
                    <input
                      type="range" min={0.3} max={0.7} step={0.01}
                      value={threshold}
                      onChange={(e) => setThreshold(parseFloat(e.target.value))}
                      style={{ width: "100%", accentColor: "#2563eb" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between",
                      fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                      <span>← 엄격 (같은 사람만)</span>
                      <span>느슨 (비슷한 얼굴 포함) →</span>
                    </div>
                  </div>

                  {clusters.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>
                      기준을 조정하면 얼굴이 분류됩니다.
                    </p>
                  ) : (
                    <div style={{ display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "12px" }}>
                      {clusters.map((cluster) => {
                        const rep = cluster.faces[0];
                        const repBox = rep.photo.boxes?.[rep.boxIndex];
                        return (
                          <div key={cluster.id}
                            onClick={() => setSelectedCluster(cluster)}
                            style={{ background: "white", borderRadius: "16px", padding: "16px 12px",
                              textAlign: "center", cursor: "pointer", border: "1px solid #e2e8f0",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "transform 0.12s" }}
                            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                          >
                            <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                              {repBox ? (
                                <FaceChip imageUrl={rep.photo.imageUrl} box={repBox}
                                  index={rep.boxIndex} size={76} />
                              ) : (
                                <div style={{ width: "76px", height: "76px", borderRadius: "50%",
                                  background: "#f1f5f9", display: "flex", alignItems: "center",
                                  justifyContent: "center", fontSize: "28px" }}>
                                  🙂
                                </div>
                              )}
                            </div>
                            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "13px", color: "#1e293b" }}>
                              {cluster.label}
                            </p>
                            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                              {cluster.faces.length}번 등장
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Photos tab ── */}
          {activeTab === "photos" && (
            <div>
              {Object.entries(photoGroups).map(([groupKey, photos]) => (
                <div key={groupKey} style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "16px" }}>{photos[0]?.location ? "📍" : "📅"}</span>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                      {groupKey}
                    </h3>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>({photos.length}장)</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    {photos.map((photo) => (
                      <div key={photo.id}
                        onClick={() => setSelectedPhoto(photo)}
                        style={{ background: "white", borderRadius: "14px", overflow: "hidden",
                          border: "1px solid #e2e8f0", cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)", transition: "transform 0.12s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.imageUrl} alt={photo.fileName}
                          style={{ width: "100%", height: "160px", objectFit: "contain",
                            display: "block", background: "#f1f5f9" }} />
                        <div style={{ padding: "8px 10px" }}>
                          <p style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "#1e293b",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {photo.fileName}
                          </p>
                          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>
                            얼굴 {photo.faceCount}명 · {photo.uploadedAt.slice(0, 10)}
                            {photo.descriptors && (
                              <span style={{ marginLeft: "4px", color: "#16a34a" }}>✓</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
>>>>>>> 85f8f6b (update project)
                  </div>
                </div>
              ))}
            </div>
<<<<<<< HEAD
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
=======
          )}
        </>
      )}

      {selectedPhoto && (
        <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} onDelete={handleDelete} />
      )}
      {selectedCluster && (
        <PersonModal cluster={selectedCluster} onClose={() => setSelectedCluster(null)} />
>>>>>>> 85f8f6b (update project)
      )}

      <BottomNav />
    </div>
  );
}
