"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, Field, Logo, Notice } from "@/components/ui";
import { signIn, signUp, type AuthState } from "../actions";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signInAction, signingIn] = useActionState<AuthState, FormData>(signIn, {});
  const [signUpState, signUpAction, signingUp] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "signin" ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="flex flex-col items-center text-center"
      >
        <Logo size={96} />
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Grat&apos;Coran</h1>
        <p className="mt-1.5 text-[15px] text-muted">Fais écouter une récitation, retrouve la sourate.</p>
      </motion.div>

      <div className="mt-8 grid grid-cols-2 rounded-2xl bg-line/50 p-1" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className="relative h-10 rounded-xl text-[15px] font-semibold"
          >
            {mode === m && (
              <motion.span
                layoutId="auth-tab"
                className="absolute inset-0 rounded-xl bg-surface shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className={`relative ${mode === m ? "text-ink" : "text-muted"}`}>
              {m === "signin" ? "Connexion" : "Inscription"}
            </span>
          </button>
        ))}
      </div>

      <form
        key={mode}
        action={mode === "signin" ? signInAction : signUpAction}
        className="mt-6 space-y-4"
        noValidate
      >
        <Field
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.email}
          required
        />
        <Field
          id="password"
          name="password"
          type="password"
          label={mode === "signup" ? "Mot de passe (8 caractères minimum)" : "Mot de passe"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          required
        />

        <AnimatePresence mode="wait">
          {state.error && <Notice tone="error">{state.error}</Notice>}
          {state.info && <Notice tone="info">{state.info}</Notice>}
        </AnimatePresence>

        <Button type="submit" loading={pending}>
          {mode === "signin" ? "Se connecter" : "Créer mon compte"}
        </Button>
      </form>

      {mode === "signin" && (
        <div className="mt-5 text-center">
          <Link href="/mot-de-passe-oublie" className="text-[15px] font-medium text-emerald-deep dark:text-emerald">
            Mot de passe oublié ?
          </Link>
        </div>
      )}
    </div>
  );
}
