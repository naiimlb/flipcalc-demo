"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthShell, Field, fieldClass } from "@/components/auth/AuthShell";
import { useAuth } from "@/components/providers/auth-context";
import { Segmented } from "@/components/Stepper";
import { Button, Card } from "@/components/ui";
import { isAuthConfigured, MIN_PASSWORD_LENGTH } from "@/lib/auth/config";
import { isValidEmail } from "@/lib/auth/errors";

type Mode = "signin" | "signup";

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isAuthConfigured) {
    return (
      <AuthShell title="Hifz" subtitle="Les comptes ne sont pas activés sur cette installation.">
        <Card className="text-[15px] leading-relaxed text-muted">
          L&apos;application fonctionne en mode local : vos données restent sur cet appareil.
        </Card>
      </AuthShell>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!isValidEmail(email)) return setError("Saisissez une adresse e-mail valide.");
    if (!password) return setError("Saisissez votre mot de passe.");
    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const message = await signIn(email, password);
        if (message) setError(message);
        // En cas de succès, la garde d'accès redirige vers l'accueil.
      } else {
        const result = await signUp(email, password);
        if (result.error) setError(result.error);
        else if (result.needsConfirmation) {
          setNotice(`Un e-mail de confirmation a été envoyé à ${email.trim()}. Ouvrez le lien qu'il contient, puis connectez-vous.`);
          setMode("signin");
          setPassword("");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={mode === "signin" ? "Bon retour" : "Créer votre espace"}
      subtitle="Votre progression est enregistrée sur votre compte et retrouvée sur tous vos appareils."
    >
      <Card>
        <div className="mb-5">
          <Segmented
            label="Mode"
            options={[
              { value: "signin", label: "Se connecter" },
              { value: "signup", label: "Créer un compte" },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
              setNotice(null);
            }}
          />
        </div>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Adresse e-mail">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              required
            />
          </Field>
          <Field
            label="Mot de passe"
            hint={mode === "signup" ? `Au moins ${MIN_PASSWORD_LENGTH} caractères.` : undefined}
          >
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${fieldClass} pr-24`}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 min-w-20 px-4 text-sm font-medium text-accent"
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-again">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="rounded-2xl bg-accent-soft p-3 text-sm leading-relaxed">
              {notice}
            </p>
          ) : null}
          <Button type="submit" className="w-full text-lg" disabled={busy}>
            {busy ? "Un instant…" : mode === "signin" ? "Se connecter" : "Créer mon compte"}
          </Button>
        </form>
        {mode === "signin" ? (
          <Link href="/mot-de-passe-oublie" className="mt-4 flex min-h-11 items-center justify-center text-[15px] font-medium text-accent">
            Mot de passe oublié ?
          </Link>
        ) : null}
      </Card>
      <p className="mt-6 px-2 text-center text-sm leading-relaxed text-muted">
        Aucune publicité. Vos données ne servent qu&apos;à votre progression.{" "}
        <Link href="/sources" className="underline">
          Sources
        </Link>
      </p>
    </AuthShell>
  );
}
