"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, ErrorMessage, inputCls, linkBtn, primaryBtn } from "@/components/AuthShell";
import { PasswordInput } from "@/components/PasswordInput";
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Écris ton email et ton mot de passe.");
    setBusy(true);
    setError("");
    const r = await signIn(email, password);
    if (!r.ok) {
      setError(r.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Connexion"
      hint="Retrouve tes tâches et tes rappels."
      footer={
        <>
          <Link href="/mot-de-passe-oublie" className={linkBtn}>Mot de passe oublié ?</Link>
          <Link href="/inscription" className={linkBtn}>Pas de compte ? Créer mon compte</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-3">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ton email"
          aria-label="Ton email"
          className={inputCls}
        />
        <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" label="Ton mot de passe" />
        <ErrorMessage message={error} />
        <button type="submit" disabled={busy} className={`${primaryBtn} mt-2`}>
          {busy ? "Connexion…" : "Me connecter"}
        </button>
      </form>
    </AuthShell>
  );
}
