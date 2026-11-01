import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./env";

let client: SupabaseClient | null | undefined;

/**
 * Client « service » (clé secrète) : contourne la RLS. Serveur uniquement, pour
 * les opérations que l'utilisateur ne doit pas pouvoir faire lui-même
 * (écrire le résultat d'une génération, lire les secrets, promouvoir l'admin).
 */
export function getServiceSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = supabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  client =
    config && secret
      ? createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
  return client;
}
