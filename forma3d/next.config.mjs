/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["three"],
  env: {
    // Preview Vercel : mode démonstration (aucune écriture dans la base réelle, aucun appel payant).
    // Pour tester exceptionnellement une Preview branchée sur la vraie base : FORMA3D_PREVIEW_REAL=1.
    NEXT_PUBLIC_FORMA3D_FORCE_DEMO: process.env.VERCEL_ENV === "preview" && process.env.FORMA3D_PREVIEW_REAL !== "1" ? "1" : "",
  },
  experimental: {
    // N'embarque que les morceaux réellement utilisés de ces bibliothèques (moteur 3D plus léger).
    optimizePackageImports: ["@react-three/drei", "three-stdlib", "framer-motion"],
    // Images de référence envoyées par les actions serveur (logo de l'admin).
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      // Le service worker et la page hors-ligne ne doivent jamais rester en cache : une mise à jour du site les remplace aussitôt.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      { source: "/offline.html", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
