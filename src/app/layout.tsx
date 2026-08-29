import type { Metadata, Viewport } from "next";

import { AppSplash } from "@/components/app-splash";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

import "./globals.css";

export const metadata: Metadata = {
  title: "Car Care",
  description: "自家用車の維持管理アプリ（給油・メンテナンス・コスト管理）",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Car Care",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192-v2.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1d4ed8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="flex min-h-full flex-col text-slate-900 antialiased dark:text-slate-100">
        <AppSplash />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
