'use client';

/* =====================================================================
   Connexion — création de compte et connexion.
   ---------------------------------------------------------------------
   Si Supabase n'est pas configuré, cette page n'a pas lieu d'être : on
   redirige vers l'installation, et l'app fonctionne en mode local.

   Toute la logique d'authentification vit dans `@/lib/cloud/compte`
   (pure, testée) : cette page ne fait que la brancher sur un formulaire.
   ===================================================================== */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Bouton } from '@/components/Boutons';
import { inscrire, connecter, traduireErreurAuth } from '@/lib/cloud/compte';
import { SUPABASE_CONFIGURE } from '@/lib/supabase/config';
import { clientNavigateur } from '@/lib/supabase/navigateur';

type Mode = 'inscription' | 'connexion';

export default function PageConnexion() {
  const routeur = useRouter();
  const [mode, setMode] = useState<Mode>('inscription');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** `true` après une inscription qui attend une confirmation par e-mail. */
  const [confirmationEnAttente, setConfirmationEnAttente] = useState(false);

  useEffect(() => {
    if (!SUPABASE_CONFIGURE) routeur.replace('/bienvenue/plateformes');
  }, [routeur]);

  async function envoyer(evenement: React.FormEvent) {
    evenement.preventDefault();
    const supabase = clientNavigateur();
    if (!supabase) return;

    setEnCours(true);
    setMessage(null);

    if (mode === 'inscription') {
      const resultat = await inscrire(supabase, email, motDePasse, `${window.location.origin}/bienvenue/plateformes`);
      setEnCours(false);
      if (!resultat.ok) {
        setMessage(resultat.erreur ?? 'Quelque chose a échoué. Réessaie dans un instant.');
        return;
      }
      if (resultat.confirmationRequise) {
        setConfirmationEnAttente(true);
        return;
      }
      routeur.push('/bienvenue/plateformes');
      return;
    }

    const resultat = await connecter(supabase, email, motDePasse);
    setEnCours(false);
    if (!resultat.ok) {
      setMessage(resultat.erreur ?? 'Quelque chose a échoué. Réessaie dans un instant.');
      return;
    }
    routeur.push('/accueil');
  }

  async function avecFournisseur(fournisseur: 'apple' | 'google') {
    const supabase = clientNavigateur();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: fournisseur,
      options: { redirectTo: `${window.location.origin}/bienvenue/plateformes` },
    });
    if (error) setMessage(traduireErreurAuth(error.message));
  }

  /* --- Écran « vérifie ta boîte mail » --------------------------------- */
  if (confirmationEnAttente) {
    return (
      <main className="relative min-h-[100dvh] px-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-lueur" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full verre">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-accentTexte" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6.5h16v11H4zM4 7l8 6 8-6" />
            </svg>
          </div>
          <h1 className="mt-7 font-affiche text-[2rem] leading-tight text-ivoire">Vérifie ta boîte mail</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-cendre">
            On a envoyé un lien de confirmation à <span className="text-ivoire">{email}</span>. Clique dessus
            pour activer ton compte — tu reviendras directement ici, connecté·e.
          </p>
          <p className="mt-6 text-[13px] leading-relaxed text-estompe">
            Rien reçu ? Vérifie tes courriers indésirables, ou{' '}
            <button
              type="button"
              onClick={() => setConfirmationEnAttente(false)}
              className="text-cendre underline underline-offset-4"
            >
              recommence l’inscription
            </button>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] px-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-lueur" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center py-16">
        <h1 className="font-affiche text-[2.6rem] leading-tight text-ivoire">
          {mode === 'inscription' ? 'Créer ton compte' : 'Content de te revoir'}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-cendre">
          {mode === 'inscription'
            ? 'Ton profil te suivra sur tous tes appareils.'
            : 'Connecte-toi pour retrouver ta liste et tes recommandations.'}
        </p>

        <form onSubmit={envoyer} className="mt-9 space-y-3.5">
          <div>
            <label htmlFor="email" className="sr-only">
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.fr"
              className="min-h-[54px] w-full rounded-douce verre px-4 text-[16px] text-ivoire placeholder:text-estompe focus:border-accent/50 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="motdepasse" className="sr-only">
              Mot de passe
            </label>
            <input
              id="motdepasse"
              type="password"
              autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
              required
              minLength={8}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="Mot de passe (8 caractères minimum)"
              className="min-h-[54px] w-full rounded-douce verre px-4 text-[16px] text-ivoire placeholder:text-estompe focus:border-accent/50 focus:outline-none"
            />
          </div>

          {mode === 'connexion' && (
            <div className="text-right">
              <Link href="/connexion/mot-de-passe-oublie" className="text-[13px] text-cendre underline underline-offset-4">
                Mot de passe oublié ?
              </Link>
            </div>
          )}

          {message && (
            <p role="alert" className="rounded-douce border border-alerte/30 bg-alerte/[0.08] px-4 py-3 text-[14px] text-alerte">
              {message}
            </p>
          )}

          <Bouton variante="accent" pleineLargeur type="submit" disabled={enCours}>
            {enCours ? 'Un instant…' : mode === 'inscription' ? 'Créer mon compte' : 'Se connecter'}
          </Bouton>
        </form>

        <div className="my-7 flex items-center gap-4">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[12px] text-estompe">ou</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="space-y-3">
          <Bouton variante="verre" pleineLargeur onClick={() => void avecFournisseur('apple')}>
             Continuer avec Apple
          </Bouton>
          <Bouton variante="verre" pleineLargeur onClick={() => void avecFournisseur('google')}>
            Continuer avec Google
          </Bouton>
        </div>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'inscription' ? 'connexion' : 'inscription');
            setMessage(null);
          }}
          className="mt-8 text-center text-[14px] text-cendre underline underline-offset-4"
        >
          {mode === 'inscription' ? 'J’ai déjà un compte' : 'Créer un compte'}
        </button>

        <Link href="/bienvenue/plateformes" className="mt-4 text-center text-[13px] text-estompe">
          Essayer sans compte
        </Link>
      </div>
    </main>
  );
}
