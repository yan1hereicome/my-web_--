import type { Metadata } from "next";
import "./globals.css";
<<<<<<< HEAD
=======
import AuthGuard from "@/components/AuthGuard";
>>>>>>> 85f8f6b (update project)

export const metadata: Metadata = {
  title: "TravelLens",
  description: "Photo map & face detection app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
<<<<<<< HEAD
        {children}
=======
        <AuthGuard>{children}</AuthGuard>
>>>>>>> 85f8f6b (update project)
      </body>
    </html>
  );
}
