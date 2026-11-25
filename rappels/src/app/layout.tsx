import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Poppins } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const poppins = Poppins({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "HB Rappels", template: "%s · HB Rappels" },
  description: "Tes tâches de service, avec rappel. Hashtag Bangers, Roubaix.",
  applicationName: "HB Rappels",
  appleWebApp: { capable: true, title: "HB Rappels", statusBarStyle: "default" },
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
  themeColor: "#fff8fb",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={poppins.variable}>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
