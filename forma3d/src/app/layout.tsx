import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { RegisterServiceWorker } from "@/components/app/RegisterServiceWorker";
import { UpdateNotifier } from "@/components/app/UpdateNotifier";
import { hexToRgbTriplet } from "@/lib/settings";
import { getPublicSettings } from "@/lib/settings.server";
import "./globals.css";

const uiFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

/** Écrans de lancement iOS : un par taille d'appareil (largeur × hauteur en pixels CSS, densité). */
const STARTUP_SIZES: [number, number, number][] = [
  // iPhone (portrait)
  [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 2], [375, 667, 2],
];
const STARTUP_IPADS: [number, number, number][] = [
  [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [834, 1112, 2], [768, 1024, 2], [744, 1133, 2], [810, 1080, 2],
];
const STARTUP_IMAGES = [
  ...STARTUP_SIZES.map(([w, h, r]) => ({
    url: `/splash/${w * r}x${h * r}.png`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
  })),
  ...STARTUP_IPADS.flatMap(([w, h, r]) => [
    {
      url: `/splash/${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    },
    {
      url: `/splash/${h * r}x${w * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: landscape)`,
    },
  ]),
];

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getPublicSettings();
  return {
    title: { default: site.siteName, template: `%s · ${site.siteName}` },
    description: site.heroSubtitle,
    applicationName: site.siteName,
    icons: { icon: site.logoDataUrl ?? "/icon.svg", apple: "/icons/apple-touch-icon.png" },
    // Installation sur l'écran d'accueil (iPad / iPhone) : plein écran, écran de lancement aux couleurs du site.
    appleWebApp: { capable: true, title: site.siteName, statusBarStyle: "black-translucent", startupImage: STARTUP_IMAGES },
    formatDetection: { telephone: false },
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
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
