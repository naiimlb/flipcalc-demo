"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, signInWithGoogle, signUp, type AuthState } from "./actions";
import { Spinner } from "@/components/icons";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function AuthForm({
  initialMode,
  next,
  signupsOpen,
  googleEnabled,
}: {
  initialMode: "login" | "signup";
  next: string;
  signupsOpen: boolean;
  googleEnabled: boolean;
}) {
  const [mode, setMode] = useState(signupsOpen ? initialMode : "login");
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(signIn, {});
  const [signupState, signupAction, signupPending] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "login" ? loginState : signupState;
  const pending = mode === "login" ? loginPending : signupPending;

  return (
    <div>
      {signupsOpen && (
        <div className="mb-5 flex gap-1 rounded-full bg-white p-1 ring-1 ring-line">
          {(
            [
              ["login", "Connexion"],
              ["signup", "Inscription"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${mode === id ? "bg-ink text-white" : "text-ink-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {googleEnabled && (
        <>
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="btn-ghost w-full !py-3">
              <GoogleLogo /> Continuer avec Google
            </button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-ink-mute">
            <span className="h-px flex-1 bg-line" /> ou avec votre email <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form action={mode === "login" ? loginAction : signupAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <div>
            <label htmlFor="displayName" className="label">
              Nom affiché (optionnel)
            </label>
            <input id="displayName" name="displayName" maxLength={80} autoComplete="nickname" className="input" />
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="label">
              Mot de passe
            </label>
            {mode === "login" && (
              <Link href="/mot-de-passe-oublie" className="mb-1.5 text-xs font-semibold text-brand-accent">
                Mot de passe oublié ?
              </Link>
            )}
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="input"
          />
        </div>
        {state.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{state.error}</p>}
        {state.info && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.info}</p>}
        <button type="submit" disabled={pending} className="btn-dark w-full !py-3">
          {pending && <Spinner />}
          {mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
      {!signupsOpen && <p className="mt-4 text-center text-xs text-ink-mute">Les inscriptions sont actuellement fermées.</p>}
    </div>
  );
}
