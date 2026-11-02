/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["three"],
  experimental: {
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
