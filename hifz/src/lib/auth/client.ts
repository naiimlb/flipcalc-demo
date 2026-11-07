"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

let client: SupabaseClient | null = null;

/** Client Supabase du navigateur. La session est gardée dans le stockage local et reste lisible hors ligne. */
export function getSupabase(): SupabaseClient {
  if (!supabaseConfig) throw new Error("Les comptes ne sont pas configurés.");
  client ??= createClient(supabaseConfig.url, supabaseConfig.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "hifz-auth",
    },
  });
  return client;
}
