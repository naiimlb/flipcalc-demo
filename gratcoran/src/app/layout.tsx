import type { Metadata, Viewport } from "next";
import { Amiri_Quran, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const quranFont = Amiri_Quran({
  weight: "400",
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-quran",
});

const uiFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Grat'Coran",
  description: "Écoute une récitation et retrouve la sourate et le verset.",
  applicationName: "Grat'Coran",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Grat'Coran",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false, email: false, address: false },
  // Selon la version, Next n'émet que l'une des deux balises : on force les deux.
  other: { "apple-mobile-web-app-capable": "yes", "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#060a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${quranFont.variable} ${uiFont.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
