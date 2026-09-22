/* =====================================================================
   navigateur.ts — Client Supabase côté navigateur.
   ---------------------------------------------------------------------
   N'utilise QUE la clé « anon », publique par nature : ce sont les
   règles Row Level Security (voir supabase/schema.sql) qui protègent les
   données, jamais le secret de la clé.
   ===================================================================== */

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CLE_ANON_SUPABASE, SUPABASE_CONFIGURE, URL_SUPABASE } from './config';

let instance: SupabaseClient | null = null;

/** Renvoie le client partagé, ou `null` si Supabase n'est pas configuré. */
export function clientNavigateur(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURE) return null;
  if (!instance) instance = createBrowserClient(URL_SUPABASE, CLE_ANON_SUPABASE);
  return instance;
}
