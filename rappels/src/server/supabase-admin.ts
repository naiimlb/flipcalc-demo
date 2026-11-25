import { createClient } from "@supabase/supabase-js";

// Client « administrateur » : uniquement côté serveur (routes /api/auth/*).
// La clé service_role ne doit JAMAIS être préfixée NEXT_PUBLIC_ ni utilisée dans le navigateur.
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
