/**
 * Configuration Supabase (valeurs publiques : l'accès aux données est protégé par la sécurité
 * par ligne côté base). Sans ces variables, l'app fonctionne en mode local, sans compte.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfig: { url: string; key: string } | null = url && key ? { url, key } : null;
export const isAuthConfigured = supabaseConfig !== null;

/** Pages accessibles sans être connecté. */
export const PUBLIC_PATHS = ["/connexion", "/mot-de-passe-oublie", "/reinitialiser", "/sources"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Pages d'identification : sans barre d'onglets. */
export function isAuthPath(pathname: string): boolean {
  return ["/connexion", "/mot-de-passe-oublie", "/reinitialiser"].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const MIN_PASSWORD_LENGTH = 8;
