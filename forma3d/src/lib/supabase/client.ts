"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SESSION_COOKIE_OPTIONS, supabaseConfig } from "./env";

let client: SupabaseClient | null | undefined;

/** Client navigateur (clé publique), ou null en mode démo. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (client === undefined) {
    const config = supabaseConfig();
    client = config ? createBrowserClient(config.url, config.key, { cookieOptions: SESSION_COOKIE_OPTIONS }) : null;
  }
  return client;
}
