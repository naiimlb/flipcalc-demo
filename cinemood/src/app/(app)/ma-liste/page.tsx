'use client';

/* =====================================================================
   Ma liste — « à voir » et « déjà vus ».
   ---------------------------------------------------------------------
   Les titres sont mis en cache au moment de l'ajout : la liste reste
   consultable hors ligne et ne dépend pas d'un appel réseau.
   ===================================================================== */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Affiche } from '@/components/Affiche';
import { EtatVide } from '@/components/EtatVide';
import { LecteurBandeAnnonce } from '@/components/LecteurBandeAnnonce';
import { PastillePlateforme } from '@/components/PastillePlateforme';
import { useApp } from '@/lib/etat/magasin';
import type { Titre } from '@/lib/reco/types';

type Onglet = 'a_voir' | 'vus';

export default function PageMaListe() {
  const { historique, titresConnus, signaler } = useApp();
  const [onglet, setOnglet] = useState<Onglet>('a_voir');
  const [titreEnLecture, setTitreEnLecture] = useState<Titre | null>(null);
  const routeur = useRouter();

  // Un titre peut manquer du cache (liste importée d'un autre appareil) :
  // on filtre explicitement pour garder un tableau de `Titre` bien typé.
  const aVoir = useMemo(
    () => historique.liste.map((id) => titresConnus[id]).filter((t): t is Titre => Boolean(t)),
    [historique.liste, titresConnus],
  );

  const vus = useMemo(
    () =>
      Object.entries(historique.vus)
        .map(([id, note]) => ({ titre: titresConnus[id], note }))
        .filter((x): x is { titre: Titre; note: 1 | -1 } => Boolean(x.titre)),
    [historique.vus, titresConnus],
  );

  const liste: Titre[] = onglet === 'a_voir' ? aVoir : vus.map((x) => x.titre);

  return (
    <>
      <header className="zone-sure-haut px-5 pb-2 pt-4">
        <h1 className="font-affiche text-[2.2rem] leading-none text-ivoire">Ma liste</h1>
      </header>

      <div className="mt-5 px-5">
        <div className="flex rounded-full verre p-1" role="tablist" aria-label="Filtrer ma liste">
          {(
            [
              ['a_voir', `À voir${aVoir.length ? ` · ${aVoir.length}` : ''}`],
              ['vus', `Déjà vus${vus.length ? ` · ${vus.length}` : ''}`],
            ] as Array<[Onglet, string]>
          ).map(([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              role="tab"
              aria-selected={onglet === cle}
              onClick={() => setOnglet(cle)}
              className={`min-h-[44px] flex-1 rounded-full text-[14px] transition-colors ${
                onglet === cle ? 'bg-voile-accent font-semibold text-white' : 'text-cendre'
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-7 px-5">
        {liste.length === 0 && (
          <EtatVide
            titre={onglet === 'a_voir' ? 'Ta liste est vide' : 'Rien de vu pour l’instant'}
            message={
              onglet === 'a_voir'
                ? 'Ajoute des titres depuis l’accueil : ils t’attendront ici, même hors connexion.'
                : 'Marque un titre comme « déjà vu » et dis si tu as aimé : CinéMood s’en sert pour affiner tes recommandations.'
            }
            actionLibelle="Voir ma sélection du soir"
            onAction={() => routeur.push('/accueil')}
          />
        )}

        <ul className="space-y-4">
          {liste.map((titre) => {
            const appreciation = vus.find((v) => v.titre.id === titre.id)?.note;
            return (
              <li key={titre.id} className="flex gap-4 rounded-carte verre p-3">
                <button
                  type="button"
                  onClick={() => setTitreEnLecture(titre)}
                  className="w-[86px] shrink-0 overflow-hidden rounded-douce"
                  aria-label={`Bande-annonce de ${titre.titre}`}
                >
                  <Affiche titre={titre} className="aspect-[2/3] w-full" />
                </button>

                <div className="min-w-0 flex-1 py-0.5">
                  <p className="font-affiche text-[1.15rem] leading-tight text-ivoire">{titre.titre}</p>
                  <p className="mt-1 text-[12px] text-estompe">
                    {titre.annee} · {titre.genres.slice(0, 2).join(', ')}
                  </p>
                  <div className="mt-2">
                    {titre.plateformes[0] && <PastillePlateforme id={titre.plateformes[0]} taille="petite" avecNom />}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {onglet === 'a_voir' ? (
                      <>
                        <MiniAction onClick={() => signaler(titre, 'deja_vu_aime')}>Vu, j’ai aimé</MiniAction>
                        <MiniAction onClick={() => signaler(titre, 'deja_vu_pas_aime')}>Vu, bof</MiniAction>
                        <MiniAction onClick={() => signaler(titre, 'retrait_liste')}>Retirer</MiniAction>
                      </>
                    ) : (
                      <span className="text-[12px] text-cendre">
                        {appreciation === 1 ? '👍 Tu as aimé' : '👎 Tu n’as pas aimé'}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <LecteurBandeAnnonce titre={titreEnLecture} onFermer={() => setTitreEnLecture(null)} />
    </>
  );
}

function MiniAction({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      /* 44 px de haut, comme toutes les cibles tactiles de l'app. */
      className="rounded-full border border-white/10 px-3.5 text-[12px] text-cendre active:bg-white/5"
    >
      {children}
    </button>
  );
}
