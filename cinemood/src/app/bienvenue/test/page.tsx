'use client';

/* =====================================================================
   Étape 2 — Le test de personnalité cinéma.
   ---------------------------------------------------------------------
   Dix écrans, une question par écran, deux minutes montre en main.
   Les grilles d'affiches sont tirées du catalogue de référence, qui
   couvre volontairement six décennies : c'est ce qui permet de capter
   la nostalgie de quelqu'un né en 1965 comme de quelqu'un né en 2010.
   ===================================================================== */

import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Affiche } from '@/components/Affiche';
import { Bouton, Puce } from '@/components/Boutons';
import { CATALOGUE_DEMO } from '@/data/catalogue-demo';
import { construireProfilDepuisTest } from '@/lib/reco/profil';
import { profilCinema, LIBELLE_TONALITE } from '@/lib/reco/explication';
import { GENRES_PROPOSES } from '@/lib/tmdb/genres';
import { useApp } from '@/lib/etat/magasin';
import type { Titre, Tonalite, TypeContenu } from '@/lib/reco/types';

const ANNEE_COURANTE = new Date().getFullYear();
const NOMBRE_ECRANS = 10;

interface Brouillon {
  pseudo: string;
  anneeNaissance: number | null;
  genrePersonne: string;
  typesSouhaites: TypeContenu[];
  genresAdores: string[];
  genresDetestes: string[];
  favoris: string[];
  enfance: string[];
  tonalitePreferee: Tonalite | null;
  dureeMax: number | null;
  languePreferee: 'vo' | 'vf' | 'indifferent';
  epoquePreferee: 'recent' | 'classique' | 'indifferent';
  animationOk: boolean;
  interets: string;
  aEviter: string;
}

const BROUILLON_INITIAL: Brouillon = {
  pseudo: '',
  anneeNaissance: null,
  genrePersonne: '',
  typesSouhaites: ['film', 'serie'],
  genresAdores: [],
  genresDetestes: [],
  favoris: [],
  enfance: [],
  tonalitePreferee: null,
  dureeMax: null,
  languePreferee: 'indifferent',
  epoquePreferee: 'indifferent',
  animationOk: true,
  interets: '',
  aEviter: '',
};

