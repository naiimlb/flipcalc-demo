import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";

/** Indexation : pages publiques seulement ; jamais l'espace personnel, l'administration, l'API ni les Preview. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  if (process.env.VERCEL_ENV === "preview") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/espace", "/setup", "/apercu-refonte", "/auth/", "/reinitialiser"] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
