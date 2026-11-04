"use client";

import { useActionState } from "react";
import { Spinner } from "@/components/icons";
import { claimAdmin, completeSetup, type SetupState } from "./actions";

export function ClaimForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(claimAdmin, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="token" className="label">
          Jeton d&apos;installation (SETUP_TOKEN)
        </label>
        <input id="token" name="token" type="password" required autoComplete="off" className="input" />
      </div>
      {state.error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-dark w-full !py-3">
        {pending && <Spinner />} Devenir administrateur
      </button>
    </form>
  );
}

export function SetupForm({ needsToken }: { needsToken: boolean }) {
  const [state, action, pending] = useActionState<SetupState, FormData>(completeSetup, {});
  return (
    <form action={action} className="space-y-4">
      {needsToken && (
        <div>
          <label htmlFor="token" className="label">
            Jeton d&apos;installation (SETUP_TOKEN)
          </label>
          <input id="token" name="token" type="password" required autoComplete="off" className="input" />
        </div>
      )}
      <div>
        <label htmlFor="displayName" className="label">
          Nom affiché
        </label>
        <input id="displayName" name="displayName" maxLength={80} className="input" placeholder="Admin" />
      </div>
      <div>
        <label htmlFor="email" className="label">
          Email administrateur
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Mot de passe (10 caractères minimum)
        </label>
        <input id="password" name="password" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className="input" />
      </div>
      {state.error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}
      {state.info && <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">{state.info}</p>}
      <button type="submit" disabled={pending} className="btn-dark w-full !py-3">
        {pending && <Spinner />} Créer le compte administrateur
      </button>
    </form>
  );
}
