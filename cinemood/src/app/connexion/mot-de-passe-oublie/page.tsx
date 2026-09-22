'use client';

/* =====================================================================
   Mot de passe oublié — demande du lien de réinitialisation.
   ---------------------------------------------------------------------
   Le message affiché après l'envoi est TOUJOURS le même, que l'adresse
   corresponde ou non à un compte : c'est `compte.ts` (et Supabase
   derrière lui) qui garantit ça, cette page n'a rien à faire de
   spécial pour ça — elle affiche juste ce qu'on lui répond.
   ===================================================================== */

import Link from 'next/link';
import { useState } from 'react';

import { Bouton } from '@/components/Boutons';
import { demanderReinitialisationMotDePasse } from '@/lib/cloud/compte';
import { clientNavigateur } from '@/lib/supabase/navigateur';

export default function PageMotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(evenement: React.FormEvent) {
    evenement.preventDefault();
    const supabase = clientNavigateur();
    if (!supabase) return;

    setEnCours(true);
    setErreur(null);
    const resultat = await demanderReinitialisationMotDePasse(
      supabase,
      email,
      `${window.location.origin}/connexion/nouveau-mot-de-passe`,
    );
    setEnCours(false);

    if (!resultat.ok) {
      setErreur(resultat.erreur ?? 'Quelque chose a échoué. Réessaie dans un instant.');
      return;
    }
    setEnvoye(true);
  }

  return (
    <main className="relative min-h-[100dvh] px-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-lueur" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center py-16">
        {envoye ? (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full verre">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-or" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6.5h16v11H4zM4 7l8 6 8-6" />
              </svg>
            </div>
            <h1 className="mt-7 font-titre text-[2rem] leading-tight text-ivoire">Vérifie ta boîte mail</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-cendre">
              Si un compte existe avec l’adresse <span className="text-ivoire">{email}</span>, un lien pour
              choisir un nouveau mot de passe vient de lui être envoyé.
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-titre text-[2.4rem] leading-tight text-ivoire">Mot de passe oublié ?</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-cendre">
              Indique ton adresse e-mail : on t’envoie un lien pour en choisir un nouveau.
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
                  className="min-h-[54px] w-full rounded-douce verre px-4 text-[16px] text-ivoire placeholder:text-estompe focus:border-or/50 focus:outline-none"
                />
              </div>

              {erreur && (
                <p role="alert" className="rounded-douce border border-alerte/30 bg-alerte/[0.08] px-4 py-3 text-[14px] text-alerte">
                  {erreur}
                </p>
              )}

              <Bouton variante="or" pleineLargeur type="submit" disabled={enCours}>
                {enCours ? 'Envoi…' : 'Envoyer le lien'}
              </Bouton>
            </form>
          </>
        )}

        <Link href="/connexion" className="mt-8 text-center text-[14px] text-cendre underline underline-offset-4">
          Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
