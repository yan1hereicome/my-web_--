"use client";

import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { SAVED_KEY } from "@/lib/savedUtils";
import { Star, Download, X, MapPin, BookmarkX } from "lucide-react";

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

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
      <p className="text-[10px] text-slate-400 font-medium mb-0.5">{label}</p>
      <p className="text-xs font-bold text-slate-700 break-all">{value}</p>
    </div>
  );
}

function PhotoModal({
  photo, onClose, onRemove, onDownload,
}: {
  photo: MapPhoto;
  onClose: () => void;
  onRemove: (id: string) => void;
  onDownload: (photo: MapPhoto) => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/85 z-[2000] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <div
        className="max-w-[520px] w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-sm truncate">{photo.fileName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {photo.location?.split(",")[0] || "위치 정보 없음"} · {photo.captureDate || photo.uploadedAt || ""}
            </p>
          </div>
          <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-700 transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.imageUrl} alt={photo.fileName}
          className="w-full max-h-[420px] object-contain bg-slate-100" />

        <div className="p-4 grid grid-cols-2 gap-2">
          {photo.captureDate && photo.captureDate !== "Not available" && (
            <InfoChip label="촬영일" value={photo.captureDate} />
          )}
          {photo.location && (
            <div className="col-span-2">
              <InfoChip label="위치" value={photo.location} />
            </div>
          )}
          <InfoChip label="AI 분류" value={(photo.faceCount ?? 0) > 0 ? `인물 사진 (${photo.faceCount}명)` : "일반 사진"} />
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-slate-100">
          <button
            onClick={() => onDownload(photo)}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
          >
            <Download size={15} /> 다운로드
          </button>
          <button
            onClick={() => { onRemove(photo.id); onClose(); }}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-100 text-amber-800 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-200 transition-colors"
          >
            <BookmarkX size={15} /> 저장 취소
          </button>
        </div>
      </div>
    </div>
  );
}

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
    <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center shadow-md shadow-amber-200">
            <Star size={22} className="text-white fill-white" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Saved</h1>
            <p className="text-slate-500 text-sm">Albums에서 ★ 버튼을 눌러 저장한 사진들이 여기에 모입니다.</p>
          </div>
        </div>

        {saved.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Star size={28} className="text-amber-300" />
            </div>
            <p className="font-bold text-slate-700 mb-1">저장된 사진이 없습니다</p>
            <p className="text-slate-400 text-sm">Albums 페이지에서 사진의 ★ 버튼을 눌러 저장해보세요.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-4">총 <strong className="text-slate-600">{saved.length}</strong>장 저장됨</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {saved.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  className="photo-card bg-white rounded-xl overflow-hidden border border-amber-200 cursor-pointer shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.imageUrl}
                    alt={photo.fileName}
                    className="w-full h-32 object-contain bg-slate-100"
                  />
                  <div className="p-2.5">
                    <p className="font-bold text-slate-800 text-xs truncate">{photo.fileName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                      <MapPin size={9} />
                      {photo.location?.split(",")[0] || "위치 없음"}
                    </p>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(photo); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                      >
                        <Download size={10} /> 저장
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemove(photo.id); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                      >
                        <Star size={10} /> 취소
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
