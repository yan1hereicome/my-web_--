"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import BottomNav from "@/components/BottomNav";
import type { FacePhoto } from "@/app/page";
import {
  Users, ImageIcon, MapPin, CalendarDays, Trash2, X,
  SlidersHorizontal, Terminal, AlertTriangle,
} from "lucide-react";

const FACES_STORAGE_KEY = "facesPhotos";

type FaceEntry = { photo: FacePhoto; boxIndex: number };
type PersonCluster = { id: string; label: string; faces: FaceEntry[]; centroid: number[] };

function euclidean(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

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
        const n = nearest.faces.length;
        nearest.centroid = nearest.centroid.map((v, j) => (v * (n - 1) + desc[j]) / n);
      } else {
        clusters.push({ id: `p${clusters.length}`, label: `Person ${clusters.length + 1}`, faces: [{ photo, boxIndex: i }], centroid: [...desc] });
      }
    }
  }
  return clusters.sort((a, b) => b.faces.length - a.faces.length).map((c, i) => ({ ...c, label: `Person ${i + 1}` }));
}

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
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      if (!photo.boxes?.length) return;
      const lineW = Math.max(3, img.width / 150);
      const labelH = Math.max(26, img.height / 22);
      const fontSize = Math.max(13, labelH * 0.62);
      photo.boxes.forEach((box, i) => {
        const x = box.x * img.width, y = box.y * img.height;
        const w = box.width * img.width, h = box.height * img.height;
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = lineW;
        ctx.strokeRect(x, y, w, h);
        const lh = Math.min(labelH, h * 0.35);
        ctx.fillStyle = "rgba(37,99,235,0.85)";
        ctx.fillRect(x, y, w, lh);
        ctx.fillStyle = "white";
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(`#${i + 1}`, x + 6, y + lh * 0.8);
      });
    };
  }, [photo]);
  return <canvas ref={canvasRef} className="w-full h-auto block" />;
}

function FaceChip({ imageUrl, box, index, size = 58 }: {
  imageUrl: string;
  box: { x: number; y: number; width: number; height: number };
  index: number;
  size?: number;
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
      const px = box.x * img.width, py = box.y * img.height;
      const pw = box.width * img.width, ph = box.height * img.height;
      const pad = Math.min(pw, ph) * 0.22;
      const sx = Math.max(0, px - pad), sy = Math.max(0, py - pad);
      const sw = Math.min(img.width - sx, pw + pad * 2);
      const sh = Math.min(img.height - sy, ph + pad * 2);
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
    };
  }, [imageUrl, box, size]);
  return (
    <div className="text-center">
      <canvas
        ref={canvasRef}
        style={{ width: `${size}px`, height: `${size}px` }}
        className="rounded-full border-2 border-blue-500 block"
      />
      <span className="text-[10px] text-slate-400 mt-1 block">#{index + 1}</span>
    </div>
  );
}

