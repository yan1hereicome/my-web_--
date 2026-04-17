"use client";

import { useEffect, useMemo, useState } from "react";
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
};

const STORAGE_KEY = "photoMapPhotos";

export default function AlbumsPage() {
  const [photos, setPhotos] = useState<MapPhoto[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setPhotos(JSON.parse(raw));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, MapPhoto[]>();
    for (const photo of photos) {
      const key = (photo.location || "Unknown location").split(",")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(photo);
    }
    return Array.from(map.entries());
  }, [photos]);

  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", paddingBottom: "110px" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "48px", fontWeight: 800 }}>Albums</h1>
        <p style={{ color: "#475569", marginBottom: "24px" }}>
          Photos grouped by location.
        </p>

        {grouped.length === 0 ? (
          <div style={{ background: "white", borderRadius: "18px", padding: "20px" }}>
            No photos saved yet.
          </div>
        ) : (
          grouped.map(([groupName, items]) => (
            <section
              key={groupName}
              style={{
                background: "white",
                borderRadius: "18px",
                padding: "20px",
                marginBottom: "20px",
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              }}
            >
              <h2 style={{ marginTop: 0, fontSize: "24px", fontWeight: 800 }}>
                {groupName} ({items.length})
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: "16px",
                }}
              >
                {items.map((photo) => (
                  <div key={photo.id}>
                    <img
                      src={photo.imageUrl}
                      alt={photo.fileName}
                      style={{
                        width: "100%",
                        height: "180px",
                        objectFit: "cover",
                        borderRadius: "12px",
                      }}
                    />
                    <p style={{ margin: "8px 0 0 0", fontWeight: 700 }}>{photo.fileName}</p>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}