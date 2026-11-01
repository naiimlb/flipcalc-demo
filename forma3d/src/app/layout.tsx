import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { UpdateNotifier } from "@/components/app/UpdateNotifier";
import { hexToRgbTriplet } from "@/lib/settings";
import { getPublicSettings } from "@/lib/settings.server";
import "./globals.css";

const uiFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getPublicSettings();
  return {
    title: { default: site.siteName, template: `%s · ${site.siteName}` },
    description: site.heroSubtitle,
    applicationName: site.siteName,
    icons: { icon: site.logoDataUrl ?? "/icon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5b6ee1",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { site } = await getPublicSettings();
  // Couleurs choisies dans /admin/apparence, appliquées à tout le site.
  const brandVars = {
    "--brand-from": hexToRgbTriplet(site.colorFrom),
    "--brand-to": hexToRgbTriplet(site.colorTo),
    "--brand-accent": hexToRgbTriplet(site.accent),
  } as React.CSSProperties;

  return (
    <html lang="fr" className={uiFont.variable} style={brandVars}>
      <body>
        {children}
        <UpdateNotifier />
      </body>
    </html>
  );
}
