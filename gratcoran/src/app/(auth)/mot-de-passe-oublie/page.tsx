"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Logo, Notice } from "@/components/ui";
import { requestPasswordReset, type AuthState } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <Logo size={72} />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Mot de passe oublié</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Indique ton email : tu recevras un lien pour choisir un nouveau mot de passe.
        </p>
      </div>
      <form action={action} className="mt-8 space-y-4" noValidate>
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
        {state.error && <Notice tone="error">{state.error}</Notice>}
        {state.info && <Notice tone="info">{state.info}</Notice>}
        <Button type="submit" loading={pending}>
          Envoyer le lien
        </Button>
      </form>
      <div className="mt-5 text-center">
        <Link href="/login" className="text-[15px] font-medium text-emerald-deep dark:text-emerald">
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
