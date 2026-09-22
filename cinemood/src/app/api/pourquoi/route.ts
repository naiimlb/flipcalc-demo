/* =====================================================================
   /api/pourquoi — Reformulation de l'explication par Claude (optionnel).
   ---------------------------------------------------------------------
   Le « Pourquoi pour toi » est TOUJOURS généré localement par le moteur
   (src/lib/reco/explication.ts). Cette route ne fait que le réécrire de
   façon plus naturelle quand une clé Anthropic est configurée.

   Conséquence : si la clé est absente, si l'API est lente ou si elle
   échoue, l'app continue de fonctionner exactement pareil. L'IA est un
   confort, jamais une dépendance.
   ===================================================================== */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
/** Au-delà, on rend la phrase locale : on ne fait pas attendre l'écran. */
const DELAI_MAX_MS = 6000;

interface Demande {
  titre?: string;
  annee?: number;
  genres?: string[];
  humeur?: string | null;
  compagnie?: string;
  pseudo?: string;
  /** L'explication calculée par le moteur, qui sert de base factuelle. */
  base?: string;
}

export async function POST(requete: Request) {
  const cle = process.env.ANTHROPIC_API_KEY?.trim();
  let demande: Demande;
  try {
    demande = (await requete.json()) as Demande;
  } catch {
    return NextResponse.json({ erreur: 'Corps de requête illisible.' }, { status: 400 });
  }

  const base = (demande.base ?? '').slice(0, 400);
  // Pas de clé : on renvoie la phrase locale, telle quelle.
  if (!cle || !base) {
    return NextResponse.json({ phrase: base, source: 'moteur' });
  }

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: cle });

    const reponse = await client.messages.create(
      {
        model: process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        system:
          'Tu rédiges une phrase de recommandation pour une app française de cinéma. ' +
          'Une à deux phrases, 30 mots maximum, tutoiement, ton chaleureux et précis, sans emoji. ' +
          'Tu ne t’appuies que sur les éléments fournis : n’invente jamais de récompense, ' +
          'de note, de casting ou d’intrigue. Réponds uniquement par la phrase.',
        messages: [
          {
            role: 'user',
            content:
              `Titre : ${demande.titre ?? '—'} (${demande.annee ?? '—'})\n` +
              `Genres : ${(demande.genres ?? []).join(', ') || '—'}\n` +
              `Humeur du moment : ${demande.humeur ?? 'non précisée'}\n` +
              `Avec qui : ${demande.compagnie ?? 'seul'}\n` +
              `Explication calculée par l’algorithme : ${base}\n\n` +
              'Réécris cette explication de façon plus naturelle.',
          },
        ],
      },
      { timeout: DELAI_MAX_MS },
    );

    const bloc = reponse.content.find((c) => c.type === 'text');
    const phrase = bloc && bloc.type === 'text' ? bloc.text.trim() : '';
    return NextResponse.json({ phrase: phrase || base, source: phrase ? 'claude' : 'moteur' });
  } catch (erreur) {
    // Dégradation silencieuse : l'utilisateur ne doit rien voir passer.
    console.error('[pourquoi]', erreur);
    return NextResponse.json({ phrase: base, source: 'moteur' });
  }
}
