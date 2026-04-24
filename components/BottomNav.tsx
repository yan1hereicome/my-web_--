"use client";

import Link from "next/link";
<<<<<<< HEAD
import { usePathname } from "next/navigation";
=======
import { usePathname, useRouter } from "next/navigation";
>>>>>>> 85f8f6b (update project)

const navItems = [
  { href: "/", icon: "🏠", label: "Home" },
  { href: "/map", icon: "🗺️", label: "Map" },
  { href: "/albums", icon: "🖼️", label: "Albums" },
  { href: "/faces", icon: "🙂", label: "Faces" },
  { href: "/saved", icon: "⭐", label: "Saved" },
];

export default function BottomNav() {
  const pathname = usePathname();
<<<<<<< HEAD
=======
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem("tl_auth");
    router.push("/login");
  }
>>>>>>> 85f8f6b (update project)

  return (
    <nav style={{
      position: "fixed", left: "50%", bottom: "18px",
<<<<<<< HEAD
      transform: "translateX(-50%)", width: "min(720px, calc(100% - 24px))",
=======
      transform: "translateX(-50%)", width: "min(820px, calc(100% - 24px))",
>>>>>>> 85f8f6b (update project)
      background: "rgba(255,255,255,0.96)", border: "1px solid #e2e8f0",
      borderRadius: "999px", padding: "10px 14px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.08)", zIndex: 1000,
      backdropFilter: "blur(12px)", display: "grid",
<<<<<<< HEAD
      gridTemplateColumns: `repeat(${navItems.length}, 1fr)`, gap: "8px"
=======
      gridTemplateColumns: `repeat(${navItems.length}, 1fr) 44px`, gap: "8px",
      alignItems: "center",
>>>>>>> 85f8f6b (update project)
    }}>
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} style={{
            textDecoration: "none", color: active ? "#2563eb" : "#475569",
            background: active ? "#eff6ff" : "transparent",
            borderRadius: "999px", padding: "8px 6px",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: "4px", fontWeight: 700, fontSize: "12px",
          }}>
            <span style={{ fontSize: "20px" }}>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
<<<<<<< HEAD
=======
      <button
        onClick={handleLogout}
        title="Log out"
        style={{
          background: "#fef2f2", border: "1.5px solid #fecaca",
          borderRadius: "999px", width: "40px", height: "40px",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: "17px", color: "#dc2626",
          flexShrink: 0,
        }}
      >
        🚪
      </button>
>>>>>>> 85f8f6b (update project)
    </nav>
  );
}