export default function PageTest() {
  const { profil, definirProfil } = useApp();
  const routeur = useRouter();
  const [etape, setEtape] = useState(0);
  const [termine, setTermine] = useState(false);
  const [b, setB] = useState<Brouillon>({
    ...BROUILLON_INITIAL,
    pseudo: profil?.pseudo ?? '',
    anneeNaissance: profil?.anneeNaissance ?? null,
  });

  const maj = (modification: Partial<Brouillon>) => setB((p) => ({ ...p, ...modification }));

  /* --- Grilles d'affiches ------------------------------------------- */
  const grilleFavoris = useMemo(() => echantillonVarie(CATALOGUE_DEMO, 24), []);
  const grilleEnfance = useMemo(
    () => (b.anneeNaissance ? titresDEnfance(CATALOGUE_DEMO, b.anneeNaissance, 18) : []),
    [b.anneeNaissance],
  );

  /* --- Validation par écran ------------------------------------------ */
  const valide = [
    b.pseudo.trim().length >= 1,
    b.anneeNaissance !== null && b.anneeNaissance >= 1920 && b.anneeNaissance <= ANNEE_COURANTE - 5,
    true, // question facultative
    b.typesSouhaites.length > 0,
    true, // genres : on peut n'en cocher aucun
    b.favoris.length >= 1,
    true, // enfance : facultatif
    b.tonalitePreferee !== null,
    true,
    true,
  ][etape];

  function terminer() {
    const parId = new Map(CATALOGUE_DEMO.map((t) => [t.id, t]));
    const profilFinal = construireProfilDepuisTest({
      pseudo: b.pseudo.trim(),
      anneeNaissance: b.anneeNaissance ?? ANNEE_COURANTE - 30,
      genrePersonne: b.genrePersonne || undefined,
      typesSouhaites: b.typesSouhaites,
      genresAdores: b.genresAdores,
      genresDetestes: b.genresDetestes,
      favoris: b.favoris.map((id) => parId.get(id)).filter((t): t is Titre => Boolean(t)),
      enfance: b.enfance.map((id) => parId.get(id)).filter((t): t is Titre => Boolean(t)),
      tonalitePreferee: b.tonalitePreferee ?? 'intense',
      dureeMax: b.dureeMax,
      languePreferee: b.languePreferee,
      epoquePreferee: b.epoquePreferee,
      animationOk: b.animationOk,
      plateformes: profil?.plateformes ?? [],
      pays: profil?.pays ?? 'FR',
      aEviter: decouper(b.aEviter),
      interets: decouper(b.interets),
    });
    definirProfil(profilFinal, { testTermine: true, plateformesChoisies: true });
    setTermine(true);
  }

  /* --- Écran final ---------------------------------------------------- */
  if (termine && profil) {
    const carte = profilCinema(profil);
    return (
      <main className="relative flex min-h-[100dvh] flex-col justify-center px-7">
        <div className="pointer-events-none absolute inset-0 bg-lueur" aria-hidden="true" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto w-full max-w-md text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.22em] text-or/70">Ton profil cinéma</p>
          <h1 className="equilibre mt-4 font-titre text-[3rem] leading-[1.04] text-ivoire">
            {carte.titre}
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-cendre">{carte.resume}</p>
          <div className="mx-auto mt-8 h-px w-16 bg-voile-or" />
          <p className="mt-8 text-[14px] leading-relaxed text-estompe">
            Tout reste modifiable dans ton profil. Plus tu utiliseras CinéMood, plus la sélection
            te ressemblera.
          </p>
          <Bouton variante="or" pleineLargeur className="mt-10" onClick={() => routeur.push('/accueil')}>
            Découvrir ma sélection
          </Bouton>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-lueur" aria-hidden="true" />

      {/* --- Progression -------------------------------------------------- */}
      <div className="zone-sure-haut sticky top-0 z-30 bg-nuit/85 px-6 pb-4 pt-5 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center justify-between text-[12px] text-estompe">
            <button
              type="button"
              onClick={() => (etape === 0 ? routeur.back() : setEtape(etape - 1))}
              className="-ml-2 flex items-center gap-1 px-2 text-cendre"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 5 8 12l6.5 7" />
              </svg>
              Retour
            </button>
            <span>
              {etape + 1} / {NOMBRE_ECRANS}
            </span>
          </div>
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-voile-or"
              animate={{ width: `${((etape + 1) / NOMBRE_ECRANS) * 100}%` }}
              transition={{ type: 'spring', stiffness: 220, damping: 30 }}
            />
          </div>
        </div>
      </div>

      {/* --- Question ----------------------------------------------------- */}
      <div className="relative mx-auto max-w-xl px-6 pb-40 pt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={etape}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            {etape === 0 && (
              <Question titre="Comment on t’appelle ?" sousTitre="Un prénom ou un pseudo, comme tu préfères.">
                <input
                  type="text"
                  autoComplete="given-name"
                  autoFocus
                  value={b.pseudo}
                  onChange={(e) => maj({ pseudo: e.target.value.slice(0, 24) })}
                  placeholder="Ton prénom"
                  className="min-h-[60px] w-full rounded-douce verre px-5 text-[18px] text-ivoire placeholder:text-estompe focus:outline-none"
                />
              </Question>
            )}

            {etape === 1 && (
              <Question
                titre="Tu es né·e en quelle année ?"
                sousTitre="Deux usages : ne jamais te proposer de contenu interdit à ton âge, et retrouver les films de ta jeunesse."
              >
                <div className="rail flex-wrap gap-2">
                  {anneesProposees().map((annee) => (
                    <Puce key={annee} actif={b.anneeNaissance === annee} onClick={() => maj({ anneeNaissance: annee })}>
                      {annee}
                    </Puce>
                  ))}
                </div>
                <label className="mt-5 block">
                  <span className="mb-2 block text-[13px] text-estompe">Ou saisis-la directement</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1920}
                    max={ANNEE_COURANTE - 5}
                    value={b.anneeNaissance ?? ''}
                    onChange={(e) => maj({ anneeNaissance: e.target.value ? Number(e.target.value) : null })}
                    placeholder="1990"
                    className="min-h-[56px] w-full rounded-douce verre px-5 text-[17px] text-ivoire placeholder:text-estompe focus:outline-none"
                  />
                </label>
              </Question>
            )}

            {etape === 2 && (
              <Question
                titre="Ton genre ?"
                sousTitre="Facultatif, et sans aucun effet sur tes recommandations : CinéMood ne s’en sert jamais pour filtrer."
              >
                <div className="flex flex-wrap gap-2">
                  {['Femme', 'Homme', 'Non binaire', 'Je préfère ne pas répondre'].map((choix) => (
                    <Puce
                      key={choix}
                      actif={b.genrePersonne === choix}
                      onClick={() => maj({ genrePersonne: b.genrePersonne === choix ? '' : choix })}
                    >
                      {choix}
                    </Puce>
                  ))}
                </div>
              </Question>
            )}

            {etape === 3 && (
              <Question titre="Films, séries, ou les deux ?">
                <div className="space-y-3">
                  {(
                    [
                      [['film'], 'Plutôt des films', 'Une histoire, une soirée.'],
                      [['serie'], 'Plutôt des séries', 'De quoi tenir plusieurs semaines.'],
                      [['film', 'serie'], 'Les deux', 'Selon l’envie du moment.'],
                    ] as Array<[TypeContenu[], string, string]>
                  ).map(([valeur, libelle, detail]) => {
                    const actif = memeListe(b.typesSouhaites, valeur);
                    return (
                      <GrandChoix key={libelle} actif={actif} onClick={() => maj({ typesSouhaites: valeur })}>
                        <span className="text-[17px] text-ivoire">{libelle}</span>
                        <span className="mt-1 block text-[13px] text-estompe">{detail}</span>
                      </GrandChoix>
                    );
                  })}
                </div>
              </Question>
            )}

            {etape === 4 && (
              <Question titre="Tes genres" sousTitre="Ce que tu adores, et ce qu’il vaut mieux éviter.">
                <p className="mb-3 text-[13px] uppercase tracking-[0.14em] text-or/70">J’adore</p>
                <div className="flex flex-wrap gap-2">
                  {GENRES_PROPOSES.map((g) => (
                    <Puce
                      key={g}
                      actif={b.genresAdores.includes(g)}
                      onClick={() =>
                        maj({
                          genresAdores: basculer(b.genresAdores, g),
                          genresDetestes: b.genresDetestes.filter((x) => x !== g),
                        })
                      }
                    >
                      {g}
                    </Puce>
                  ))}
                </div>

                <p className="mb-3 mt-8 text-[13px] uppercase tracking-[0.14em] text-alerte/80">J’évite</p>
                <div className="flex flex-wrap gap-2">
                  {GENRES_PROPOSES.map((g) => (
                    <Puce
                      key={g}
                      actif={b.genresDetestes.includes(g)}
                      onClick={() =>
                        maj({
                          genresDetestes: basculer(b.genresDetestes, g),
                          genresAdores: b.genresAdores.filter((x) => x !== g),
                        })
                      }
                    >
                      {g}
                    </Puce>
                  ))}
                </div>
              </Question>
            )}

            {etape === 5 && (
              <Question
                titre="Choisis tes 5 préférés"
                sousTitre="C’est la question la plus utile du test : ces titres orientent tout le reste."
              >
                <GrilleAffiches
                  titres={grilleFavoris}
                  selection={b.favoris}
                  maximum={5}
                  onChange={(favoris) => maj({ favoris })}
                />
              </Question>
            )}

            {etape === 6 && (
              <Question
                titre="Et ceux de ton enfance ?"
                sousTitre={
                  b.anneeNaissance
                    ? `Sortis entre tes 6 et tes 16 ans. Coche ce qui te parle.`
                    : 'Renseigne ton année de naissance pour voir cette grille.'
                }
              >
                {grilleEnfance.length > 0 ? (
                  <GrilleAffiches
                    titres={grilleEnfance}
                    selection={b.enfance}
                    maximum={6}
                    onChange={(enfance) => maj({ enfance })}
                  />
                ) : (
                  <p className="text-[15px] leading-relaxed text-cendre">
                    Aucune suggestion pour cette période dans le catalogue. Passe à la suite, ça ne
                    change rien d’essentiel.
                  </p>
                )}
              </Question>
            )}

            {etape === 7 && (
              <Question titre="Ton ambiance préférée" sousTitre="Celle vers laquelle tu reviens toujours.">
                <div className="space-y-3">
                  {(
                    [
                      ['leger', 'Léger', 'Rire, respirer, ne pas réfléchir.'],
                      ['intense', 'Intense', 'Tension, rythme, adrénaline.'],
                      ['emouvant', 'Émouvant', 'Ce qui serre la gorge.'],
                      ['reflechi', 'Réfléchi', 'Ce qui trotte encore le lendemain.'],
                      ['flippant', 'Flippant', 'Les frissons, assumés.'],
                    ] as Array<[Tonalite, string, string]>
                  ).map(([cle, libelle, detail]) => (
                    <GrandChoix
                      key={cle}
                      actif={b.tonalitePreferee === cle}
                      onClick={() => maj({ tonalitePreferee: cle })}
                    >
                      <span className="text-[17px] text-ivoire">{libelle}</span>
                      <span className="mt-1 block text-[13px] text-estompe">{detail}</span>
                    </GrandChoix>
                  ))}
                </div>
              </Question>
            )}

            {etape === 8 && (
              <Question titre="Quelques réglages pratiques">
                <SousQuestion libelle="Durée maximale d’un film">
                  {[90, 120, 150, 0].map((v) => (
                    <Puce key={v} actif={(b.dureeMax ?? 0) === v} onClick={() => maj({ dureeMax: v === 0 ? null : v })}>
                      {v === 0 ? 'Peu importe' : `${Math.floor(v / 60)} h ${v % 60 || '00'}`}
                    </Puce>
                  ))}
                </SousQuestion>

                <SousQuestion libelle="Version originale ou française ?">
                  {(['vo', 'vf', 'indifferent'] as const).map((v) => (
                    <Puce key={v} actif={b.languePreferee === v} onClick={() => maj({ languePreferee: v })}>
                      {v === 'vo' ? 'VO sous-titrée' : v === 'vf' ? 'VF' : 'Peu importe'}
                    </Puce>
                  ))}
                </SousQuestion>

                <SousQuestion libelle="Plutôt récent ou plutôt classique ?">
                  {(['recent', 'classique', 'indifferent'] as const).map((v) => (
                    <Puce key={v} actif={b.epoquePreferee === v} onClick={() => maj({ epoquePreferee: v })}>
                      {v === 'recent' ? 'Récent' : v === 'classique' ? 'Classique' : 'Un peu des deux'}
                    </Puce>
                  ))}
                </SousQuestion>

                <SousQuestion libelle="Animation et anime ?">
                  <Puce actif={b.animationOk} onClick={() => maj({ animationOk: true })}>
                    Oui, j’aime
                  </Puce>
                  <Puce actif={!b.animationOk} onClick={() => maj({ animationOk: false })}>
                    Non merci
                  </Puce>
                </SousQuestion>
              </Question>
            )}

            {etape === 9 && (
              <Question
                titre="Une dernière chose, si tu veux"
                sousTitre="Entièrement facultatif. Rien ici n’est obligatoire, et tu peux passer."
              >
                <label className="block">
                  <span className="mb-2 block text-[13px] text-cendre">
                    Ce qui te passionne, en dehors du cinéma
                  </span>
                  <input
                    type="text"
                    value={b.interets}
                    onChange={(e) => maj({ interets: e.target.value.slice(0, 120) })}
                    placeholder="musique, voyage, sciences…"
                    className="min-h-[56px] w-full rounded-douce verre px-5 text-[16px] text-ivoire placeholder:text-estompe focus:outline-none"
                  />
                </label>

                <label className="mt-6 block">
                  <span className="mb-2 block text-[13px] text-cendre">
                    Des sujets que tu préfères ne jamais voir
                  </span>
                  <input
                    type="text"
                    value={b.aEviter}
                    onChange={(e) => maj({ aEviter: e.target.value.slice(0, 120) })}
                    placeholder="violence conjugale, suicide…"
                    className="min-h-[56px] w-full rounded-douce verre px-5 text-[16px] text-ivoire placeholder:text-estompe focus:outline-none"
                  />
                  <span className="mt-2 block text-[12px] leading-relaxed text-estompe">
                    Ces mots écartent définitivement les titres concernés.
                  </span>
                </label>
              </Question>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* --- Barre d'action ----------------------------------------------- */}
      <div
        className="verre-fort fixed inset-x-0 bottom-0 border-t border-white/[0.07] px-6 pt-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <div className="mx-auto max-w-xl">
          <Bouton
            variante="or"
            pleineLargeur
            disabled={!valide}
            onClick={() => (etape === NOMBRE_ECRANS - 1 ? terminer() : setEtape(etape + 1))}
          >
            {etape === NOMBRE_ECRANS - 1 ? 'Voir mon profil cinéma' : 'Continuer'}
          </Bouton>
        </div>
      </div>
    </main>
  );
}

