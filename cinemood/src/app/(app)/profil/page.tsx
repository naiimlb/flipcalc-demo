'use client';

/* =====================================================================
   Profil — plateformes, préférences, compte.
   ---------------------------------------------------------------------
   Tout ce qui a été répondu au test est modifiable ici, à tout moment.
   Y compris la chose la plus structurante : les plateformes.
   ===================================================================== */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Bouton, Puce } from '@/components/Boutons';
import { PastillePlateforme } from '@/components/PastillePlateforme';
import { profilCinema, LIBELLE_TONALITE } from '@/lib/reco/explication';
import { generation } from '@/lib/reco/epoque';
import { PLATEFORMES } from '@/lib/reco/plateformes';
import { changerEmail, definirNouveauMotDePasse, deconnecter, supprimerCompteCloud } from '@/lib/cloud/compte';
import { SUPABASE_CONFIGURE } from '@/lib/supabase/config';
import { clientNavigateur } from '@/lib/supabase/navigateur';
import { useApp } from '@/lib/etat/magasin';
import { GENRES_PROPOSES } from '@/lib/tmdb/genres';
import type { Tonalite } from '@/lib/reco/types';

export default function PageProfil() {
  const { profil, majProfil, reinitialiser, connecte, emailCompte } = useApp();
  const routeur = useRouter();
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const [confirmationRefaireTest, setConfirmationRefaireTest] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [editionEmail, setEditionEmail] = useState(false);
  const [nouvelEmail, setNouvelEmail] = useState('');
  const [enCoursEmail, setEnCoursEmail] = useState(false);
  const [messageEmail, setMessageEmail] = useState<string | null>(null);

  const [editionMotDePasse, setEditionMotDePasse] = useState(false);
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState('');
  const [enCoursMotDePasse, setEnCoursMotDePasse] = useState(false);
  const [messageMotDePasse, setMessageMotDePasse] = useState<string | null>(null);

  if (!profil) return null;
  const carte = profilCinema(profil);

  function basculerPlateforme(id: string) {
    if (!profil) return;
    const presente = profil.plateformes.includes(id);
    const suivantes = presente
      ? profil.plateformes.filter((p) => p !== id)
      : [...profil.plateformes, id];
    majProfil({ plateformes: suivantes });
  }

  function basculerGenre(genre: string, champ: 'genresAdores' | 'genresDetestes') {
    if (!profil) return;
    const actuel = profil[champ];
    const autre = champ === 'genresAdores' ? 'genresDetestes' : 'genresAdores';
    const suivant = actuel.includes(genre) ? actuel.filter((g) => g !== genre) : [...actuel, genre];
    majProfil({
      [champ]: suivant,
      // Un genre ne peut pas être à la fois adoré et détesté.
      [autre]: profil[autre].filter((g) => g !== genre),
    } as Parameters<typeof majProfil>[0]);
  }

  async function seDeconnecter() {
    const supabase = clientNavigateur();
    if (supabase) await deconnecter(supabase);
    reinitialiser();
    routeur.push('/');
  }

  async function supprimerLeCompte() {
    const supabase = clientNavigateur();
    if (supabase) {
      // La fonction SQL `supprimer_mon_compte` efface la ligne dans
      // auth.users ; la cascade nettoie profil, liste et interactions.
      const resultat = await supprimerCompteCloud(supabase);
      if (!resultat.ok) {
        setMessage(resultat.erreur ?? 'La suppression a échoué. Réessaie dans un instant.');
        return;
      }
      await deconnecter(supabase);
    }
    reinitialiser();
    routeur.push('/');
  }

  async function envoyerNouvelEmail(evenement: React.FormEvent) {
    evenement.preventDefault();
    const supabase = clientNavigateur();
    if (!supabase) return;
    setEnCoursEmail(true);
    setMessageEmail(null);
    const resultat = await changerEmail(supabase, nouvelEmail);
    setEnCoursEmail(false);
    if (!resultat.ok) {
      setMessageEmail(resultat.erreur ?? 'Quelque chose a échoué. Réessaie dans un instant.');
      return;
    }
    setMessageEmail(
      `Un e-mail de confirmation a été envoyé à ${nouvelEmail}. Le changement ne prendra effet qu’après avoir cliqué sur le lien qu’il contient.`,
    );
    setNouvelEmail('');
  }

  async function envoyerNouveauMotDePasse(evenement: React.FormEvent) {
    evenement.preventDefault();
    const supabase = clientNavigateur();
    if (!supabase) return;
    if (nouveauMotDePasse.length < 8) {
      setMessageMotDePasse('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (nouveauMotDePasse !== confirmationMotDePasse) {
      setMessageMotDePasse('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setEnCoursMotDePasse(true);
    setMessageMotDePasse(null);
    const resultat = await definirNouveauMotDePasse(supabase, nouveauMotDePasse);
    setEnCoursMotDePasse(false);
    if (!resultat.ok) {
      setMessageMotDePasse(resultat.erreur ?? 'Quelque chose a échoué. Réessaie dans un instant.');
      return;
    }
    setMessageMotDePasse('Mot de passe mis à jour.');
    setNouveauMotDePasse('');
    setConfirmationMotDePasse('');
    setEditionMotDePasse(false);
  }

  return (
    <>
      <header className="zone-sure-haut px-5 pb-2 pt-4">
        <h1 className="font-affiche text-[2.2rem] leading-none text-ivoire">Profil</h1>
      </header>

      {/* --- Carte d'identité cinéma ------------------------------------ */}
      <section className="mt-6 px-5">
        <div className="grain relative overflow-hidden rounded-carte verre p-6">
          <p className="etiquette">Ton profil cinéma</p>
          <p className="mt-2 font-affiche text-[2rem] leading-tight text-ivoire">{carte.titre}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-cendre">{carte.resume}</p>
          <p className="mt-4 text-[12px] text-estompe">
            {profil.pseudo} · {generation(profil.anneeNaissance)} ·{' '}
            {new Date().getFullYear() - profil.anneeNaissance} ans
          </p>
        </div>
      </section>

      {/* --- Plateformes ------------------------------------------------- */}
      <Bloc titre="Mes plateformes" sousTitre="Aucune recommandation ne sortira de cette liste.">
        <div className="grid grid-cols-3 gap-2.5">
          {PLATEFORMES.map((p) => {
            const actif = profil.plateformes.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => basculerPlateforme(p.id)}
                aria-pressed={actif}
                className={`flex min-h-[74px] flex-col items-center justify-center gap-2 rounded-douce border px-1.5 transition-colors ${
                  actif ? 'border-accent/60 bg-accent/10' : 'border-white/[0.07] bg-white/[0.02]'
                }`}
              >
                <PastillePlateforme id={p.id} taille="petite" />
                <span className={`text-center text-[11px] leading-tight ${actif ? 'text-ivoire' : 'text-estompe'}`}>
                  {p.nom}
                </span>
              </button>
            );
          })}
        </div>
        {profil.plateformes.length === 0 && (
          <p className="mt-3 text-[13px] leading-relaxed text-cendre">
            Aucun abonnement sélectionné : CinéMood ne te proposera que des titres disponibles
            gratuitement (arte.tv, france.tv, TF1+, M6+, Pluto TV).
          </p>
        )}
      </Bloc>

      {/* --- Goûts -------------------------------------------------------- */}
      <Bloc titre="Genres que j’adore">
        <div className="flex flex-wrap gap-2">
          {GENRES_PROPOSES.map((g) => (
            <Puce key={g} actif={profil.genresAdores.includes(g)} onClick={() => basculerGenre(g, 'genresAdores')}>
              {g}
            </Puce>
          ))}
        </div>
      </Bloc>

      <Bloc titre="Genres que j’évite">
        <div className="flex flex-wrap gap-2">
          {GENRES_PROPOSES.map((g) => (
            <Puce key={g} actif={profil.genresDetestes.includes(g)} onClick={() => basculerGenre(g, 'genresDetestes')}>
              {g}
            </Puce>
          ))}
        </div>
      </Bloc>

      {/* --- Préférences pratiques ---------------------------------------- */}
      <Bloc titre="Préférences">
        <Ligne libelle="Ambiance préférée">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LIBELLE_TONALITE) as Tonalite[]).map((t) => (
              <Puce key={t} actif={profil.tonalitePreferee === t} onClick={() => majProfil({ tonalitePreferee: t })}>
                {LIBELLE_TONALITE[t]}
              </Puce>
            ))}
          </div>
        </Ligne>

        <Ligne libelle="Durée maximale">
          <div className="flex flex-wrap gap-2">
            {[90, 120, 150, 0].map((v) => (
              <Puce
                key={v}
                actif={(profil.dureeMax ?? 0) === v}
                onClick={() => majProfil({ dureeMax: v === 0 ? null : v })}
              >
                {v === 0 ? 'Peu importe' : `${Math.floor(v / 60)} h ${v % 60 || '00'}`}
              </Puce>
            ))}
          </div>
        </Ligne>

        <Ligne libelle="Version">
          <div className="flex flex-wrap gap-2">
            {(['vo', 'vf', 'indifferent'] as const).map((v) => (
              <Puce key={v} actif={profil.languePreferee === v} onClick={() => majProfil({ languePreferee: v })}>
                {v === 'vo' ? 'VO sous-titrée' : v === 'vf' ? 'VF' : 'Peu importe'}
              </Puce>
            ))}
          </div>
        </Ligne>

        <Ligne libelle="Époque">
          <div className="flex flex-wrap gap-2">
            {(['recent', 'classique', 'indifferent'] as const).map((v) => (
              <Puce key={v} actif={profil.epoquePreferee === v} onClick={() => majProfil({ epoquePreferee: v })}>
                {v === 'recent' ? 'Plutôt récent' : v === 'classique' ? 'Plutôt classique' : 'Un peu des deux'}
              </Puce>
            ))}
          </div>
        </Ligne>

        <Ligne libelle="Animation et anime">
          <div className="flex gap-2">
            <Puce actif={profil.animationOk} onClick={() => majProfil({ animationOk: true })}>
              Oui, j’aime
            </Puce>
            <Puce actif={!profil.animationOk} onClick={() => majProfil({ animationOk: false })}>
              Non merci
            </Puce>
          </div>
        </Ligne>
      </Bloc>

      {/* --- Compte -------------------------------------------------------- */}
      <Bloc titre="Compte">
        <div className="space-y-3">
          {SUPABASE_CONFIGURE && connecte && emailCompte && (
            <p className="text-[13px] text-cendre">
              Connecté·e en tant que <span className="text-ivoire">{emailCompte}</span>
            </p>
          )}

          {SUPABASE_CONFIGURE && connecte && (
            <>
              {!editionEmail ? (
                <Bouton
                  variante="verre"
                  pleineLargeur
                  onClick={() => {
                    setEditionEmail(true);
                    setMessageEmail(null);
                    setNouvelEmail('');
                  }}
                >
                  Modifier mon e-mail
                </Bouton>
              ) : (
                <form onSubmit={envoyerNouvelEmail} className="rounded-douce border border-white/10 bg-white/[0.02] p-4">
                  <label htmlFor="nouvel-email" className="mb-2 block text-[13px] text-cendre">
                    Nouvelle adresse e-mail
                  </label>
                  <input
                    id="nouvel-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={nouvelEmail}
                    onChange={(e) => setNouvelEmail(e.target.value)}
                    placeholder="ton@email.fr"
                    className="min-h-[48px] w-full rounded-douce verre px-4 text-[16px] text-ivoire placeholder:text-estompe focus:border-accent/50 focus:outline-none"
                  />
                  {messageEmail && <p className="mt-3 text-[13px] leading-relaxed text-cendre">{messageEmail}</p>}
                  <div className="mt-4 flex gap-3">
                    <Bouton
                      type="button"
                      variante="fantome"
                      className="flex-1"
                      onClick={() => {
                        setEditionEmail(false);
                        setMessageEmail(null);
                      }}
                    >
                      Annuler
                    </Bouton>
                    <Bouton variante="accent" type="submit" className="flex-1" disabled={enCoursEmail}>
                      {enCoursEmail ? 'Envoi…' : 'Valider'}
                    </Bouton>
                  </div>
                </form>
              )}

              {!editionMotDePasse ? (
                <Bouton
                  variante="verre"
                  pleineLargeur
                  onClick={() => {
                    setEditionMotDePasse(true);
                    setMessageMotDePasse(null);
                    setNouveauMotDePasse('');
                    setConfirmationMotDePasse('');
                  }}
                >
                  Modifier mon mot de passe
                </Bouton>
              ) : (
                <form
                  onSubmit={envoyerNouveauMotDePasse}
                  className="rounded-douce border border-white/10 bg-white/[0.02] p-4"
                >
                  <label htmlFor="nouveau-mdp" className="mb-2 block text-[13px] text-cendre">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="nouveau-mdp"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={nouveauMotDePasse}
                    onChange={(e) => setNouveauMotDePasse(e.target.value)}
                    placeholder="8 caractères minimum"
                    className="min-h-[48px] w-full rounded-douce verre px-4 text-[16px] text-ivoire placeholder:text-estompe focus:border-accent/50 focus:outline-none"
                  />
                  <label htmlFor="confirmation-mdp" className="mb-2 mt-3 block text-[13px] text-cendre">
                    Confirme-le
                  </label>
                  <input
                    id="confirmation-mdp"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmationMotDePasse}
                    onChange={(e) => setConfirmationMotDePasse(e.target.value)}
                    placeholder="Confirme le mot de passe"
                    className="min-h-[48px] w-full rounded-douce verre px-4 text-[16px] text-ivoire placeholder:text-estompe focus:border-accent/50 focus:outline-none"
                  />
                  {messageMotDePasse && (
                    <p className="mt-3 text-[13px] leading-relaxed text-cendre">{messageMotDePasse}</p>
                  )}
                  <div className="mt-4 flex gap-3">
                    <Bouton
                      type="button"
                      variante="fantome"
                      className="flex-1"
                      onClick={() => {
                        setEditionMotDePasse(false);
                        setMessageMotDePasse(null);
                      }}
                    >
                      Annuler
                    </Bouton>
                    <Bouton variante="accent" type="submit" className="flex-1" disabled={enCoursMotDePasse}>
                      {enCoursMotDePasse ? 'Enregistrement…' : 'Valider'}
                    </Bouton>
                  </div>
                </form>
              )}
            </>
          )}

          {!confirmationRefaireTest ? (
            <Bouton variante="verre" pleineLargeur onClick={() => setConfirmationRefaireTest(true)}>
              Refaire le test de personnalité
            </Bouton>
          ) : (
            <div className="rounded-douce border border-accent/30 bg-accent/[0.06] p-4">
              <p className="text-[14px] leading-relaxed text-ivoire">
                Refaire le test remplacera ton profil de goûts actuel par les nouvelles réponses.
              </p>
              <div className="mt-4 flex gap-3">
                <Bouton variante="verre" onClick={() => setConfirmationRefaireTest(false)} className="flex-1">
                  Annuler
                </Bouton>
                <Bouton
                  variante="accent"
                  className="flex-1"
                  onClick={() => routeur.push('/bienvenue/test')}
                >
                  Continuer
                </Bouton>
              </div>
            </div>
          )}

          {SUPABASE_CONFIGURE && connecte && (
            <Bouton variante="verre" pleineLargeur onClick={() => void seDeconnecter()}>
              Se déconnecter
            </Bouton>
          )}

          {!confirmationSuppression ? (
            <Bouton variante="fantome" pleineLargeur onClick={() => setConfirmationSuppression(true)}>
              Supprimer mon compte
            </Bouton>
          ) : (
            <div className="rounded-douce border border-alerte/35 bg-alerte/[0.07] p-4">
              <p className="text-[14px] leading-relaxed text-ivoire">
                Cette action efface définitivement ton profil, ta liste et ton historique. Elle est
                irréversible.
              </p>
              <div className="mt-4 flex gap-3">
                <Bouton variante="verre" onClick={() => setConfirmationSuppression(false)} className="flex-1">
                  Annuler
                </Bouton>
                <button
                  type="button"
                  onClick={() => void supprimerLeCompte()}
                  className="flex-1 rounded-douce bg-alerte/90 px-4 font-semibold text-white"
                >
                  Supprimer
                </button>
              </div>
            </div>
          )}

          {message && <p className="text-[13px] text-alerte">{message}</p>}
        </div>
      </Bloc>

      <p className="mt-10 px-8 text-center text-[12px] leading-relaxed text-estompe">
        Ce produit utilise l’API TMDB mais n’est pas approuvé ni certifié par TMDB.
      </p>
    </>
  );
}

function Bloc({
  titre,
  sousTitre,
  children,
}: {
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9 px-5">
      <h2 className="font-affiche text-[1.4rem] text-ivoire">{titre}</h2>
      {sousTitre && <p className="mb-4 mt-1 text-[13px] leading-relaxed text-estompe">{sousTitre}</p>}
      <div className={sousTitre ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2.5 text-[13px] text-cendre">{libelle}</p>
      {children}
    </div>
  );
}
