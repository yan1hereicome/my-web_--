import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "TravelLens",
  description: "Photo map & face detection app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