/* =====================================================================
   Petits composants du test.
   ===================================================================== */

function Question({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="equilibre font-titre text-[2.2rem] leading-[1.08] text-ivoire">
        {titre}
      </h1>
      {sousTitre && <p className="mt-3 text-[15px] leading-relaxed text-cendre">{sousTitre}</p>}
      <div className="mt-7">{children}</div>
    </section>
  );
}

function SousQuestion({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <p className="mb-3 text-[13px] text-cendre">{libelle}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function GrandChoix({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      aria-pressed={actif}
      className={`w-full rounded-carte border px-5 py-4 text-left transition-colors ${
        actif ? 'border-or/60 bg-or/10' : 'border-white/[0.08] bg-white/[0.025]'
      }`}
    >
      {children}
    </motion.button>
  );
}

function GrilleAffiches({
  titres,
  selection,
  maximum,
  onChange,
}: {
  titres: Titre[];
  selection: string[];
  maximum: number;
  onChange: (selection: string[]) => void;
}) {
  return (
    <>
      <p className="mb-4 text-[13px] text-estompe">
        {selection.length} / {maximum} sélectionné{selection.length > 1 ? 's' : ''}
      </p>
      <ul className="grid grid-cols-3 gap-3">
        {titres.map((titre) => {
          const actif = selection.includes(titre.id);
          const complet = selection.length >= maximum && !actif;
          return (
            <li key={titre.id}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.94 }}
                disabled={complet}
                onClick={() => onChange(actif ? selection.filter((x) => x !== titre.id) : [...selection, titre.id])}
                aria-pressed={actif}
                className={`relative block w-full overflow-hidden rounded-douce transition-opacity ${
                  complet ? 'opacity-35' : ''
                }`}
              >
                <Affiche titre={titre} className="aspect-[2/3] w-full" />
                {actif && (
                  <span className="absolute inset-0 flex items-center justify-center bg-nuit/55 ring-2 ring-inset ring-or">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-voile-or text-nuit">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5 10 17.5 19 7" />
                      </svg>
                    </span>
                  </span>
                )}
              </motion.button>
              <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-tight text-estompe">{titre.titre}</p>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/* =====================================================================
   Utilitaires.
   ===================================================================== */

function basculer(liste: string[], valeur: string): string[] {
  return liste.includes(valeur) ? liste.filter((x) => x !== valeur) : [...liste, valeur];
}

function memeListe(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function decouper(texte: string): string[] {
  return texte
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter((x) => x.length > 1);
}

/** Années proposées en raccourci, de dix en dix puis au détail récent. */
function anneesProposees(): number[] {
  const annees: number[] = [];
  for (let a = 1950; a <= ANNEE_COURANTE - 5; a += 5) annees.push(a);
  return annees.reverse();
}

/**
 * Échantillon volontairement varié : on prend des titres dans chaque
 * décennie et dans des genres différents, pour que la grille ne soit pas
 * dix blockbusters des années 2010.
 */
function echantillonVarie(catalogue: Titre[], taille: number): Titre[] {
  const parDecennie = new Map<number, Titre[]>();
  for (const titre of catalogue) {
    const d = Math.floor(titre.annee / 10) * 10;
    if (!parDecennie.has(d)) parDecennie.set(d, []);
    parDecennie.get(d)!.push(titre);
  }

  const decennies = [...parDecennie.keys()].sort((a, b) => b - a);
  const resultat: Titre[] = [];
  const genresVus = new Set<string>();

  // Deux tours : d'abord un genre nouveau par décennie, puis on complète.
  for (let tour = 0; tour < 6 && resultat.length < taille; tour += 1) {
    for (const d of decennies) {
      if (resultat.length >= taille) break;
      const candidats = (parDecennie.get(d) ?? [])
        .filter((t) => !resultat.includes(t))
        .sort((a, b) => b.popularite - a.popularite);
      const choisi =
        candidats.find((t) => !genresVus.has(t.genres[0] ?? '')) ?? candidats[0];
      if (choisi) {
        resultat.push(choisi);
        genresVus.add(choisi.genres[0] ?? '');
      }
    }
  }
  return resultat.slice(0, taille);
}

/** Les titres sortis entre les 6 et les 16 ans de la personne. */
function titresDEnfance(catalogue: Titre[], anneeNaissance: number, taille: number): Titre[] {
  const debut = anneeNaissance + 6;
  const fin = anneeNaissance + 16;
  return catalogue
    .filter((t) => t.annee >= debut && t.annee <= fin)
    .sort((a, b) => b.popularite - a.popularite)
    .slice(0, taille);
}
