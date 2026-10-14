"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SESSION_COOKIE_OPTIONS, supabaseEnv } from "./env";

let client: SupabaseClient | undefined;

export function getBrowserSupabase(): SupabaseClient {
  if (!client) {
    const { url, key } = supabaseEnv();
    client = createBrowserClient(url, key, { cookieOptions: SESSION_COOKIE_OPTIONS });
  }
  return client;
}
