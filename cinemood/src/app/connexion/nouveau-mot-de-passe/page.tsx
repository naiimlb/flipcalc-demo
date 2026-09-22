'use client';

/* =====================================================================
   Nouveau mot de passe — page où atterrit l'utilisateur après avoir
   cliqué sur le lien reçu par e-mail.
   ---------------------------------------------------------------------
   Supabase traite automatiquement le jeton présent dans l'URL (fragment
   `#access_token=...`) dès la création du client et émet un événement
   `PASSWORD_RECOVERY` sur `onAuthStateChange` une fois la session de
   récupération posée. On attend cet événement (ou une session déjà
   présente) avant d'afficher le formulaire ; si rien n'arrive après un
   court délai, le lien est probablement expiré ou déjà utilisé.
   ===================================================================== */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Bouton } from '@/components/Boutons';
import { definirNouveauMotDePasse } from '@/lib/cloud/compte';
import { clientNavigateur } from '@/lib/supabase/navigateur';

type Etat = 'verification' | 'pret' | 'invalide' | 'succes';

const DELAI_VERIFICATION_MS = 4000;

export default function PageNouveauMotDePasse() {
  const routeur = useRouter();
  const [etat, setEtat] = useState<Etat>('verification');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const pretRef = useRef(false);

  useEffect(() => {
    const supabase = clientNavigateur();
    if (!supabase) return;

    function marquerPret() {
      pretRef.current = true;
      setEtat('pret');
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) marquerPret();
    });

    const { data: abonnement } = supabase.auth.onAuthStateChange((evenement, session) => {
      if (evenement === 'PASSWORD_RECOVERY' || (session && evenement === 'SIGNED_IN')) {
        marquerPret();
      }
    });

    const delai = setTimeout(() => {
      if (!pretRef.current) setEtat('invalide');
    }, DELAI_VERIFICATION_MS);

    return () => {
      abonnement.subscription.unsubscribe();
      clearTimeout(delai);
    };
  }, []);

  async function envoyer(evenement: React.FormEvent) {
    evenement.preventDefault();
    const supabase = clientNavigateur();
    if (!supabase) return;

    if (motDePasse.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (motDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setEnCours(true);
    setErreur(null);
    const resultat = await definirNouveauMotDePasse(supabase, motDePasse);
    setEnCours(false);

    if (!resultat.ok) {
      setErreur(resultat.erreur ?? 'Quelque chose a échoué. Réessaie dans un instant.');
      return;
    }
    setEtat('succes');
  }

  return (
    <main className="relative min-h-[100dvh] px-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-lueur" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center py-16">
        {etat === 'verification' && (
          <div className="text-center">
            <h1 className="font-titre text-[2rem] leading-tight text-ivoire">Vérification du lien…</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-cendre">Un instant.</p>
          </div>
        )}

        {etat === 'invalide' && (
          <div className="text-center">
            <h1 className="font-titre text-[2rem] leading-tight text-ivoire">Lien invalide ou expiré</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-cendre">
              Ce lien de réinitialisation n’est plus valable. Demande-en un nouveau.
            </p>
            <Link
              href="/connexion/mot-de-passe-oublie"
              className="mt-8 inline-block text-[14px] text-cendre underline underline-offset-4"
            >
              Demander un nouveau lien
            </Link>
          </div>
        )}

        {etat === 'succes' && (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full verre">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-or" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-7 font-titre text-[2rem] leading-tight text-ivoire">Mot de passe mis à jour</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-cendre">
              Tu peux continuer directement, tu es déjà connecté·e.
            </p>
            <Bouton variante="or" pleineLargeur className="mt-8" onClick={() => routeur.push('/accueil')}>
              Continuer
            </Bouton>
          </div>
        )}

        {etat === 'pret' && (
          <>
            <h1 className="font-titre text-[2.4rem] leading-tight text-ivoire">Choisis un nouveau mot de passe</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-cendre">
              Il te sera demandé à chaque nouvelle connexion.
            </p>

            <form onSubmit={envoyer} className="mt-9 space-y-3.5">
              <div>
                <label htmlFor="motdepasse" className="sr-only">
                  Nouveau mot de passe
                </label>
                <input
                  id="motdepasse"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  placeholder="Nouveau mot de passe (8 caractères minimum)"
                  className="min-h-[54px] w-full rounded-douce verre px-4 text-[16px] text-ivoire placeholder:text-estompe focus:border-or/50 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="confirmation" className="sr-only">
                  Confirme le mot de passe
                </label>
                <input
                  id="confirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="Confirme le mot de passe"
                  className="min-h-[54px] w-full rounded-douce verre px-4 text-[16px] text-ivoire placeholder:text-estompe focus:border-or/50 focus:outline-none"
                />
              </div>

              {erreur && (
                <p role="alert" className="rounded-douce border border-alerte/30 bg-alerte/[0.08] px-4 py-3 text-[14px] text-alerte">
                  {erreur}
                </p>
              )}

              <Bouton variante="or" pleineLargeur type="submit" disabled={enCours}>
                {enCours ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
              </Bouton>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
