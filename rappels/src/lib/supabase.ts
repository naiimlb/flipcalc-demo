import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Seules la clé « anon / publishable » (publique par conception) est utilisée dans le navigateur.
// La sécurité vient des règles RLS de la base (supabase/schema.sql), jamais de cette clé.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!url && !!anonKey;

let client: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Supabase n'est pas configuré");
  // La session est gardée dans le téléphone et se renouvelle toute seule : pas de reconnexion à chaque service.
  client ??= createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
