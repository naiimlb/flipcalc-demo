/* =====================================================================
   /api/diagnostic-tmdb — Un GET simple, ouvrable depuis n'importe quel
   navigateur, qui dit la vérité sur la connexion à TMDB.
   ---------------------------------------------------------------------
   Cette route existe parce que les logs d'exécution Vercel ne sont pas
   toujours accessibles à qui doit diagnostiquer une panne. Elle ne
   remplace pas de vrais logs : elle est le seul canal qui restait pour
   vérifier, depuis l'extérieur, si TMDB répond — sans jamais exposer le
   jeton lui-même.
   ===================================================================== */

import { NextResponse } from 'next/server';

import { diagnostiquerTmdb } from '@/lib/tmdb/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostic = await diagnostiquerTmdb();
  return NextResponse.json(diagnostic, { status: diagnostic.appelReussi ? 200 : 502 });
}
