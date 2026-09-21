'use client';

/* =====================================================================
   Découvrir — recherche libre et filtres.
   ---------------------------------------------------------------------
   Même ici, le filtrage plateformes reste strict : on ne montre jamais
   un titre que la personne ne peut pas regarder.
   ===================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react';

import { Affiche } from '@/components/Affiche';
import { EtatVide } from '@/components/EtatVide';
import { LecteurBandeAnnonce } from '@/components/LecteurBandeAnnonce';
import { PastillePlateforme } from '@/components/PastillePlateforme';
import { Puce } from '@/components/Boutons';
import { SqueletteRangee } from '@/components/Squelettes';
import { rechercher } from '@/lib/api-client';
import { useApp } from '@/lib/etat/magasin';
import { GENRES_PROPOSES } from '@/lib/tmdb/genres';
import { PLATEFORME_PAR_ID } from '@/lib/reco/plateformes';
import type { Recommandation, Titre } from '@/lib/reco/types';

const DECENNIES = [2020, 2010, 2000, 1990, 1980];
const DUREES = [
  { libelle: '- 1 h 30', valeur: 90 },
  { libelle: '- 2 h', valeur: 120 },
  { libelle: '- 2 h 30', valeur: 150 },
];

export default function PageDecouvrir() {
  const { profil, historique, contexte } = useApp();
  const [requete, setRequete] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [plateforme, setPlateforme] = useState<string | null>(null);
  const [decennie, setDecennie] = useState<number | null>(null);
  const [dureeMax, setDureeMax] = useState<number | null>(null);
  const [resultats, setResultats] = useState<Recommandation[] | null>(null);
  const [titreEnLecture, setTitreEnLecture] = useState<Titre | null>(null);

  const historiqueRef = useRef(historique);
  historiqueRef.current = historique;

  const lancer = useCallback(async () => {
    if (!profil) return;
    setResultats(null);
    try {
      const reponse = await rechercher({
        profil,
        historique: historiqueRef.current,
        contexte,
        q: requete,
        filtres: {
          genre: genre ?? undefined,
          plateforme: plateforme ?? undefined,
          decennie: decennie ?? undefined,
          dureeMax: dureeMax ?? undefined,
        },
      });
      setResultats(reponse.resultats);
    } catch {
      setResultats([]);
    }
  }, [profil, contexte, requete, genre, plateforme, decennie, dureeMax]);

  // Petit délai avant de lancer la recherche : on évite un appel par
  // lettre tapée, précieux en 4G.
  useEffect(() => {
    const minuterie = setTimeout(() => void lancer(), requete ? 380 : 0);
    return () => clearTimeout(minuterie);
  }, [lancer, requete]);

  const mesPlateformes = profil?.plateformes ?? [];

  return (
    <>
      <header className="zone-sure-haut px-5 pb-2 pt-4">
        <h1 className="font-titre text-[2.2rem] leading-none text-ivoire">Découvrir</h1>
      </header>

      <div className="px-5 pt-5">
        <label htmlFor="recherche" className="sr-only">
          Rechercher un film ou une série
        </label>
        <div className="flex items-center gap-3 rounded-douce verre px-4">
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-estompe" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.2-4.2" />
          </svg>
          <input
            id="recherche"
            type="search"
            inputMode="search"
            autoComplete="off"
            value={requete}
            onChange={(e) => setRequete(e.target.value)}
            placeholder="Un titre, un réalisateur, un acteur…"
            /* 16 px minimum : sinon Safari zoome à la saisie. */
            className="min-h-[52px] w-full bg-transparent text-[16px] text-ivoire placeholder:text-estompe focus:outline-none"
          />
          {requete && (
            <button type="button" onClick={() => setRequete('')} aria-label="Effacer la recherche" className="text-estompe">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* --- Filtres --------------------------------------------------- */}
      <div className="mt-5 space-y-3">
        <Rangee titre="Genre">
          {GENRES_PROPOSES.map((g) => (
            <Puce key={g} actif={genre === g} onClick={() => setGenre(genre === g ? null : g)}>
              {g}
            </Puce>
          ))}
        </Rangee>

        {mesPlateformes.length > 1 && (
          <Rangee titre="Plateforme">
            {mesPlateformes.map((id) => (
              <Puce key={id} actif={plateforme === id} onClick={() => setPlateforme(plateforme === id ? null : id)}>
                {PLATEFORME_PAR_ID[id]?.nom ?? id}
              </Puce>
            ))}
          </Rangee>
        )}

        <Rangee titre="Décennie">
          {DECENNIES.map((d) => (
            <Puce key={d} actif={decennie === d} onClick={() => setDecennie(decennie === d ? null : d)}>
              {d}s
            </Puce>
          ))}
        </Rangee>

        <Rangee titre="Durée">
          {DUREES.map((d) => (
            <Puce key={d.valeur} actif={dureeMax === d.valeur} onClick={() => setDureeMax(dureeMax === d.valeur ? null : d.valeur)}>
              {d.libelle}
            </Puce>
          ))}
        </Rangee>
      </div>

      {/* --- Résultats -------------------------------------------------- */}
      <section className="mt-8 px-5" aria-label="Résultats">
        {resultats === null && <SqueletteRangee nombre={6} />}

        {resultats?.length === 0 && (
          <EtatVide
            titre="Aucun résultat"
            message="Rien ne correspond à ces critères sur tes plateformes. Retire un filtre ou tente une autre recherche."
            actionLibelle="Effacer les filtres"
            onAction={() => {
              setGenre(null);
              setPlateforme(null);
              setDecennie(null);
              setDureeMax(null);
              setRequete('');
            }}
          />
        )}

        {resultats && resultats.length > 0 && (
          <ul className="grid grid-cols-2 gap-4">
            {resultats.map((reco) => (
              <li key={reco.titre.id}>
                <button
                  type="button"
                  onClick={() => setTitreEnLecture(reco.titre)}
                  className="block w-full text-left"
                >
                  <div className="relative overflow-hidden rounded-douce">
                    <Affiche titre={reco.titre} className="aspect-[2/3] w-full" />
                    <div className="absolute left-2 top-2">
                      {reco.titre.plateformes[0] && (
                        <PastillePlateforme id={reco.titre.plateformes[0]} taille="petite" />
                      )}
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[14px] leading-snug text-ivoire">{reco.titre.titre}</p>
                  <p className="text-[12px] text-estompe">
                    {reco.titre.annee} · {reco.titre.note.toFixed(1)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LecteurBandeAnnonce titre={titreEnLecture} onFermer={() => setTitreEnLecture(null)} />
    </>
  );
}

function Rangee({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-5 pb-2 text-[12px] uppercase tracking-[0.14em] text-estompe">{titre}</p>
      <div className="rail px-5">
        {children}
        <div className="w-1 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}
