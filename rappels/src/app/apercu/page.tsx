"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { NotificationCard } from "@/components/NotificationCard";
import { Skeleton } from "@/components/Skeleton";
import { TestNotification } from "@/components/TestNotification";
import { buildNotification } from "@/lib/notify";
import { formatServiceDate, formatTime, reminderAt, serviceDate, visiblePlan } from "@/lib/service";
import { useAppState, useNowMs } from "@/lib/store";

export default function PreviewPage() {
  const state = useAppState();
  const nowMs = useNowMs();
  const [chosen, setChosen] = useState<string | null>(null);
  if (!state || nowMs === null) return <Skeleton />;

  const sDate = serviceDate(new Date(nowMs));
  const plan = visiblePlan(state.tasks, sDate, state.settings.schedule);
  // Par défaut : la prochaine tâche à venir, sinon la première du service.
  const next = plan.find((p) => reminderAt(p).getTime() >= nowMs) ?? plan[0];
  const task = state.tasks.find((t) => t.id === chosen) ?? next?.task ?? state.tasks[0];

  const content = task ? buildNotification(task, formatServiceDate(sDate)) : null;
  const when = task ? formatTime(task.time).replace("h", ":") : "";

  return (
    <>
      <Header title="Aperçu notif" />
      <p className="-mt-2 mb-4 text-sm font-medium text-mute">
        Voilà ce que tu recevras sur ton iPhone. Choisis une tâche pour voir son rappel.
      </p>

      <label htmlFor="task" className="mb-2 block text-sm font-extrabold uppercase tracking-wide">Tâche</label>
      <select
        id="task"
        value={task?.id ?? ""}
        onChange={(e) => setChosen(e.target.value)}
        className="mb-6 min-h-12 w-full rounded-2xl border-2 border-line bg-white px-4 text-[17px] font-semibold focus:border-pink"
      >
        {state.tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {formatTime(t.time)} · {t.title}
          </option>
        ))}
      </select>

      {/* Faux écran verrouillé */}
      <div className="mb-6 overflow-hidden rounded-[2.2rem] bg-gradient-to-b from-[#2b0a1a] via-[#6b1040] to-pink p-5 shadow-card">
        <p className="mt-4 text-center text-sm font-semibold text-white/80">Écran verrouillé</p>
        <p className="text-center text-7xl font-light tabular-nums text-white">{when || "11:00"}</p>
        <div className="mt-8 mb-6">
          {content ? (
            <NotificationCard title={content.title} body={content.body} />
          ) : (
            <p className="text-center text-white">Aucune tâche pour l&apos;instant.</p>
          )}
        </div>
      </div>

      <TestNotification task={task} />
    </>
  );
}
