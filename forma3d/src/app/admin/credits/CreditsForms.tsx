"use client";

import { useState } from "react";
import type { CreditSettings } from "@/lib/settings";
import { adjustUserCredits, saveCreditSettings, setUserAllowance } from "../actions";
import { ResultMessage, useSave } from "../useSave";

const ACTIONS: { key: keyof CreditSettings["costs"]; label: string; hint: string }[] = [
  { key: "design", label: "Conception", hint: "Une nouvelle demande traitée par l'IA" },
  { key: "variant", label: "Nouvelle version", hint: "Plus petit, plus solide, moins cher, plus esthétique" },
  { key: "model3d", label: "Maillage 3D (futur service text-to-3D)", hint: "Plus coûteux qu'une conception simple" },
  { key: "ai_edit", label: "« Modifie la pièce » (IA)", hint: "Une consigne appliquée par Claude dans l'éditeur" },
  { key: "meshy_preview", label: "Meshy : modèle 3D / variante", hint: "Meshy facture 20 crédits par aperçu" },
  { key: "meshy_refine", label: "Meshy : texture du modèle", hint: "Meshy facture 10 crédits (2K)" },
  { key: "meshy_retexture", label: "Meshy : retexturer", hint: "Meshy facture 10 crédits (2K)" },
  { key: "meshy_remesh", label: "Meshy : simplifier le maillage", hint: "Meshy facture 5 crédits" },
  { key: "meshy_resize", label: "Meshy : mettre à l'échelle réelle", hint: "Meshy facture 1 crédit" },
  { key: "meshy_repair", label: "Meshy : réparer pour l'impression", hint: "Meshy facture 10 crédits" },
  { key: "meshy_analyze", label: "Meshy : analyser l'imprimabilité", hint: "Gratuit chez Meshy" },
];

/** Allocation mensuelle et coût de chaque action. */
export function CreditSettingsForm({ initial }: { initial: CreditSettings }) {
  const [value, setValue] = useState(initial);
  const { pending, result, run } = useSave();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCreditSettings(value));
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="label">Crédits gratuits par mois et par utilisateur</span>
        <input
          type="number"
          min={0}
          max={100000}
          value={value.monthlyFree}
          onChange={(e) => setValue({ ...value, monthlyFree: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
          className="input max-w-[200px]"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        {ACTIONS.map((a) => (
          <label key={a.key} className="block">
            <span className="label">{a.label}</span>
            <input
              type="number"
              min={0}
              max={1000}
              value={value.costs[a.key]}
              onChange={(e) => setValue({ ...value, costs: { ...value.costs, [a.key]: Math.max(0, Math.trunc(Number(e.target.value) || 0)) } })}
              className="input"
            />
            <span className="mt-1 block text-xs text-ink-mute">{a.hint}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-dark">
          Enregistrer
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}

/** Offrir / retirer des crédits et régler l'allocation d'un utilisateur. */
export function UserCreditActions({ userId, allowance }: { userId: string; allowance: number | null }) {
  const [delta, setDelta] = useState(10);
  const [note, setNote] = useState("");
  const [custom, setCustom] = useState(allowance === null ? "" : String(allowance));
  const { pending, result, run } = useSave();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="number"
        value={delta}
        onChange={(e) => setDelta(Math.trunc(Number(e.target.value) || 0))}
        className="input !w-20 !px-2 !py-1 !text-xs"
        aria-label="Nombre de crédits (négatif pour retirer)"
      />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motif (facultatif)" maxLength={200} className="input !w-36 !px-2 !py-1 !text-xs" />
      <button type="button" disabled={pending || delta === 0} onClick={() => run(() => adjustUserCredits(userId, delta, note))} className="btn-ghost !px-3 !py-1 !text-xs">
        {delta >= 0 ? "Offrir" : "Retirer"}
      </button>
      <input
        type="number"
        min={0}
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        placeholder="Allocation"
        className="input !w-24 !px-2 !py-1 !text-xs"
        aria-label="Allocation mensuelle propre (vide = par défaut)"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => setUserAllowance(userId, custom.trim() === "" ? null : Math.trunc(Number(custom))))}
        className="btn-ghost !px-3 !py-1 !text-xs"
      >
        Allocation
      </button>
      <ResultMessage result={result} />
    </div>
  );
}
