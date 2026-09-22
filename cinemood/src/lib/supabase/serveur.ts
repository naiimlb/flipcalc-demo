/* =====================================================================
   serveur.ts — Client Supabase côté serveur (route handlers, RSC).
   ===================================================================== */

import 'server-only';

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { CLE_ANON_SUPABASE, SUPABASE_CONFIGURE, URL_SUPABASE } from './config';

/** Client lié à la session de la personne, via ses cookies. */
export async function clientServeur(): Promise<SupabaseClient | null> {
  if (!SUPABASE_CONFIGURE) return null;
  const magasin = await cookies();

  return createServerClient(URL_SUPABASE, CLE_ANON_SUPABASE, {
    cookies: {
      getAll() {
        return magasin.getAll();
      },
      setAll(cookiesAEcrire) {
        try {
          for (const { name, value, options } of cookiesAEcrire) {
            magasin.set(name, value, options);
          }
        } catch {
          // Appelé depuis un composant serveur : l'écriture de cookies
          // y est interdite. Le middleware rafraîchit déjà la session,
          // on peut ignorer sans risque.
        }
      },
    },
  });
}
