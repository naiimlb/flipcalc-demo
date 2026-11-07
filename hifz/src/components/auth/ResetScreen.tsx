"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthShell, Field, fieldClass } from "@/components/auth/AuthShell";
import { useAuth } from "@/components/providers/auth-context";
import { Button, Card } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/config";

/** Atteint depuis le lien reçu par e-mail : la session de récupération est établie par Supabase. */
export function ResetScreen() {
  const { state, updatePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Au moins ${MIN_PASSWORD_LENGTH} caractères.`);
    if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    try {
      const message = await updatePassword(password);
      if (message) setError(message);
      else {
        setDone(true);
        setTimeout(() => router.replace("/"), 1200);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Nouveau mot de passe">
      <Card>
        {state.status === "loading" ? (
          <p className="text-[15px] text-muted">Vérification du lien…</p>
        ) : state.status !== "signedIn" ? (
          <>
            <p role="alert" className="text-[15px] leading-relaxed">
              Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.
            </p>
            <Link href="/mot-de-passe-oublie" className="mt-4 flex min-h-11 items-center justify-center font-medium text-accent">
              Demander un nouveau lien
            </Link>
          </>
        ) : done ? (
          <p role="status" className="text-[15px]">
            Mot de passe mis à jour. Redirection…
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <Field label="Nouveau mot de passe" hint={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
                required
              />
            </Field>
            <Field label="Confirmer le mot de passe">
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={fieldClass}
                required
              />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-again">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        )}
      </Card>
    </AuthShell>
  );
}
