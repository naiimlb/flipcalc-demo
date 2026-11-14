/**
 * Politique de sécurité du contenu (CSP) : seules les ressources du site, de Supabase (base, fichiers) et, pour les
 * modèles compressés, le décodeur Draco de Google sont autorisées. Les scripts en ligne restent permis (Next.js et le
 * script de thème en ont besoin) mais aucun script externe ne peut être injecté, et le site ne peut pas être encadré.
 * Sur les Preview Vercel, la barre d'outils de Vercel est autorisée.
 */
function contentSecurityPolicy() {
  let supabase = "";
  try {
    supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "";
  } catch {
    supabase = "";
  }
  const dev = process.env.NODE_ENV !== "production";
  const preview = process.env.VERCEL_ENV === "preview";
  const vercel = preview ? ["https://vercel.live", "https://vercel.com"] : [];
  const sb = supabase ? [`https://${supabase}`, `wss://${supabase}`] : [];
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://www.gstatic.com", ...(dev ? ["'unsafe-eval'"] : []), ...vercel],
    "style-src": ["'self'", "'unsafe-inline'", ...vercel],
    // Images : toute source HTTPS (photos de profil Google, fichiers Supabase…) ; aucun script ne peut en venir.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:", ...vercel],
    "connect-src": ["'self'", "blob:", "data:", "https://www.gstatic.com", ...sb, ...(preview ? ["https://vercel.live", "wss://ws-us3.pusher.com"] : [])],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "frame-src": preview ? ["https://vercel.live"] : ["'none'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

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
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
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
