"use client";

import Link from "next/link";
import { useState } from "react";
import { InstallHint } from "@/components/InstallHint";
import { AuthShell, ErrorMessage, inputCls, linkBtn, primaryBtn } from "@/components/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { signUp } from "@/lib/auth";
import { cleanPrenom, isEmail, isPassword, isPrenom, MIN_PASSWORD, normalizeEmail } from "@/lib/validate";

const STEPS = 3;

/** Création de compte : une seule question par écran. */
export default function SignupPage() {
  const [step, setStep] = useState(0);
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const go = (n: number) => {
    setError("");
    setStep(n);
  };

  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (step === 0) return isPrenom(cleanPrenom(prenom)) ? go(1) : setError("Écris ton prénom (30 caractères maximum).");
    if (step === 1) return isEmail(normalizeEmail(email)) ? go(2) : setError("Cet email n'a pas l'air valide.");
    if (!isPassword(password)) return setError(`Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.`);
    setBusy(true);
    const r = await signUp(cleanPrenom(prenom), normalizeEmail(email), password);
    setBusy(false);
    if (!r.ok) {
      if (r.message.startsWith("Cet email")) go(1);
      return setError(r.message);
    }
    if (r.needsConfirmation) setConfirm(true); // sinon : connecté, la redirection vers l'accueil se fait toute seule
  }

  const titles = ["Ton prénom", "Ton email", "Ton mot de passe"];
  const hints = ["C'est comme ça que l'app te dira bonjour.", "Il te servira à te connecter.", `${MIN_PASSWORD} caractères minimum.`];

  if (confirm) {
    return (
      <AuthShell title="Vérifie tes mails" footer={<Link href="/connexion" className={linkBtn}>Aller à la connexion</Link>}>
        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-lg font-extrabold">Compte créé 📬</p>
          <p className="mt-2 text-[15px] text-ink/80">On t&apos;a envoyé un lien de confirmation. Clique dessus (regarde aussi tes spams), puis connecte-toi.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={titles[step]!}
      hint={hints[step]}
      footer={<Link href="/connexion" className={linkBtn}>J&apos;ai déjà un compte</Link>}
    >
      <InstallHint />
      <div className="mb-5 flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label={`Étape ${step + 1} sur ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-pink" : "bg-pink-soft"}`} />
        ))}
      </div>

      <form onSubmit={next} noValidate className="space-y-3" key={step}>
        {step === 0 && (
          <input value={prenom} onChange={(e) => setPrenom(e.target.value)} autoFocus autoComplete="given-name" placeholder="Prénom" aria-label="Ton prénom" maxLength={30} className={inputCls} />
        )}
        {step === 1 && (
          <input type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus placeholder="email@exemple.fr" aria-label="Ton email" className={inputCls} />
        )}
        {step === 2 && <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" label="Mot de passe" autoFocus />}
        <ErrorMessage message={error} />
        <button type="submit" disabled={busy} className={`${primaryBtn} mt-2`}>
          {busy ? "Un instant…" : step === STEPS - 1 ? "Créer mon compte" : "Continuer"}
        </button>
        {step > 0 && (
          <button type="button" onClick={() => go(step - 1)} className="min-h-12 w-full rounded-full border-2 border-ink/15 bg-white text-base font-bold">
            Retour
          </button>
        )}
      </form>
    </AuthShell>
  );
}
