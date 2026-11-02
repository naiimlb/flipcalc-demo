import type { MetadataRoute } from "next";
import { getPublicSettings } from "@/lib/settings.server";

/** Manifeste de l'application installable (PWA) : nom et couleurs suivent les réglages de /admin. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { site } = await getPublicSettings();
  return {
    id: "/",
    name: site.siteName,
    short_name: site.siteName.slice(0, 12),
    description: site.heroSubtitle,
    lang: "fr",
    start_url: "/",
    scope: "/",
    // « standalone » : plein écran sans barre du navigateur, depuis l'écran d'accueil de l'iPad, du téléphone ou de l'ordinateur.
    display: "standalone",
    orientation: "any",
    background_color: site.colorFrom,
    theme_color: site.colorFrom,
    categories: ["productivity", "utilities", "design"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
