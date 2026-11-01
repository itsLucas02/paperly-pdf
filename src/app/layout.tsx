import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/dm-sans/latin-800.css";
import "./globals.css";
import { PWARegistration } from "@/components/pwa-registration";

export const metadata: Metadata = {
  title: "paperly — All your PDF tools. One happy place.",
  description: "Every tool you need to work with PDFs, in one happy place. Merge, split, compress, convert, rotate, protect and watermark PDFs. Free, private, and right in your browser.",
  applicationName: "paperly",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "paperly" },
  formatDetection: { telephone: false },
  openGraph: { title: "paperly — Your everyday PDF companion", description: "Less PDF hassle. More getting things done. 20 free PDF tools, processed privately on your device.", siteName: "paperly", type: "website" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fafbf9", viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><PWARegistration />{children}</body></html>;
}
