"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, ErrorMessage, inputCls, linkBtn, primaryBtn } from "@/components/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { signIn } from "@/lib/auth";
import { cleanPrenom, isEmail, isPassword, isPrenom, MIN_PASSWORD, normalizeEmail } from "@/lib/validate";

const STEPS = 4;

async function post(url: string, body: unknown): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: res.ok, message: data.message ?? "Oups, une erreur est survenue. Réessaie." };
  } catch {
    return { ok: false, message: "Pas de connexion. Vérifie ton réseau." };
  }
}

/** Création de compte : une seule question par écran. */
export default function SignupPage() {
  const [step, setStep] = useState(0);
  const [code, setCode] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const go = (n: number) => {
    setError("");
    setStep(n);
  };

  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (step === 0) {
      if (!code.trim()) return setError("Écris le code d'équipe.");
      setBusy(true);
      const r = await post("/api/auth/code", { code });
      setBusy(false);
      return r.ok ? go(1) : setError(r.message);
    }
    if (step === 1) return isPrenom(cleanPrenom(prenom)) ? go(2) : setError("Écris ton prénom (30 caractères maximum).");
    if (step === 2) return isEmail(normalizeEmail(email)) ? go(3) : setError("Cet email n'a pas l'air valide.");
    if (!isPassword(password)) return setError(`Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.`);
    setBusy(true);
    const r = await post("/api/auth/inscription", { code, prenom: cleanPrenom(prenom), email: normalizeEmail(email), password });
    if (!r.ok) {
      setBusy(false);
      // Code refusé ou email déjà pris : on ramène l'utilisateur à l'étape concernée.
      if (r.message.startsWith("Code")) go(0);
      else if (r.message.startsWith("Cet email")) go(2);
      return setError(r.message);
    }
    const login = await signIn(email, password); // la redirection vers l'accueil se fait toute seule
    if (!login.ok) {
      setBusy(false);
      setError(login.message);
    }
  }

  const titles = ["Code d'équipe", "Ton prénom", "Ton email", "Ton mot de passe"];
  const hints = [
    "Demande-le à ton responsable.",
    "C'est comme ça que l'app te dira bonjour.",
    "Il te servira à te connecter.",
    `${MIN_PASSWORD} caractères minimum.`,
  ];

  return (
    <AuthShell
      title={titles[step]!}
      hint={hints[step]}
      footer={<Link href="/connexion" className={linkBtn}>J&apos;ai déjà un compte</Link>}
    >
      <div className="mb-5 flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS} aria-valuenow={step + 1} aria-label={`Étape ${step + 1} sur ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-pink" : "bg-pink-soft"}`} />
        ))}
      </div>

      <form onSubmit={next} noValidate className="space-y-3" key={step}>
        {step === 0 && (
          <input value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoCapitalize="characters" autoComplete="off" placeholder="Code d'équipe" aria-label="Code d'équipe" maxLength={100} className={inputCls} />
        )}
        {step === 1 && (
          <input value={prenom} onChange={(e) => setPrenom(e.target.value)} autoFocus autoComplete="given-name" placeholder="Prénom" aria-label="Ton prénom" maxLength={30} className={inputCls} />
        )}
        {step === 2 && (
          <input type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus placeholder="email@exemple.fr" aria-label="Ton email" className={inputCls} />
        )}
        {step === 3 && <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" label="Mot de passe" autoFocus />}
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
