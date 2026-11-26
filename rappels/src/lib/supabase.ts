import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SESSION_COOKIE_OPTIONS } from "./session-cookies";

// Seules la clé « anon / publishable » (publique par conception) est utilisée dans le navigateur.
// La sécurité vient des règles RLS de la base (supabase/schema.sql), jamais de cette clé.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!url && !!anonKey;

let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase n'est pas configuré");
  // La session vit dans des COOKIES de 400 jours (lus aussi par le proxy du serveur, qui les renouvelle à chaque visite)
  // et se renouvelle toute seule en silence : on ne revient jamais à l'écran de connexion tant qu'on ne se déconnecte pas.
  client ??= createBrowserClient(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/** Référence du projet Supabase (début de l'URL), utilisée dans le nom des cookies et de l'ancien stockage local. */
export function supabaseRef(): string {
  try {
    return new URL(url ?? "").hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}
