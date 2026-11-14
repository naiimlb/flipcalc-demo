"use client";

import { useState } from "react";
import { Toggle } from "@/components/studio/ui";
import type { FeatureFlags } from "@/lib/settings";
import { saveFeatures } from "../actions";
import { ResultMessage, useSave } from "../useSave";

type BoolKey = { [K in keyof FeatureFlags]: FeatureFlags[K] extends boolean ? K : never }[keyof FeatureFlags];

const GROUPS: { title: string; items: { key: BoolKey; label: string; help: string }[] }[] = [
  {
    title: "Exports",
    items: [
      { key: "exportGlb", label: "Export GLB", help: "Modèle 3D avec couleurs et matériaux." },
      { key: "exportStl", label: "Export STL", help: "Impression 3D (millimètres)." },
      { key: "exportPng", label: "Capture PNG", help: "Image de la vue courante." },
    ],
  },
  {
    title: "Demandes",
    items: [
      { key: "newRequests", label: "Nouvelles demandes", help: "Désactiver pour suspendre les générations (sauf admins)." },
      { key: "imageUpload", label: "Ajout de photo", help: "Photo de référence jointe à la demande." },
      { key: "demoFallback", label: "Modèles d'exemple si l'IA est absente", help: "Sans clé Anthropic, utilise le modèle d'exemple le plus proche." },
      {
        key: "meshy",
        label: "Objets décoratifs par Meshy (expérimental)",
        help: "Désactivé par défaut. Les conditions de Meshy interdisent de revendre l'accès : ne pas activer en public sans leur accord écrit.",
      },
    ],
  },
  {
    title: "Comptes et développement",
    items: [
      { key: "signupsOpen", label: "Inscriptions ouvertes", help: "Bloqué aussi côté base (déclencheur SQL)." },
      { key: "devMode", label: "Mode Dev", help: "Affiche le JSON brut de l'IA aux admins dans le tableau de bord." },
    ],
  },
];

export function FeaturesForm({ initial }: { initial: FeatureFlags }) {
  const [flags, setFlags] = useState<FeatureFlags>(initial);
  const { pending, result, run } = useSave();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveFeatures(flags));
      }}
    >
      {GROUPS.map((g) => (
        <section key={g.title} className="panel p-5">
          <h2 className="text-sm font-semibold">{g.title}</h2>
          <ul className="mt-3 divide-y divide-line">
            {g.items.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-ink-mute">{item.help}</p>
                </div>
                <Toggle checked={flags[item.key]} onChange={(v) => setFlags({ ...flags, [item.key]: v })} label={item.label} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="panel p-5">
        <h2 className="text-sm font-semibold">Limites par utilisateur</h2>
        <p className="text-xs text-ink-mute">Appliquées en base (fonction create_design_request). Les admins ne sont pas limités.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="hourlyLimit">
              Demandes par heure
            </label>
            <input id="hourlyLimit" type="number" min={0} max={1000} value={flags.hourlyLimit} onChange={(e) => setFlags({ ...flags, hourlyLimit: Number(e.target.value) })} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="dailyLimit">
              Demandes par jour
            </label>
            <input id="dailyLimit" type="number" min={0} max={10000} value={flags.dailyLimit} onChange={(e) => setFlags({ ...flags, dailyLimit: Number(e.target.value) })} className="input" />
          </div>
        </div>
      </section>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-dark">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <ResultMessage result={result} />
      </div>
    </form>
  );
}
