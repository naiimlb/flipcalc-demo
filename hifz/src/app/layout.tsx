import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Amiri_Quran, Scheherazade_New } from "next/font/google";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { ServiceWorkerRegistration } from "@/components/ServiceWorker";
import { TabBar } from "@/components/TabBar";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

const amiri = Amiri_Quran({
  weight: "400",
  subsets: ["arabic"],
  variable: "--font-amiri-quran",
  display: "swap",
});

const scheherazade = Scheherazade_New({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-scheherazade-new",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Hifz", template: "%s · Hifz" },
  description: "Mémoriser le Coran verset par verset, avec des révisions espacées.",
  applicationName: "Hifz",
  appleWebApp: { capable: true, title: "Hifz", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1211" },
  ],
};

/** Pose data-theme avant le premier rendu pour éviter un flash de la mauvaise couleur. */
const themeScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${amiri.variable} ${scheherazade.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ServiceWorkerRegistration />
        <SettingsProvider>
          <div className="pt-safe mx-auto min-h-dvh max-w-lg px-4 pb-32">
            <OfflineBanner />
            {children}
          </div>
          <TabBar />
        </SettingsProvider>
      </body>
    </html>
  );
}
