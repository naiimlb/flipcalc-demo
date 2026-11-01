/**
 * Configuration Supabase. La clé publique (publishable / anon) est faite pour le navigateur
 * et protégée par la RLS. Sans URL ni clé, l'application tourne en « mode démo ».
 */
export function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isDemoMode(): boolean {
  return supabaseConfig() === null;
}

export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 400 * 24 * 60 * 60,
};
