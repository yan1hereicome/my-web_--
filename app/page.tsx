"use client";

import { ChangeEvent, useState, useEffect } from "react";
import * as exifr from "exifr";
import * as faceapi from "face-api.js";
import BottomNav from "@/components/BottomNav";
import {
  Camera, Upload, MapPin, Users, CalendarDays, Clock,
  FileImage, Ruler, CheckCircle2, Loader2, Cpu, AlertTriangle,
  Search, Navigation, Save, Pencil, X, Check, Wifi, WifiOff,
  Coffee, Utensils, Wine,
} from "lucide-react";

// ── Types ──────────────────────────────────────
type NearbyPlace = {
  name: string;
  type: "restaurant" | "cafe" | "bar" | string;
  cuisine: string;
  distance_m: number;
};

type PhotoInfo = {
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadedAt: string;
  captureDate: string;
  captureTime: string;
  location: string;
  lat: number | null;
  lng: number | null;
  faceCount: number;
  category: string;
};

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

export type FacePhoto = {
  id: string;
  fileName: string;
  imageUrl: string;
  faceCount: number;
  uploadedAt: string;
  boxes?: Array<{ x: number; y: number; width: number; height: number }>;
  descriptors?: number[][];
  lat?: number;
  lng?: number;
  location?: string;
};

const MAP_STORAGE_KEY   = "photoMapPhotos";
const FACES_STORAGE_KEY = "facesPhotos";
const BACKEND_URL       = "http://localhost:8000";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

async function createThumbnailDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = url;
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "ko" } }
    );
    const data = await res.json();
    const a = data.address || {};
    const parts = [
      a.road,
      a.neighbourhood || a.suburb || a.quarter,
      a.city_district || a.district,
      a.city || a.town || a.village || a.county,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : (data.display_name || "");
  } catch { return ""; }
}

async function forwardGeocode(query: string): Promise<{ lat: number; lng: number; name: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "Accept-Language": "ko" } }
    );
    const data = await res.json();
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name };
  } catch { return null; }
}

async function fetchNearbyPlaces(lat: number, lng: number): Promise<NearbyPlace[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/nearby-places?lat=${lat}&lng=${lng}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.places ?? [];
  } catch { return []; }
}

