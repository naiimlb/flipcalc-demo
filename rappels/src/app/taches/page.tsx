"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { ShareBadge } from "@/components/ShareBadge";
import { Skeleton } from "@/components/Skeleton";
import { respondShare } from "@/lib/sharing";
import { refreshStore } from "@/lib/store";
import { DAY_SHORT, formatTime, frequencyLabel, TEAM_LABEL } from "@/lib/service";
import { updateState, useAppState } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { CATEGORY_EMOJI, isMine, type Task } from "@/lib/types";

function whenLabel(t: Task): string {
  if (t.date) return `le ${t.date.split("-").reverse().join("/")}`;
  if (t.days.length === 7) return "tous les jours";
  return t.days.map((d) => DAY_SHORT[d]).join(" ");
}

/** Toutes mes tâches : modifier, dupliquer, mettre en pause, supprimer (y compris les tâches d'exemple). */
export default function TasksPage() {
  const state = useAppState();
  const router = useRouter();
  if (!state) return <Skeleton />;

  const sorted = [...state.tasks].sort((a, b) => Number(a.shareStatus === "declined") - Number(b.shareStatus === "declined") || Number(a.paused) - Number(b.paused) || a.time.localeCompare(b.time) || a.title.localeCompare(b.title, "fr"));

  const togglePause = (id: string) =>
    void updateState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, paused: !t.paused } : t)) }));

  const duplicate = (t: Task) => {
    const copy: Task = { ...t, id: crypto.randomUUID(), title: `${t.title} (copie)`.slice(0, 60), assigned: undefined, shareMode: undefined };
    void updateState((s) => ({ ...s, tasks: [...s.tasks, copy] }));
    showToast("📄 Tâche dupliquée", "Tu peux maintenant modifier la copie.");
    router.push(`/tache/${copy.id}`);
  };

  const remove = (t: Task) => {
    if (window.confirm(`Supprimer « ${t.title} » ?`)) void updateState((s) => ({ ...s, tasks: s.tasks.filter((x) => x.id !== t.id) }));
  };

  const uid = state.profile.id;
  const answer = async (t: Task, accept: boolean) => {
    try {
      await respondShare(t.id, accept);
      await refreshStore(true);
      showToast(accept ? "✅ Tâche reprise" : "🙈 Tâche masquée", accept ? "Elle est dans ton planning." : "Tu peux la reprendre ici quand tu veux.");
    } catch {
      showToast("⚠️ Pas enregistré", "Vérifie ta connexion et réessaie.");
    }
  };

  const small = "min-h-11 rounded-full border-2 border-line bg-white px-3 text-sm font-bold";

  return (
    <>
      <Header title="Mes tâches" />
      {sorted.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-card">
          <p className="text-lg font-extrabold">Aucune tâche</p>
          <p className="mt-1 text-sm text-mute">Touche + pour créer ce que tu veux.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((t) => (
            <li key={t.id} className={`rounded-3xl bg-white p-4 shadow-card ${t.paused ? "opacity-70" : ""}`}>
              <Link href={isMine(t, uid) ? `/tache/${t.id}` : `/taches/${t.id}`} className="block">
                <p className="flex flex-wrap items-center gap-2">
                  <ShareBadge task={t} />
                  {t.shareStatus === "pending" && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">⏳ À accepter</span>}
                  {t.shareStatus === "declined" && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">🙈 Masquée</span>}
                  <span className="text-lg font-extrabold tabular-nums text-pink-deep">{formatTime(t.time)}</span>
                  {t.paused && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">⏸️ En pause</span>}
                  {t.assigned && <span className="rounded-full bg-pink-soft px-2 py-0.5 text-[11px] font-bold text-pink-deep">📌 Assignée</span>}
                </p>
                <p className="text-[17px] font-bold leading-snug">{t.title}</p>
                <p className="mt-0.5 text-[13px] font-medium text-mute">
                  {CATEGORY_EMOJI[t.category]} {whenLabel(t)} · {TEAM_LABEL[t.team]} · 🔔 {frequencyLabel(t)}
                </p>
              </Link>
              {isMine(t, uid) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/tache/${t.id}`} className={`${small} inline-flex items-center`}>✏️ Modifier</Link>
                  <Link href={`/partager/${t.id}`} className={`${small} inline-flex items-center`}>👥 Partager</Link>
                  <button type="button" onClick={() => duplicate(t)} className={small}>📄 Dupliquer</button>
                  <button type="button" onClick={() => togglePause(t.id)} className={small}>{t.paused ? "▶️ Reprendre" : "⏸️ Pause"}</button>
                  <button type="button" onClick={() => remove(t)} className={`${small} text-pink-deep`}>🗑️ Supprimer</button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/taches/${t.id}`} className={`${small} inline-flex items-center`}>👀 Ouvrir</Link>
                  {t.shareStatus === "pending" && <button type="button" onClick={() => answer(t, true)} className={`${small} border-pink text-pink-deep`}>Accepter</button>}
                  {t.shareStatus === "accepted" && <button type="button" onClick={() => answer(t, false)} className={small}>🙈 Masquer</button>}
                  {t.shareStatus !== "accepted" && t.shareStatus !== "pending" && <button type="button" onClick={() => answer(t, true)} className={small}>↩️ Reprendre</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Link href="/tache/nouvelle" aria-label="Ajouter une tâche" className="fixed bottom-24 right-4 z-20 flex size-14 items-center justify-center rounded-full bg-pink text-white shadow-pop active:scale-95">
        <span aria-hidden className="text-4xl font-light leading-none">+</span>
      </Link>
    </>
  );
}
