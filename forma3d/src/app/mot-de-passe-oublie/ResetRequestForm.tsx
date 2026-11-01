"use client";

import { useActionState } from "react";
import { Spinner } from "@/components/icons";
import { requestPasswordReset, type AuthState } from "../connexion/actions";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">
          Email du compte
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      {state.error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{state.error}</p>}
      {state.info && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.info}</p>}
      <button type="submit" disabled={pending} className="btn-dark w-full !py-3">
        {pending && <Spinner />} Envoyer le lien
      </button>
    </form>
  );
}
