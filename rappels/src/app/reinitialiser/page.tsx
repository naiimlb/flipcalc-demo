"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, ErrorMessage, linkBtn, primaryBtn } from "@/components/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { setNewPassword, useAuth } from "@/lib/auth";
import { isPassword, MIN_PASSWORD } from "@/lib/validate";

/** Page d'arrivée du lien reçu par email : choisir un nouveau mot de passe. */
export default function ResetPasswordPage() {
  const auth = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPassword(password)) return setError(`Mot de passe trop court : ${MIN_PASSWORD} caractères minimum.`);
    setBusy(true);
    const r = await setNewPassword(password);
    if (r.ok) return router.replace("/");
    setBusy(false);
    setError(r.message);
  }

  if (auth.status !== "signedIn") {
    return (
      <AuthShell title="Lien expiré" hint="Ce lien n'est plus valable. Demande-en un nouveau." footer={<Link href="/connexion" className={linkBtn}>Retour à la connexion</Link>}>
        <Link href="/mot-de-passe-oublie" className={`${primaryBtn} inline-flex items-center justify-center`}>Recevoir un nouveau lien</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nouveau mot de passe" hint={`${MIN_PASSWORD} caractères minimum.`}>
      <form onSubmit={submit} noValidate className="space-y-3">
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" label="Nouveau mot de passe" autoFocus />
        <ErrorMessage message={error} />
        <button type="submit" disabled={busy} className={`${primaryBtn} mt-2`}>{busy ? "Un instant…" : "Enregistrer"}</button>
      </form>
    </AuthShell>
  );
}
