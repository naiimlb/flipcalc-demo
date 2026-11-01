import "server-only";
import { supabaseConfig } from "./supabase/env";

/** Fournisseurs de connexion activés dans Supabase (Authentication → Providers). */
export async function getAuthProviders(): Promise<{ google: boolean }> {
  const config = supabaseConfig();
  if (!config) return { google: false };
  try {
    const res = await fetch(`${config.url}/auth/v1/settings`, {
      headers: { apikey: config.key },
      next: { revalidate: 300 },
    });
    if (!res.ok) return { google: false };
    const body = (await res.json()) as { external?: Record<string, boolean> };
    return { google: Boolean(body.external?.google) };
  } catch {
    return { google: false };
  }
}
