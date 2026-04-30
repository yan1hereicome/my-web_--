"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Map, Image, Users, Star, LogOut } from "lucide-react";

const navItems = [
  { href: "/",       icon: Home,   label: "Home"   },
  { href: "/map",    icon: Map,    label: "Map"    },
  { href: "/albums", icon: Image,  label: "Albums" },
  { href: "/faces",  icon: Users,  label: "Faces"  },
  { href: "/saved",  icon: Star,   label: "Saved"  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router   = useRouter();

  function handleLogout() {
    localStorage.removeItem("tl_auth");
    router.push("/login");
  }

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[min(820px,calc(100%-24px))] z-50">
      <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-full px-3 py-2 shadow-xl flex items-center gap-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-full transition-all duration-150 ${
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className={`text-[11px] font-semibold ${active ? "text-blue-600" : "text-slate-500"}`}>
                {label}
              </span>
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          title="Log out"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors duration-150 flex-shrink-0 ml-1"
        >
          <LogOut size={17} strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
}
