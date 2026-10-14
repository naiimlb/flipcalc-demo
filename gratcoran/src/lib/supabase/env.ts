/** Clé publique Supabase (publishable / anon) : faite pour le navigateur, protégée par la RLS. */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Configuration Supabase manquante : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url, key };
}

/**
 * Durée de vie des cookies de session : la session reste ouverte tant que
 * l'utilisateur ne se déconnecte pas (le refresh token est renouvelé à chaque visite).
 */
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 400 * 24 * 60 * 60,
};
