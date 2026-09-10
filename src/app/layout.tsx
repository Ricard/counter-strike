import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vector Strike — Sector 07",
  description: "FPS tàctic WebGL2 amb simulació Rapier a 64 Hz.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b1215",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  );
}
