import Link from "next/link";
import { formatDuration, formatTime, frequencyLabel, type PlannedTask } from "@/lib/service";
import { CATEGORY_EMOJI } from "@/lib/types";
import { ShareBadge } from "./ShareBadge";

type Props = {
  planned: PlannedTask;
  done: boolean;
  /** Retard en ms (> 0) si la tâche est en retard. */
  lateBy: number;
  onToggle: () => void;
  /** Mode « un seul s'en occupe » : prénom du collègue qui a pris la tâche (elle est alors grisée, sans rappel). */
  takenBy?: string;
};

export function TaskRow({ planned: { task, afterMidnight, key }, done, lateBy, onToggle, takenBy }: Props) {
  const late = !done && !takenBy && lateBy > 0;
  const date = key.split("@")[1] ?? "";
  return (
    <li
      className={`flex items-stretch gap-3 rounded-3xl p-3 shadow-card transition-colors ${
        takenBy ? "bg-white/60 opacity-70" : late ? "bg-pink text-white" : done ? "bg-white/70" : "bg-white"
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? "Décocher" : "Cocher"} : ${task.title}`}
        onClick={onToggle}
        className="flex size-14 shrink-0 items-center justify-center self-center rounded-2xl"
      >
        <span
          className={`flex size-9 items-center justify-center rounded-xl border-[3px] ${
            done ? "border-pink bg-pink text-white" : late ? "border-white bg-white/20" : "border-ink/80 bg-white"
          }`}
        >
          {done && (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </span>
      </button>

      <Link href={`/taches/${task.id}?j=${date}`} className="min-w-0 flex-1 py-1" aria-label={`Ouvrir : ${task.title}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-xl font-extrabold tabular-nums ${late ? "text-white" : done ? "text-mute" : "text-pink-deep"}`}>
            {formatTime(task.time)}
          </span>
          {afterMidnight && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${late ? "bg-white/25" : "bg-ink text-white"}`}>🌙 nuit</span>
          )}
          <ShareBadge task={task} light={late} />
          {takenBy && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">🙌 {takenBy} s&apos;en occupe</span>}
          {task.assigned && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${late ? "bg-white/25" : "bg-pink-soft text-pink-deep"}`}>📌 Assignée</span>
          )}
          {late && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold uppercase text-pink-deep">En retard · {formatDuration(lateBy)}</span>}
        </div>
        <p className={`text-[17px] font-bold leading-snug ${done ? "text-mute line-through decoration-2" : ""}`}>{task.title}</p>
        <p className={`mt-0.5 text-[13px] font-medium ${late ? "text-white/90" : "text-mute"}`}>
          {CATEGORY_EMOJI[task.category]} {task.category} · 🔔 {frequencyLabel(task)}
        </p>
        {task.note && !done && <p className={`mt-1 text-[13px] leading-snug ${late ? "text-white/90" : "text-ink/70"}`}>{task.note}</p>}
      </Link>
    </li>
  );
}
