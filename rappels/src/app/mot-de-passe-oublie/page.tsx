"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, ErrorMessage, inputCls, linkBtn, primaryBtn } from "@/components/AuthShell";
import { sendResetEmail } from "@/lib/auth";
import { isEmail, normalizeEmail } from "@/lib/validate";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(normalizeEmail(email))) return setError("Cet email n'a pas l'air valide.");
    setBusy(true);
    setError("");
    const r = await sendResetEmail(email);
    setBusy(false);
    if (r.ok) setSent(true);
    else setError(r.message);
  }

  return (
    <AuthShell title="Mot de passe oublié" hint={sent ? undefined : "Écris ton email, on t'envoie un lien pour en choisir un nouveau."} footer={<Link href="/connexion" className={linkBtn}>Retour à la connexion</Link>}>
      {sent ? (
        <div className="rounded-3xl bg-white p-5 shadow-card">
          <p className="text-lg font-extrabold">C&apos;est parti 📬</p>
          <p className="mt-2 text-[15px] text-ink/80">Si un compte existe avec cet email, tu vas recevoir un lien. Pense à regarder tes spams. Rien reçu au bout de quelques minutes ? Demande à ton responsable.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <input type="email" inputMode="email" autoCapitalize="none" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ton email" aria-label="Ton email" className={inputCls} />
          <ErrorMessage message={error} />
          <button type="submit" disabled={busy} className={`${primaryBtn} mt-2`}>{busy ? "Envoi…" : "Envoyer le lien"}</button>
        </form>
      )}
    </AuthShell>
  );
}
