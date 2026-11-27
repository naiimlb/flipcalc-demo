import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Vérification CÔTÉ SERVEUR qu'un appel vient d'un responsable. On ne fait confiance ni au bouton caché, ni au rôle
// annoncé par le navigateur : on interroge la base avec le jeton de l'utilisateur (is_manager() lit la table profiles).
export type Auth = { ok: true; sb: SupabaseClient; token: string } | { ok: false; status: 401 | 403 | 503; error: string };

export async function authorizeManager(request: Request): Promise<Auth> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, status: 503, error: "Supabase non configuré" };
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "connexion requise" };
  const sb = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("is_manager");
  if (error) return { ok: false, status: 401, error: "session invalide" };
  if (data !== true) return { ok: false, status: 403, error: "réservé au responsable" };
  return { ok: true, sb, token };
}

export const noStore = { "Cache-Control": "no-store" };
