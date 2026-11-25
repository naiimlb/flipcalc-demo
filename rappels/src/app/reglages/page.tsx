"use client";

import Link from "next/link";
import { useState } from "react";
import { Header } from "@/components/Header";
import { ImportLocalCard } from "@/components/ImportLocalCard";
import { NotifSettings } from "@/components/NotifSettings";
import { NotificationCard } from "@/components/NotificationCard";
import { Skeleton } from "@/components/Skeleton";
import { TestNotification } from "@/components/TestNotification";
import { signOut } from "@/lib/auth";
import { buildNotification } from "@/lib/notify";
import { sampleTasks } from "@/lib/samples";
import { formatMinutes, HANDOVER_CHOICES, reminderLabel } from "@/lib/service";
import { updateState, useAppState } from "@/lib/store";
import { REMINDERS, type Reminder } from "@/lib/types";
import { cleanPrenom, isPrenom } from "@/lib/validate";

const card = "rounded-3xl bg-white p-4 shadow-card";
const h2 = "h-street mb-3 text-xl";
const field = "min-h-12 w-full rounded-2xl border-2 border-line bg-white px-4 text-[17px] font-semibold focus:border-pink";

export default function SettingsPage() {
  const state = useAppState();
  const [prenom, setPrenom] = useState<string | null>(null);
  const [busyOut, setBusyOut] = useState(false);
  if (!state) return <Skeleton />;

  const { profile, settings } = state;
  const draft = prenom ?? profile.prenom;
  const cleaned = cleanPrenom(draft);
  const canSave = isPrenom(cleaned) && cleaned !== profile.prenom;
  const sample = state.tasks[0];

  return (
    <>
      <Header title="Réglages" />
      <div className="space-y-4">
        <ImportLocalCard userId={profile.id} always />

        <section className={card}>
          <h2 className={h2}>Mon compte</h2>
          <label htmlFor="prenom" className="mb-2 block text-sm font-semibold text-mute">Prénom</label>
          <div className="flex gap-2">
            <input id="prenom" value={draft} maxLength={30} onChange={(e) => setPrenom(e.target.value)} className={field} />
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                void updateState((s) => ({ ...s, profile: { ...s.profile, prenom: cleaned } }));
                setPrenom(null);
              }}
              className="min-h-12 shrink-0 rounded-full bg-pink px-5 text-base font-extrabold text-white disabled:opacity-40"
            >
              OK
            </button>
          </div>
          <p className="mt-3 text-sm text-mute">{profile.email}</p>
          <span className="mt-2 inline-block rounded-full bg-pink-soft px-3 py-1 text-xs font-extrabold uppercase text-pink-deep">
            {profile.role === "responsable" ? "Responsable" : "Caissier"}
          </span>
        </section>

        {profile.role === "responsable" && (
          <section className={card}>
            <h2 className={h2}>Mon équipe</h2>
            <p className="mb-3 text-sm text-mute">Vois les caissiers et assigne-leur une tâche.</p>
            <Link href="/equipe" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-pink text-base font-extrabold text-white shadow-pop">
              Ouvrir mon équipe
            </Link>
          </section>
        )}

        <section className={card}>
          <h2 className={h2}>Mes horaires</h2>
          <Link href="/planning" className="mb-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-pink text-base font-extrabold text-white shadow-pop">
            Mon planning (Jour / Soir / Repos)
          </Link>
          <p className="mb-2 text-sm font-semibold text-mute">Heure de relève entre l&apos;équipe jour et l&apos;équipe soir</p>
          <div className="grid grid-cols-2 gap-2">
            {HANDOVER_CHOICES.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={settings.handover === h}
                onClick={() => void updateState((s) => ({ ...s, settings: { ...s.settings, handover: h } }))}
                className={`min-h-12 rounded-2xl border-2 px-1 text-base font-bold ${settings.handover === h ? "border-pink bg-pink text-white" : "border-line bg-white"}`}
              >
                {formatMinutes(h)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-mute">Les tâches d&apos;exemple s&apos;adaptent à cette heure quand tu les ajoutes.</p>
        </section>

        <section className={card}>
          <h2 className={h2}>Mes rappels</h2>
          <p className="mb-2 text-sm font-semibold text-mute">Rappel par défaut des nouvelles tâches</p>
          <div className="grid grid-cols-3 gap-2">
            {REMINDERS.map((r: Reminder) => (
              <button
                key={r}
                type="button"
                aria-pressed={settings.defaultRemind === r}
                onClick={() => void updateState((s) => ({ ...s, settings: { ...s.settings, defaultRemind: r } }))}
                className={`min-h-12 rounded-2xl border-2 px-1 text-sm font-bold leading-tight ${settings.defaultRemind === r ? "border-pink bg-pink text-white" : "border-line bg-white"}`}
              >
                {reminderLabel(r)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold">Recevoir les rappels</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.notify}
              aria-label="Recevoir les rappels"
              onClick={() => void updateState((s) => ({ ...s, settings: { ...s.settings, notify: !s.settings.notify } }))}
              className={`relative h-9 w-16 shrink-0 rounded-full transition-colors ${settings.notify ? "bg-pink" : "bg-line"}`}
            >
              <span className={`absolute top-1 size-7 rounded-full bg-white shadow transition-all ${settings.notify ? "left-8" : "left-1"}`} />
            </button>
          </div>
        </section>

        <section className={card}>
          <h2 className={h2}>Notifications</h2>
          <NotifSettings />
        </section>

        <section className={card}>
          <h2 className={h2}>Aperçu</h2>
          {sample && <div className="mb-4 rounded-2xl bg-pink-soft p-3"><NotificationCard {...buildNotification(sample, "test")} /></div>}
          <TestNotification task={sample} />
        </section>

        <section className={card}>
          <h2 className={h2}>Le resto</h2>
          <p className="text-[15px] font-semibold">Hashtag Bangers</p>
          <p className="text-sm text-mute">75 Grande Rue, Roubaix · ouvert 11h – 2h</p>
          <button
            type="button"
            onClick={() => void updateState((s) => ({ ...s, tasks: [...s.tasks, ...sampleTasks(s.settings.handover)] }))}
            className="mt-4 min-h-12 w-full rounded-full border-2 border-ink/15 bg-white text-base font-bold"
          >
            Ajouter les tâches d&apos;exemple
          </button>
        </section>

        <button
          type="button"
          disabled={busyOut}
          onClick={async () => {
            setBusyOut(true);
            await signOut();
          }}
          className="min-h-14 w-full rounded-full border-2 border-pink bg-white text-lg font-extrabold text-pink-deep disabled:opacity-60"
        >
          {busyOut ? "Déconnexion…" : "Me déconnecter"}
        </button>
      </div>
    </>
  );
}
