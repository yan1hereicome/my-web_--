"use client";

import BottomNav from "@/components/BottomNav";

export default function SavedPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "24px", paddingBottom: "110px" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <div
          style={{
            background: "white",
            borderRadius: "18px",
            padding: "24px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ fontSize: "48px", fontWeight: 800, marginTop: 0 }}>Saved</h1>
          <p style={{ color: "#475569", fontSize: "18px", lineHeight: 1.7 }}>
            This page can be used later for favorites, notes, or bookmarked photos.
          </p>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}