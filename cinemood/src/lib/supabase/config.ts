/* =====================================================================
   config.ts — Présence (ou non) d'une configuration Supabase.
   ---------------------------------------------------------------------
   CinéMood doit rester utilisable sans compte : tant que Supabase n'est
   pas configuré, l'app fonctionne en « mode local » (tout est stocké sur
   l'appareil). Ce module est le seul endroit qui décide dans quel mode
   on se trouve.
   ===================================================================== */

export const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const CLE_ANON_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** `true` si les comptes et la synchronisation sont disponibles. */
export const SUPABASE_CONFIGURE = Boolean(URL_SUPABASE && CLE_ANON_SUPABASE);
