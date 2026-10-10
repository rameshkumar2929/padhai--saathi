import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Padhai Saathi | Your study companion",
  description: "A simple multilingual study companion for Classes 8-10.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#075b56" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
