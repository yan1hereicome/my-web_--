import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravelLens",
  description: "Photo map & face detection app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
