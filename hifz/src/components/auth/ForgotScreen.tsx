"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell, Field, fieldClass } from "@/components/auth/AuthShell";
import { useAuth } from "@/components/providers/auth-context";
import { Button, Card } from "@/components/ui";
import { isAuthConfigured } from "@/lib/auth/config";
import { isValidEmail } from "@/lib/auth/errors";

export function ForgotScreen() {
  const { requestReset } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) return setError("Saisissez une adresse e-mail valide.");
    setBusy(true);
    try {
      const message = await requestReset(email);
      if (message) setError(message);
      else setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Mot de passe oublié" subtitle="Nous vous envoyons un lien pour en choisir un nouveau.">
      <Card>
        {!isAuthConfigured ? (
          <p className="text-[15px] text-muted">Les comptes ne sont pas activés sur cette installation.</p>
        ) : sent ? (
          // Même message que l'adresse existe ou non, pour ne pas révéler quels comptes existent.
          <p role="status" className="text-[15px] leading-relaxed">
            Si un compte existe pour {email.trim()}, un e-mail avec un lien de réinitialisation vient d&apos;être envoyé.
            Pensez à vérifier vos courriers indésirables.
          </p>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <Field label="Adresse e-mail">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {busy ? "Envoi…" : "Envoyer le lien"}
            </Button>
          </form>
        )}
        <Link href="/connexion" className="mt-4 flex min-h-11 items-center justify-center text-[15px] font-medium text-accent">
          Retour à la connexion
        </Link>
      </Card>
    </AuthShell>
  );
}
