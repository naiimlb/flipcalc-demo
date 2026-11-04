"use client";

import { useActionState } from "react";
import { Spinner } from "@/components/icons";
import { updatePassword, type AuthState } from "../connexion/actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className="label">
          Nouveau mot de passe
        </label>
        <input id="password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label htmlFor="confirm" className="label">
          Confirmation
        </label>
        <input id="confirm" name="confirm" type="password" required minLength={8} maxLength={72} autoComplete="new-password" className="input" />
      </div>
      {state.error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-dark w-full !py-3">
        {pending && <Spinner />} Enregistrer
      </button>
    </form>
  );
}
