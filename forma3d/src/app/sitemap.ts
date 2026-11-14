import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";

/** Plan du site : les pages publiques. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const pages: [string, number][] = [
    ["/", 1],
    ["/decouvrir", 0.8],
    ["/galerie", 0.7],
    ["/studio", 0.6],
    ["/mentions-legales", 0.2],
    ["/confidentialite", 0.2],
    ["/cgu", 0.2],
  ];
  return pages.map(([path, priority]) => ({ url: `${origin}${path}`, changeFrequency: "weekly", priority }));
}
