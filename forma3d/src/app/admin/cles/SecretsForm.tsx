"use client";

import { useState } from "react";
import type { SecretStatus } from "@/lib/secrets";
import { removeSecret, setSecret } from "../actions";
import { ResultMessage, useSave } from "../useSave";

const SOURCE_LABEL: Record<SecretStatus["source"], [string, string]> = {
  admin: ["Saisie dans l'admin (chiffrée)", "bg-success/10 text-success"],
  env: ["Variable d'environnement", "bg-accent/10 text-accent"],
  none: ["Non configurée", "bg-danger/10 text-danger"],
};

function SecretRow({ secret, canStore }: { secret: SecretStatus; canStore: boolean }) {
  const [value, setValue] = useState("");
  const { pending, result, run } = useSave();
  const [label, tone] = SOURCE_LABEL[secret.source];

  return (
    <li className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{secret.label}</p>
          <p className="text-xs text-ink-mute">
            <code>{secret.name}</code> · {secret.help}
          </p>
        </div>
        <span className={`chip ${tone}`}>
          {label}
          {secret.hint && <span className="font-mono">{secret.hint}</span>}
        </span>
      </div>
      {canStore ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await setSecret(secret.name, value);
              if (r.ok) setValue("");
              return r;
            });
          }}
        >
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={secret.source === "none" ? "Coller la clé…" : "Remplacer la clé…"}
            className="input font-mono"
            aria-label={`Nouvelle valeur pour ${secret.name}`}
          />
          <button type="submit" disabled={pending || value.trim().length < 10} className="btn-dark shrink-0">
            Enregistrer
          </button>
          {secret.source === "admin" && (
            <button
              type="button"
              disabled={pending}
              className="btn-ghost shrink-0 !text-danger"
              onClick={() => confirm("Supprimer cette clé ?") && run(() => removeSecret(secret.name))}
            >
              Supprimer
            </button>
          )}
        </form>
      ) : null}
      <div className="mt-2">
        <ResultMessage result={result} />
      </div>
    </li>
  );
}

export function SecretsForm({ secrets, canStore }: { secrets: SecretStatus[]; canStore: boolean }) {
  return (
    <ul className="space-y-3">
      {secrets.map((s) => (
        <SecretRow key={s.name} secret={s} canStore={canStore} />
      ))}
    </ul>
  );
}