async function analyzeWithBackend(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BACKEND_URL}/analyze`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  return res.json() as Promise<{
    captureDate: string | null;
    captureTime: string | null;
    latitude:    number | null;
    longitude:   number | null;
    location:    string | null;
    faceCount:   number;
    faceBoxes:   Array<{ x_norm: number; y_norm: number; w_norm: number; h_norm: number }>;
    descriptors: number[][];
  }>;
}

// ── InfoRow component ──────────────────────────
function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
      <p className="text-[11px] text-slate-400 font-medium mb-0.5 flex items-center gap-1">
        {Icon && <Icon size={11} />}
        {label}
      </p>
      <p className="text-sm font-bold text-slate-800 break-all leading-snug">{value}</p>
    </div>
  );
}

// ── Main Component ──────────────────────────────
export default function HomePage() {
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [previewUrl,     setPreviewUrl]     = useState("");
  const [photoInfo,      setPhotoInfo]      = useState<PhotoInfo | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [savedMessage,   setSavedMessage]   = useState("");
  const [faceMessage,    setFaceMessage]    = useState("");
  const [customFileName, setCustomFileName] = useState("");
  const [draftFileName,  setDraftFileName]  = useState("");
  const [isEditingName,  setIsEditingName]  = useState(false);
  const [isModelLoaded,  setIsModelLoaded]  = useState(false);
  const [modelType,      setModelType]      = useState<"ssd" | "tiny">("tiny");
  const [backendStatus,  setBackendStatus]  = useState<"checking" | "online" | "offline">("checking");
  const [locationQuery,  setLocationQuery]  = useState("");
  const [manualCoords,   setManualCoords]   = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [lastFacePhotoId,  setLastFacePhotoId]  = useState<string | null>(null);
  const [nearbyPlaces,     setNearbyPlaces]     = useState<NearbyPlace[]>([]);
  const [placesLoading,    setPlacesLoading]    = useState(false);
  const [placesFetched,    setPlacesFetched]    = useState(false);

  useEffect(() => {
    const MODEL_URL = "/models";
    Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => { setModelType("ssd"); setIsModelLoaded(true); })
      .catch(() => {
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
          .then(() => { setModelType("tiny"); setIsModelLoaded(true); })
          .catch((err) => console.error("AI model load failed", err));
      });
  }, []);

  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then((r) => setBackendStatus(r.ok ? "online" : "offline"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSavedMessage("");
    setFaceMessage("");
    setManualCoords(null);
    setLocationQuery("");
    setLocationStatus("idle");
    setLastFacePhotoId(null);
    setNearbyPlaces([]);
    setPlacesFetched(false);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCustomFileName(file.name);
    setDraftFileName(file.name);
    setIsEditingName(false);
    setLoading(true);

    try {
      let lat: number | null = null;
      let lng: number | null = null;
      let captureDate = "Not available";
      let captureTime = "Not available";
      let location    = "No GPS data";
      let detectedFaceCount = 0;
      let faceBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
      let faceDescriptors: number[][] = [];

      if (backendStatus === "online") {
        const data = await analyzeWithBackend(file);
        lat           = data.latitude   ?? null;
        lng           = data.longitude  ?? null;
        captureDate   = data.captureDate ?? "Not available";
        captureTime   = data.captureTime ?? "Not available";
        location      = data.location ?? (lat !== null ? `${lat.toFixed(6)}, ${lng?.toFixed(6)}` : "No GPS data");
        detectedFaceCount = data.faceCount ?? 0;
        faceBoxes     = (data.faceBoxes ?? []).map((b) => ({ x: b.x_norm, y: b.y_norm, width: b.w_norm, height: b.h_norm }));
        faceDescriptors = data.descriptors ?? [];
      } else {
        const exifData: any = await exifr.parse(file).catch(() => null);
        const gpsData:  any = await exifr.gps(file).catch(() => null);
        lat = typeof gpsData?.latitude  === "number" ? gpsData.latitude  : null;
        lng = typeof gpsData?.longitude === "number" ? gpsData.longitude : null;
        const takenAt = exifData?.DateTimeOriginal || exifData?.CreateDate || null;
        if (takenAt) {
          const d = new Date(takenAt);
          captureDate = d.toLocaleDateString();
          captureTime = d.toLocaleTimeString();
        }
        if (lat !== null && lng !== null) {
          const addr = await reverseGeocode(lat, lng);
          location = addr || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }

        if (isModelLoaded) {
          const imgEl = await faceapi.fetchImage(URL.createObjectURL(file));
          const AREA_THRESHOLD = 0.12;
          if (modelType === "ssd") {
            const all = await faceapi
              .detectAllFaces(imgEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
              .withFaceLandmarks()
              .withFaceDescriptors();
            const areas = all.map((d) => d.detection.box.width * d.detection.box.height);
            const maxArea = areas.length > 0 ? Math.max(...areas) : 0;
            const filtered = maxArea > 0 ? all.filter((_, i) => areas[i] / maxArea >= AREA_THRESHOLD) : all;
            detectedFaceCount = filtered.length;
            faceBoxes = filtered.map((d) => ({
              x: d.detection.box.x / imgEl.naturalWidth,
              y: d.detection.box.y / imgEl.naturalHeight,
              width: d.detection.box.width / imgEl.naturalWidth,
              height: d.detection.box.height / imgEl.naturalHeight,
            }));
            faceDescriptors = filtered.map((d) => Array.from(d.descriptor));
          } else {
            const detections = await faceapi.detectAllFaces(
              imgEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.3 })
            );
            const areas = detections.map((d) => d.box.width * d.box.height);
            const maxArea = areas.length > 0 ? Math.max(...areas) : 0;
            const filtered = maxArea > 0 ? detections.filter((_, i) => areas[i] / maxArea >= AREA_THRESHOLD) : detections;
            detectedFaceCount = filtered.length;
            faceBoxes = filtered.map((d) => ({
              x: d.box.x / imgEl.naturalWidth,
              y: d.box.y / imgEl.naturalHeight,
              width: d.box.width / imgEl.naturalWidth,
              height: d.box.height / imgEl.naturalHeight,
            }));
          }
        }
      }

      const category = detectedFaceCount > 0 ? "인물 사진" : "일반 사진";
      setPhotoInfo({
        fileName: file.name, fileType: file.type || "unknown",
        fileSize: formatBytes(file.size), uploadedAt: new Date().toLocaleString(),
        captureDate, captureTime, location, lat, lng,
        faceCount: detectedFaceCount, category,
      });

      if (lat !== null && lng !== null && backendStatus === "online") {
        setPlacesLoading(true);
        fetchNearbyPlaces(lat, lng).then((places) => {
          setNearbyPlaces(places);
          setPlacesFetched(true);
          setPlacesLoading(false);
        });
      }

      if (detectedFaceCount > 0) {
        const thumbnail = await createThumbnailDataUrl(file, 420, 0.75);
        const facePhotoId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const facePhoto: FacePhoto = {
          id: facePhotoId, fileName: file.name, imageUrl: thumbnail,
          faceCount: detectedFaceCount, uploadedAt: new Date().toLocaleString(),
          boxes: faceBoxes,
          ...(faceDescriptors.length > 0 && { descriptors: faceDescriptors }),
          ...(lat !== null && lng !== null && { lat, lng }),
          ...(lat !== null && location !== "No GPS data" && { location }),
        };
        const raw  = localStorage.getItem(FACES_STORAGE_KEY);
        const prev: FacePhoto[] = raw ? JSON.parse(raw) : [];
        localStorage.setItem(FACES_STORAGE_KEY, JSON.stringify([facePhoto, ...prev]));
        setLastFacePhotoId(facePhotoId);
        setFaceMessage(`얼굴 ${detectedFaceCount}명 감지! Faces 앨범에 자동 저장되었습니다.`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleLocationSearch() {
    if (!locationQuery.trim()) return;
    setLocationStatus("searching");
    const result = await forwardGeocode(locationQuery.trim());
    if (result) {
      setManualCoords(result);
      setLocationStatus("done");
      if (backendStatus === "online") {
        setPlacesLoading(true);
        setNearbyPlaces([]);
        setPlacesFetched(false);
        fetchNearbyPlaces(result.lat, result.lng).then((places) => {
          setNearbyPlaces(places);
          setPlacesFetched(true);
          setPlacesLoading(false);
        });
      }
    } else {
      setLocationStatus("error");
    }
  }

  function handleCurrentLocation() {
    if (!navigator.geolocation) { alert("브라우저가 위치 정보를 지원하지 않습니다."); return; }
    setLocationStatus("searching");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const name = await reverseGeocode(lat, lng);
        setManualCoords({ lat, lng, name: name || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
        setLocationStatus("done");
        if (backendStatus === "online") {
          setPlacesLoading(true);
          setNearbyPlaces([]);
          setPlacesFetched(false);
          fetchNearbyPlaces(lat, lng).then((places) => {
            setNearbyPlaces(places);
            setPlacesFetched(true);
            setPlacesLoading(false);
          });
        }
      },
      () => { alert("위치 정보를 가져올 수 없습니다."); setLocationStatus("error"); }
    );
  }

  function startEditName() { setDraftFileName(customFileName); setIsEditingName(true); }
  function saveEditedName() {
    const newName = draftFileName.trim();
    if (newName) {
      setCustomFileName(newName);
      if (lastFacePhotoId) {
        const raw = localStorage.getItem(FACES_STORAGE_KEY);
        if (raw) {
          const photos: FacePhoto[] = JSON.parse(raw);
          const updated = photos.map((p) => p.id === lastFacePhotoId ? { ...p, fileName: newName } : p);
          localStorage.setItem(FACES_STORAGE_KEY, JSON.stringify(updated));
        }
      }
    }
    setIsEditingName(false);
  }

  async function handleSaveToMap() {
    if (!selectedFile || !photoInfo) return;
    const effectiveLat = photoInfo.lat ?? manualCoords?.lat ?? null;
    const effectiveLng = photoInfo.lng ?? manualCoords?.lng ?? null;
    if (effectiveLat === null || effectiveLng === null) {
      alert("위치 정보가 없습니다. 아래 위치 입력란에서 장소를 검색하거나 현재 위치를 사용하세요.");
      return;
    }
    const smallPreview = await createThumbnailDataUrl(selectedFile, 420, 0.6);
    const photo: MapPhoto = {
      id: Date.now().toString(), fileName: customFileName.trim() || selectedFile.name,
      imageUrl: smallPreview, lat: effectiveLat, lng: effectiveLng,
      location: manualCoords?.name ?? photoInfo.location,
      captureDate: photoInfo.captureDate, captureTime: photoInfo.captureTime,
      uploadedAt: photoInfo.uploadedAt, faceCount: photoInfo.faceCount,
    };
    const raw  = localStorage.getItem(MAP_STORAGE_KEY);
    const prev = raw ? JSON.parse(raw) : [];
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify([...prev, photo]));
    setSavedMessage("지도 및 앨범에 저장되었습니다!");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 pb-28">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Camera size={22} className="text-white" />
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">TravelLens</h1>
          </div>
          <p className="text-slate-500 ml-[52px] text-sm">여행 사진을 업로드하면 위치·얼굴을 자동으로 분석합니다.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Upload Section ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Upload Photo</h2>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  backendStatus === "online"   ? "bg-emerald-500" :
                  backendStatus === "offline"  ? "bg-slate-400"   : "bg-amber-400"
                }`} />
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  {backendStatus === "online"   ? <><Wifi size={12} /> API 연결됨</> :
                   backendStatus === "offline"  ? <><WifiOff size={12} /> 브라우저 모드</> :
                   "확인 중..."}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Drop zone */}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-10 cursor-pointer bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 group">
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
                  <Upload size={26} className="text-blue-600" />
                </div>
                <p className="font-semibold text-slate-700 group-hover:text-blue-700 transition-colors">클릭해서 사진 선택</p>
                <p className="text-xs text-slate-400 mt-1">JPG, PNG, HEIC 등</p>
                {!isModelLoaded && (
                  <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" /> AI 엔진 준비 중...
                  </p>
                )}
                {isModelLoaded && modelType === "ssd" && (
                  <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1 font-medium">
                    <CheckCircle2 size={12} /> 고급 감지 모드 (SSD + 얼굴 인식)
                  </p>
                )}
                {isModelLoaded && modelType === "tiny" && (
                  <p className="mt-2 text-xs text-amber-500 flex items-center gap-1">
                    <AlertTriangle size={12} /> 기본 감지 모드
                  </p>
                )}
              </label>

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center gap-2 text-blue-600 py-2 text-sm font-medium">
                  <Loader2 size={16} className="animate-spin" />
                  분석 중...
                </div>
              )}

              {/* Face detection message */}
              {faceMessage && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <Users size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-semibold text-blue-700">{faceMessage}</p>
                </div>
              )}

              {/* GPS missing — manual location input */}
              {photoInfo && photoInfo.lat === null && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-bold text-orange-700 flex items-center gap-2">
                    <MapPin size={15} /> GPS 정보 없음 — 위치를 직접 입력해주세요
                  </p>

                  <button
                    onClick={handleCurrentLocation}
                    disabled={locationStatus === "searching"}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                  >
                    {locationStatus === "searching"
                      ? <><Loader2 size={14} className="animate-spin" /> 위치 가져오는 중...</>
                      : <><Navigation size={14} /> 현재 위치 사용 (GPS)</>
                    }
                  </button>

                  <div className="flex gap-2">
                    <input
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLocationSearch()}
                      placeholder="장소 검색 (예: 에펠탑, 제주도)"
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                    />
                    <button
                      onClick={handleLocationSearch}
                      disabled={locationStatus === "searching"}
                      className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
                    >
                      <Search size={15} />
                    </button>
                  </div>

                  {locationStatus === "done" && manualCoords && (
                    <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} /> 위치 설정됨: {manualCoords.name.slice(0, 60)}...
                    </p>
                  )}
                  {locationStatus === "error" && (
                    <p className="text-xs text-red-500 font-medium">장소를 찾을 수 없습니다. 다른 이름으로 검색해보세요.</p>
                  )}
                </div>
              )}

              {/* File name edit + save button */}
              {photoInfo && (
                <div className="space-y-3 pt-1">
                  {isEditingName ? (
                    <div className="flex gap-2">
                      <input
                        value={draftFileName}
                        onChange={(e) => setDraftFileName(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                      <button onClick={saveEditedName}
                        className="bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 transition-colors">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setIsEditingName(false)}
                        className="bg-slate-100 text-slate-600 px-3 py-2 rounded-xl hover:bg-slate-200 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                      <FileImage size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="flex-1 text-sm text-slate-700 truncate">{customFileName}</span>
                      <button onClick={startEditName}
                        className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}

                  <button onClick={handleSaveToMap}
                    className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 text-white py-3.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-slate-200">
                    <Save size={16} /> 지도에 저장
                  </button>

                  {savedMessage && (
                    <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm font-semibold">
                      <CheckCircle2 size={16} /> {savedMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Analysis Result Section ── */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
              <Cpu size={18} className="text-slate-500" />
              <h2 className="text-lg font-bold text-slate-800">Analysis Result</h2>
            </div>

            <div className="p-6">
              {photoInfo && previewUrl ? (
                <div className="space-y-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={customFileName}
                    className="w-full max-h-64 object-cover rounded-xl border border-slate-100"
                  />

                  {/* Face count banner */}
                  <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                    photoInfo.faceCount > 0
                      ? "bg-blue-50 border-blue-200"
                      : "bg-slate-50 border-slate-200"
                  }`}>
                    <div>
                      <p className="text-xs text-slate-400 mb-0.5">AI 분류 결과</p>
                      <p className={`font-extrabold text-lg ${photoInfo.faceCount > 0 ? "text-blue-700" : "text-slate-700"}`}>
                        {photoInfo.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-extrabold ${photoInfo.faceCount > 0 ? "text-blue-600" : "text-slate-300"}`}>
                        {photoInfo.faceCount}
                      </p>
                      <p className="text-xs text-slate-400">명 감지</p>
                    </div>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <InfoRow label="File name"    value={customFileName}        icon={FileImage}   />
                    <InfoRow label="File size"    value={photoInfo.fileSize}    icon={Ruler}       />
                    <InfoRow label="Capture date" value={photoInfo.captureDate} icon={CalendarDays}/>
                    <InfoRow label="Capture time" value={photoInfo.captureTime} icon={Clock}       />
                    <InfoRow label="Location"     value={photoInfo.location}    icon={MapPin}      />
                    <InfoRow
                      label="Coordinates"
                      value={
                        photoInfo.lat != null
                          ? `${photoInfo.lat.toFixed(4)}, ${photoInfo.lng?.toFixed(4)}`
                          : manualCoords
                            ? `${manualCoords.lat.toFixed(4)}, ${manualCoords.lng.toFixed(4)} (수동)`
                            : "None"
                      }
                      icon={Navigation}
                    />
                  </div>

                  {/* Nearby places */}
                  {(placesLoading || placesFetched) && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
                        <MapPin size={11} /> Nearby Places
                      </p>

                      {placesLoading && (
                        <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                          <Loader2 size={14} className="animate-spin" />
                          주변 장소 검색 중...
                        </div>
                      )}

                      {!placesLoading && placesFetched && nearbyPlaces.length === 0 && (
                        <p className="text-sm text-slate-400 italic py-1">500m 이내에 등록된 장소가 없습니다.</p>
                      )}

                      {!placesLoading && nearbyPlaces.length > 0 && (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                          {nearbyPlaces.map((place, i) => {
                            const Icon = place.type === "cafe" ? Coffee : place.type === "bar" ? Wine : Utensils;
                            const typeLabel = place.type === "cafe" ? "Cafe" : place.type === "bar" ? "Bar" : "Restaurant";
                            const typeColor = place.type === "cafe"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : place.type === "bar"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200";
                            return (
                              <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${typeColor}`}>
                                  <Icon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{place.name}</p>
                                  <p className="text-[11px] text-slate-400">
                                    {typeLabel}{place.cuisine ? ` · ${place.cuisine}` : ""}
                                  </p>
                                </div>
                                <span className="text-xs font-bold text-slate-500 flex-shrink-0">{place.distance_m}m</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <Camera size={28} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 text-sm">사진을 선택하면 여기에 분석 결과가 표시됩니다</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}
