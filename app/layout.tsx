import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./contrast.css";
export const metadata: Metadata = {
  title: "Travel Together · 가족여행",
  description: "함께 준비하고, 여유롭게 떠나는 가족여행",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Travel Together",
    statusBarStyle: "default",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#087f73",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
