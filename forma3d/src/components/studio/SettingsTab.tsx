"use client";

import Link from "next/link";
import { signOut } from "@/app/actions";
import { IconLogout, IconShield } from "../icons";
import type { LengthUnit } from "./format";
import type { StudioPrefs, StudioViewer } from "./types";
import { Toggle } from "./ui";

const UNITS: { id: LengthUnit; label: string }[] = [
  { id: "mm", label: "Millimètres" },
  { id: "cm", label: "Centimètres" },
  { id: "in", label: "Pouces" },
];

export function SettingsTab({
  prefs,
  onPrefs,
  viewer,
  demoMode,
}: {
  prefs: StudioPrefs;
  onPrefs(patch: Partial<StudioPrefs>): void;
  viewer: StudioViewer | null;
  demoMode: boolean;
}) {
  return (
    <div className="grid gap-3 overflow-y-auto pb-1 scrollbar-thin md:grid-cols-2 lg:h-full">
      <section className="panel p-4">
        <h3 className="text-sm font-semibold">Affichage 3D</h3>
        <p className="mt-0.5 text-xs text-ink-mute">Mémorisé dans ce navigateur.</p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="label">Rendu par défaut</p>
            <div className="flex gap-1 rounded-full bg-paper p-1">
              {(
                [
                  ["neon", "Néon"],
                  ["real", "Réaliste"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPrefs({ mode: id })}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${prefs.mode === id ? "bg-brand-accent text-white" : "text-ink-soft"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Unités</p>
            <div className="flex gap-1 rounded-full bg-paper p-1">
              {UNITS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onPrefs({ unit: u.id })}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${prefs.unit === u.id ? "bg-brand-accent text-white" : "text-ink-soft"}`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            Rotation automatique
            <Toggle checked={prefs.autoRotate} onChange={(v) => onPrefs({ autoRotate: v })} label="Rotation automatique" />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            Grille au sol
            <Toggle checked={prefs.showGrid} onChange={(v) => onPrefs({ showGrid: v })} label="Grille au sol" />
          </label>
        </div>
      </section>

      <section className="panel p-4">
        <h3 className="text-sm font-semibold">Compte</h3>
        {viewer ? (
          <>
            <p className="mt-3 text-sm">{viewer.displayName ?? viewer.email}</p>
            <p className="text-xs text-ink-mute">{viewer.email}</p>
            <p className="mt-2">
              <span className={`chip ${viewer.role === "admin" ? "bg-ink text-white" : "bg-paper text-ink-soft"}`}>
                {viewer.role === "admin" ? "Administrateur" : "Utilisateur"}
              </span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/espace" className="btn-accent !text-xs">
                Mon espace
              </Link>
              {viewer.role === "admin" && (
                <Link href="/admin" className="btn-dark !text-xs">
                  <IconShield size={14} /> Administration
                </Link>
              )}
              <form action={signOut}>
                <button type="submit" className="btn-ghost !text-xs">
                  <IconLogout size={14} /> Se déconnecter
                </button>
              </form>
            </div>
          </>
        ) : demoMode ? (
          <p className="mt-3 text-sm text-ink-soft">
            Mode démo : configurez Supabase (voir le README) pour activer les comptes, l&apos;historique et l&apos;administration.
          </p>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-ink-soft">Connectez-vous pour sauvegarder vos conceptions.</p>
            <Link href="/connexion" className="btn-dark mt-3 !text-xs">
              Connexion / inscription
            </Link>
          </div>
        )}
        <div className="mt-6 rounded-xl bg-paper p-3 text-xs leading-relaxed text-ink-soft">
          Les modèles sont générés par IA : vérifiez toujours les cotes et la sécurité avant de fabriquer un objet.
        </div>
      </section>
    </div>
  );
}
