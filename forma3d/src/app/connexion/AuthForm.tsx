"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { Spinner } from "@/components/icons";

export function AuthForm({ initialMode, next, signupsOpen }: { initialMode: "login" | "signup"; next: string; signupsOpen: boolean }) {
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
          <label htmlFor="password" className="label">
            Mot de passe
          </label>
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