function PhotoModal({ photo, onClose, onDelete }: {
  photo: FacePhoto; onClose: () => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/85 z-[2000] flex items-center justify-center p-5 overflow-y-auto" onClick={onClose}>
      <div className="max-w-[600px] w-full bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{photo.fileName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              얼굴 {photo.faceCount}명 · {photo.uploadedAt}
              {photo.location && ` · ${photo.location.split(",")[0]}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="bg-slate-100">
          <PhotoWithBoxes photo={photo} />
        </div>

        {photo.boxes && photo.boxes.length > 0 && (
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs text-slate-400 mb-3">감지된 얼굴 ({photo.faceCount}명)</p>
            <div className="flex gap-2.5 flex-wrap">
              {photo.boxes.map((box, i) => (
                <FaceChip key={i} imageUrl={photo.imageUrl} box={box} index={i} />
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-4">
          <button
            onClick={() => { onDelete(photo.id); onClose(); }}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm transition-colors"
          >
            <Trash2 size={15} /> 삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonModal({ cluster, onClose }: { cluster: PersonCluster; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/85 z-[2000] flex items-center justify-center p-5 overflow-y-auto" onClick={onClose}>
      <div className="max-w-[640px] w-full bg-white rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-base">{cluster.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {cluster.faces.length}번 등장 · {new Set(cluster.faces.map(f => f.photo.id)).size}장의 사진
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {cluster.faces.map((face, idx) => {
              const box = face.photo.boxes?.[face.boxIndex];
              return (
                <div key={`${face.photo.id}_${face.boxIndex}_${idx}`}
                  className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={face.photo.imageUrl} alt={face.photo.fileName}
                    className="w-full h-28 object-cover bg-slate-100" />
                  <div className="p-2.5 flex items-center gap-2.5">
                    {box && <div className="flex-shrink-0"><FaceChip imageUrl={face.photo.imageUrl} box={box} index={face.boxIndex} size={44} /></div>}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{face.photo.fileName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{face.photo.uploadedAt.slice(0, 10)}</p>
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

function parseDate(str: string): Date {
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  const m = str.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return new Date(0);
}

export default function FacesPage() {
  const [storedPhotos, setStoredPhotos] = useState<FacePhoto[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(FACES_STORAGE_KEY);
      const photos: FacePhoto[] = raw ? JSON.parse(raw) : [];
      return [...photos].sort((a, b) => parseDate(b.uploadedAt).getTime() - parseDate(a.uploadedAt).getTime());
    } catch { return []; }
  });

  const [activeTab,       setActiveTab]       = useState<"people" | "photos">("people");
  const [threshold,       setThreshold]       = useState(0.50);
  const [selectedPhoto,   setSelectedPhoto]   = useState<FacePhoto | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<PersonCluster | null>(null);

  function handleDelete(id: string) {
    const next = storedPhotos.filter((p) => p.id !== id);
    setStoredPhotos(next);
    localStorage.setItem(FACES_STORAGE_KEY, JSON.stringify(next));
  }

  const clusters = useMemo(() => clusterByPerson(storedPhotos, threshold), [storedPhotos, threshold]);
  const hasDescriptors = storedPhotos.some((p) => p.descriptors?.length);

  function getGroupKey(photo: FacePhoto): string {
    if (photo.location) {
      const parts = photo.location.split(",").map((s) => s.trim());
      return parts.slice(-2).join(", ");
    }
    const d = parseDate(photo.uploadedAt);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return y > 1970 ? `${y}년 ${m}월` : "기타";
  }

  const photoGroups: Record<string, FacePhoto[]> = {};
  storedPhotos.forEach((p) => {
    const key = getGroupKey(p);
    if (!photoGroups[key]) photoGroups[key] = [];
    photoGroups[key].push(p);
  });

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 pb-28">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center shadow-md shadow-rose-200">
            <Users size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Faces</h1>
            <p className="text-slate-500 text-sm">홈에서 얼굴이 감지된 사진이 자동으로 저장됩니다.</p>
          </div>
        </div>

        {storedPhotos.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-slate-300" />
            </div>
            <p className="font-bold text-slate-700 mb-1">아직 저장된 얼굴 사진이 없습니다</p>
            <p className="text-slate-400 text-sm">홈 화면에서 사진을 업로드하면<br />얼굴이 감지된 사진이 자동으로 여기에 모입니다.</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1">
              {(["people", "photos"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    activeTab === tab
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab === "people" ? <Users size={15} /> : <ImageIcon size={15} />}
                  {tab === "people" ? "사람별" : "사진별"}
                </button>
              ))}
            </div>

            {/* People tab */}
            {activeTab === "people" && (
              <div>
                {!hasDescriptors ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} className="text-amber-600" />
                      <p className="font-bold text-amber-800 text-sm">향상 모델이 필요합니다</p>
                    </div>
                    <p className="text-sm text-amber-700 leading-relaxed mb-3">
                      사람별 분류를 쓰려면 SSD + Face Recognition 모델 파일이 필요합니다.<br />
                      터미널에서 아래 명령어를 실행하고 앱을 재시작하세요.
                    </p>
                    <div className="bg-slate-900 rounded-xl px-4 py-3 flex items-center gap-2">
                      <Terminal size={14} className="text-emerald-400 flex-shrink-0" />
                      <code className="text-emerald-400 text-sm">bash _scripts/download-models.sh</code>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Threshold slider */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal size={15} className="text-slate-500" />
                          <span className="text-sm font-bold text-slate-700">얼굴 유사도 기준</span>
                        </div>
                        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                          {clusters.length}명 감지됨
                        </span>
                      </div>
                      <input
                        type="range" min={0.3} max={0.7} step={0.01}
                        value={threshold}
                        onChange={(e) => setThreshold(parseFloat(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
                        <span>← 엄격 (같은 사람만)</span>
                        <span>느슨 (비슷한 얼굴 포함) →</span>
                      </div>
                    </div>

                    {clusters.length === 0 ? (
                      <p className="text-center text-slate-400 py-10">기준을 조정하면 얼굴이 분류됩니다.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {clusters.map((cluster) => {
                          const rep = cluster.faces[0];
                          const repBox = rep.photo.boxes?.[rep.boxIndex];
                          return (
                            <div
                              key={cluster.id}
                              onClick={() => setSelectedCluster(cluster)}
                              className="photo-card bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center cursor-pointer"
                            >
                              <div className="flex justify-center mb-3">
                                {repBox ? (
                                  <FaceChip imageUrl={rep.photo.imageUrl} box={repBox} index={rep.boxIndex} size={72} />
                                ) : (
                                  <div className="w-18 h-18 rounded-full bg-slate-100 flex items-center justify-center">
                                    <Users size={28} className="text-slate-300" />
                                  </div>
                                )}
                              </div>
                              <p className="font-bold text-slate-800 text-sm">{cluster.label}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{cluster.faces.length}번 등장</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Photos tab */}
            {activeTab === "photos" && (
              <div className="space-y-6">
                {Object.entries(photoGroups).map(([groupKey, photos]) => (
                  <div key={groupKey}>
                    <div className="flex items-center gap-2 mb-3">
                      {photos[0]?.location ? <MapPin size={15} className="text-blue-500" /> : <CalendarDays size={15} className="text-slate-400" />}
                      <h3 className="font-bold text-slate-800 text-sm">{groupKey}</h3>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{photos.length}장</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {photos.map((photo) => (
                        <div
                          key={photo.id}
                          onClick={() => setSelectedPhoto(photo)}
                          className="photo-card bg-white rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-sm relative group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.imageUrl} alt={photo.fileName}
                            className="w-full h-40 object-contain bg-slate-100" />

                          {/* Direct delete button — visible on hover */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("이 사진을 삭제하시겠습니까?")) handleDelete(photo.id);
                            }}
                            className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>

                          <div className="p-2.5">
                            <p className="font-bold text-slate-800 text-xs truncate">{photo.fileName}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <Users size={9} /> 얼굴 {photo.faceCount}명
                              {photo.descriptors && <span className="text-emerald-500 ml-1">✓</span>}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {selectedPhoto && (
          <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} onDelete={handleDelete} />
        )}
        {selectedCluster && (
          <PersonModal cluster={selectedCluster} onClose={() => setSelectedCluster(null)} />
        )}
      </div>

      <BottomNav />
    </main>
  );
}
