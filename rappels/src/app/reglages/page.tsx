"use client";

import { Header } from "@/components/Header";
import { NotifSettings } from "@/components/NotifSettings";
import { NotificationCard } from "@/components/NotificationCard";
import { Skeleton } from "@/components/Skeleton";
import { TestNotification } from "@/components/TestNotification";
import { buildNotification } from "@/lib/notify";
import { resetToSamples, updateState, useAppState } from "@/lib/store";

const card = "rounded-3xl bg-white p-4 shadow-card";
const h2 = "h-street mb-3 text-xl";

export default function SettingsPage() {
  const state = useAppState();
  if (!state) return <Skeleton />;
  const sample = state.tasks[0];

  return (
    <>
      <Header title="Réglages" />
      <div className="space-y-4">
        <section className={card}>
          <h2 className={h2}>Mon poste</h2>
          <label htmlFor="role" className="mb-2 block text-sm font-semibold text-mute">Nom du poste</label>
          <input
            id="role"
            value={state.role}
            maxLength={24}
            onChange={(e) => updateState((s) => ({ ...s, role: e.target.value }))}
            className="min-h-12 w-full rounded-2xl border-2 border-line bg-white px-4 text-[17px] font-semibold focus:border-pink"
          />
        </section>

        <section className={card}>
          <h2 className={h2}>Assistant caisse</h2>
          <label htmlFor="tva" className="mb-2 block text-sm font-semibold text-mute">Taux de TVA par défaut pour les calculs</label>
          <select
            id="tva"
            value={state.tva}
            onChange={(e) => updateState((s) => ({ ...s, tva: Number(e.target.value) }))}
            className="min-h-12 w-full rounded-2xl border-2 border-line bg-white px-4 text-[17px] font-semibold focus:border-pink"
          >
            {[...new Set([5.5, 10, 20, state.tva])].sort((a, b) => a - b).map((r) => (
              <option key={r} value={r}>{String(r).replace(".", ",")} %</option>
            ))}
          </select>
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
          <p className="text-sm text-mute">75 Grande Rue, Roubaix · ouvert 19h – 3h</p>
          <button
            type="button"
            onClick={() => window.confirm("Remettre les 6 tâches d'exemple ? Tes tâches actuelles seront effacées.") && resetToSamples()}
            className="mt-4 min-h-12 w-full rounded-full border-2 border-ink/15 bg-white text-base font-bold"
          >
            Remettre les tâches d&apos;exemple
          </button>
        </section>
      </div>
    </>
  );
}
