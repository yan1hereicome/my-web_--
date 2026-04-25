"use client";

import { ChangeEvent, useState, useEffect } from "react";
import * as exifr from "exifr";
import * as faceapi from "face-api.js";
import BottomNav from "@/components/BottomNav";

// ── 타입 ──────────────────────────────────────
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

// 얼굴 사진 자동 저장용 타입
export type FacePhoto = {
  id: string;
  fileName: string;
  imageUrl: string; // base64 thumbnail
  faceCount: number;
  uploadedAt: string;
  boxes?: Array<{ x: number; y: number; width: number; height: number }>; // 정규화 좌표 (0-1)
  descriptors?: number[][]; // 128-dim face recognition vectors (one per face, for person clustering)
  lat?: number;
  lng?: number;
  location?: string;
};

// ── 스토리지 키 ───────────────────────────────
const MAP_STORAGE_KEY   = "photoMapPhotos";
const FACES_STORAGE_KEY = "facesPhotos";   // 얼굴 자동 분류 앨범

const BACKEND_URL = "http://localhost:8000";

// ── 유틸 함수 ─────────────────────────────────
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
  } catch {
    return "";
  }
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
  } catch {
    return null;
  }
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

// ── 메인 컴포넌트 ──────────────────────────────
export default function HomePage() {
  const [selectedFile, setSelectedFile]   = useState<File | null>(null);
  const [previewUrl,   setPreviewUrl]     = useState("");
  const [photoInfo,    setPhotoInfo]      = useState<PhotoInfo | null>(null);
  const [loading,      setLoading]        = useState(false);
  const [savedMessage, setSavedMessage]   = useState("");
  const [faceMessage,  setFaceMessage]    = useState("");
  const [customFileName,  setCustomFileName]  = useState("");
  const [draftFileName,   setDraftFileName]   = useState("");
  const [isEditingName,   setIsEditingName]   = useState(false);
  const [isModelLoaded,   setIsModelLoaded]   = useState(false);
  const [modelType,       setModelType]       = useState<"ssd" | "tiny">("tiny");
  const [backendStatus,   setBackendStatus]   = useState<"checking" | "online" | "offline">("checking");
  const [locationQuery,   setLocationQuery]   = useState("");
  const [manualCoords,    setManualCoords]    = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [locationStatus,  setLocationStatus]  = useState<"idle"|"searching"|"done"|"error">("idle");
  const [lastFacePhotoId, setLastFacePhotoId] = useState<string | null>(null);

  // 모델 로드 (앱 시작 시 한 번) — SSD 우선, 없으면 TinyFaceDetector로 폴백
  useEffect(() => {
    const MODEL_URL = "/models";
    Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => {
      setModelType("ssd");
      setIsModelLoaded(true);
    }).catch(() => {
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        .then(() => { setModelType("tiny"); setIsModelLoaded(true); })
        .catch((err) => console.error("AI 모델 로드 실패", err));
    });
  }, []);

  // 백엔드 서버 온라인 여부 확인 (앱 시작 시 한 번)
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then((r) => setBackendStatus(r.ok ? "online" : "offline"))
      .catch(() => setBackendStatus("offline"));
  }, []);

  // 파일 선택 → 분석
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSavedMessage("");
    setFaceMessage("");
    setManualCoords(null);
    setLocationQuery("");
    setLocationStatus("idle");
    setLastFacePhotoId(null);
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
        // ── 백엔드 API 경로 ──────────────────────────────────────
        const data = await analyzeWithBackend(file);
        lat           = data.latitude   ?? null;
        lng           = data.longitude  ?? null;
        captureDate   = data.captureDate ?? "Not available";
        captureTime   = data.captureTime ?? "Not available";
        location      = data.location
          ?? (lat !== null ? `${lat.toFixed(6)}, ${lng?.toFixed(6)}` : "No GPS data");
        detectedFaceCount = data.faceCount ?? 0;
        faceBoxes     = (data.faceBoxes ?? []).map((b) => ({
          x: b.x_norm, y: b.y_norm, width: b.w_norm, height: b.h_norm,
        }));
        faceDescriptors = data.descriptors ?? [];
      } else {
        // ── 브라우저 경로 (백엔드 오프라인일 때 폴백) ────────────
        // ① EXIF 분석
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

        // ② 얼굴 감지 (SSD + 크기 휴리스틱 필터링 + 128-dim 특징 벡터)
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
              x:      d.detection.box.x      / imgEl.naturalWidth,
              y:      d.detection.box.y      / imgEl.naturalHeight,
              width:  d.detection.box.width  / imgEl.naturalWidth,
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
              x:      d.box.x      / imgEl.naturalWidth,
              y:      d.box.y      / imgEl.naturalHeight,
              width:  d.box.width  / imgEl.naturalWidth,
              height: d.box.height / imgEl.naturalHeight,
            }));
          }
        }
      }

      const category = detectedFaceCount > 0 ? "인물 사진" : "일반 사진";
      setPhotoInfo({
        fileName: file.name,
        fileType: file.type || "unknown",
        fileSize: formatBytes(file.size),
        uploadedAt: new Date().toLocaleString(),
        captureDate,
        captureTime,
        location,
        lat,
        lng,
        faceCount: detectedFaceCount,
        category,
      });

      // ③ 얼굴이 있으면 → Faces 앨범에 자동 저장
      if (detectedFaceCount > 0) {
        const thumbnail = await createThumbnailDataUrl(file, 420, 0.75);
        const facePhotoId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const facePhoto: FacePhoto = {
          id:          facePhotoId,
          fileName:    file.name,
          imageUrl:    thumbnail,
          faceCount:   detectedFaceCount,
          uploadedAt:  new Date().toLocaleString(),
          boxes:       faceBoxes,
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
          const updated = photos.map((p) =>
            p.id === lastFacePhotoId ? { ...p, fileName: newName } : p
          );
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
      id:          Date.now().toString(),
      fileName:    customFileName.trim() || selectedFile.name,
      imageUrl:    smallPreview,
      lat:         effectiveLat,
      lng:         effectiveLng,
      location:    manualCoords?.name ?? photoInfo.location,
      captureDate: photoInfo.captureDate,
      captureTime: photoInfo.captureTime,
      uploadedAt:  photoInfo.uploadedAt,
      faceCount:   photoInfo.faceCount,
    };
    const raw  = localStorage.getItem(MAP_STORAGE_KEY);
    const prev = raw ? JSON.parse(raw) : [];
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify([...prev, photo]));
    setSavedMessage("지도 및 앨범에 저장되었습니다!");
  }

  // ── 렌더 ───────────────────────────────────
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "32px", paddingBottom: "110px" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "48px", fontWeight: 800, marginBottom: "4px" }}>TravelLens</h1>
        <p style={{ color: "#64748b", marginBottom: "32px" }}>
          여행 사진을 업로드하면 위치·얼굴을 자동으로 분석합니다.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

          {/* ── 업로드 섹션 ─────────────────────── */}
          <section style={{ background: "white", borderRadius: "20px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Upload Photo</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{
                  width: "8px", height: "8px", borderRadius: "50%", display: "inline-block", flexShrink: 0,
                  background: backendStatus === "online" ? "#16a34a" : backendStatus === "offline" ? "#94a3b8" : "#f59e0b",
                }} />
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {backendStatus === "online"   ? "API 연결됨"
                   : backendStatus === "offline" ? "브라우저 모드"
                   : "확인 중..."}
                </span>
              </div>
            </div>

            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: "2px dashed #cbd5e1", borderRadius: "16px", padding: "36px 20px",
              cursor: "pointer", background: "#f8fafc", minHeight: "160px",
            }}>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
              <span style={{ fontSize: "44px" }}>📷</span>
              <span style={{ marginTop: "10px", fontWeight: 600, color: "#475569" }}>클릭해서 사진 선택</span>
              {!isModelLoaded && (
                <span style={{ marginTop: "6px", fontSize: "12px", color: "#94a3b8" }}>
                  AI 엔진 준비 중...
                </span>
              )}
              {isModelLoaded && modelType === "ssd" && (
                <span style={{ marginTop: "6px", fontSize: "11px", color: "#16a34a" }}>
                  ✓ 고급 감지 모드 (SSD + 얼굴 인식)
                </span>
              )}
              {isModelLoaded && modelType === "tiny" && (
                <span style={{ marginTop: "6px", fontSize: "11px", color: "#f59e0b" }}>
                  ⚠️ 기본 감지 모드 — bash _scripts/download-models.sh 실행 시 업그레이드
                </span>
              )}
            </label>

            {loading && (
              <p style={{ textAlign: "center", color: "#2563eb", margin: "14px 0 0" }}>
                분석 중...
              </p>
            )}

            {faceMessage && (
              <div style={{
                marginTop: "12px", background: "#eff6ff", border: "1px solid #bfdbfe",
                borderRadius: "10px", padding: "10px 14px",
                color: "#1d4ed8", fontWeight: 600, fontSize: "14px",
              }}>
                {faceMessage}
              </div>
            )}

            {photoInfo && photoInfo.lat === null && (
              <div style={{
                marginTop: "12px", background: "#fff7ed", border: "1px solid #fed7aa",
                borderRadius: "12px", padding: "14px",
              }}>
                <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: "13px", color: "#c2410c" }}>
                  📍 GPS 정보 없음 — 위치를 직접 입력해주세요
                </p>

                <button
                  onClick={handleCurrentLocation}
                  disabled={locationStatus === "searching"}
                  style={{
                    width: "100%", background: "#2563eb", color: "white", border: "none",
                    borderRadius: "8px", padding: "9px", fontWeight: 700, fontSize: "13px",
                    cursor: locationStatus === "searching" ? "wait" : "pointer", marginBottom: "8px",
                  }}
                >
                  {locationStatus === "searching" ? "위치 가져오는 중..." : "현재 위치 사용 (GPS)"}
                </button>

                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    value={locationQuery}
                    onChange={(e) => setLocationQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLocationSearch()}
                    placeholder="장소 검색 (예: 에펠탑, 제주도)"
                    style={{
                      flex: 1, border: "1px solid #e2e8f0", borderRadius: "8px",
                      padding: "8px 10px", fontSize: "13px",
                    }}
                  />
                  <button
                    onClick={handleLocationSearch}
                    disabled={locationStatus === "searching"}
                    style={{
                      background: "#0f172a", color: "white", border: "none",
                      borderRadius: "8px", padding: "8px 14px",
                      cursor: "pointer", fontWeight: 700, fontSize: "13px",
                    }}
                  >
                    검색
                  </button>
                </div>

                {locationStatus === "done" && manualCoords && (
                  <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#16a34a", fontWeight: 600 }}>
                    위치 설정됨: {manualCoords.name.slice(0, 60)}...
                  </p>
                )}
                {locationStatus === "error" && (
                  <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#dc2626" }}>
                    장소를 찾을 수 없습니다. 다른 이름으로 검색해보세요.
                  </p>
                )}
              </div>
            )}

            {photoInfo && (
              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {isEditingName ? (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      value={draftFileName}
                      onChange={(e) => setDraftFileName(e.target.value)}
                      style={{ flex: 1, border: "1px solid #cbd5e1", borderRadius: "8px", padding: "8px 12px", fontSize: "14px" }}
                    />
                    <button onClick={saveEditedName}
                      style={{ background: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontWeight: 600 }}>
                      저장
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ flex: 1, fontSize: "13px", color: "#334155" }}>{customFileName}</span>
                    <button onClick={startEditName}
                      style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "13px" }}>
                      이름 변경
                    </button>
                  </div>
                )}

                <button onClick={handleSaveToMap} style={{
                  width: "100%", background: "#0f172a", color: "white", border: "none",
                  borderRadius: "12px", padding: "14px", fontWeight: 700, fontSize: "16px", cursor: "pointer",
                }}>
                  지도에 저장
                </button>
                {savedMessage && (
                  <p style={{ textAlign: "center", color: "#16a34a", fontWeight: 600, margin: 0 }}>{savedMessage}</p>
                )}
              </div>
            )}
          </section>

          {/* ── 분석 결과 섹션 ───────────────────── */}
          <section style={{ background: "white", borderRadius: "20px", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "16px" }}>Analysis Result</h2>

            {photoInfo && previewUrl ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URL */}
                <img src={previewUrl} alt={customFileName}
                  style={{ width: "100%", maxHeight: "280px", objectFit: "cover", borderRadius: "14px" }} />

                <div style={{
                  background: photoInfo.faceCount > 0 ? "#eff6ff" : "#f8fafc",
                  border: `1px solid ${photoInfo.faceCount > 0 ? "#bfdbfe" : "#e2e8f0"}`,
                  borderRadius: "14px", padding: "14px 18px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>AI 분류 결과</p>
                    <p style={{ margin: "2px 0 0", fontWeight: 800, fontSize: "20px",
                      color: photoInfo.faceCount > 0 ? "#1d4ed8" : "#334155" }}>
                      {photoInfo.category}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "28px", fontWeight: 800,
                      color: photoInfo.faceCount > 0 ? "#2563eb" : "#94a3b8" }}>
                      {photoInfo.faceCount}
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>명 감지</p>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <InfoRow label="File name"    value={customFileName} />
                  <InfoRow label="File size"    value={photoInfo.fileSize} />
                  <InfoRow label="Capture date" value={photoInfo.captureDate} />
                  <InfoRow label="Capture time" value={photoInfo.captureTime} />
                  <InfoRow label="Location"     value={photoInfo.location} />
                  <InfoRow label="Coordinates"
                    value={photoInfo.lat != null
                      ? `${photoInfo.lat.toFixed(4)}, ${photoInfo.lng?.toFixed(4)}`
                      : manualCoords
                        ? `${manualCoords.lat.toFixed(4)}, ${manualCoords.lng.toFixed(4)} (수동)`
                        : "None"} />
                </div>
              </div>
            ) : (
              <div style={{ height: "380px", display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px dashed #e2e8f0", borderRadius: "16px" }}>
                <p style={{ color: "#94a3b8" }}>사진을 선택하면 여기에 분석 결과가 표시됩니다</p>
              </div>
            )}
          </section>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "8px 12px" }}>
      <p style={{ margin: 0, color: "#94a3b8", fontSize: "11px" }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontWeight: 700, fontSize: "13px", wordBreak: "break-all" }}>{value}</p>
    </div>
  );
}
