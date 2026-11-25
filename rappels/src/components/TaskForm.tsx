"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DAY_LETTERS,
  DAY_LONG,
  DEFAULT_HANDOVER,
  TEAM_LABEL,
  dateKey,
  formatMinutes,
  formatServiceDate,
  formatTime,
  isAfterMidnight,
  isOutsideTeamRange,
  parseDateKey,
  reminderLabel,
  serviceDate,
  teamRange,
  weekdayIndex,
  type TeamPref,
} from "@/lib/service";
import { updateState, useAppState } from "@/lib/store";
import { assignTask } from "@/lib/team";
import { showToast } from "@/lib/toast";
import { CATEGORIES, CATEGORY_EMOJI, REMINDERS, type Category, type Reminder, type Task } from "@/lib/types";

// Heures proposées : de 10h (ouverture de caisse) à 01h55, la journée de service finit à 2h.
const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];
const TEAMS: TeamPref[] = ["jour", "soir", "both"];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const pad = (n: number) => String(n).padStart(2, "0");

const field = "w-full rounded-2xl border-2 border-line bg-white px-4 text-[17px] font-semibold min-h-12 focus:border-pink";
const label = "mb-2 block text-sm font-extrabold uppercase tracking-wide";

type AssignTo = { id: string; prenom: string };

/** Formulaire de tâche. Avec `assignTo`, le responsable crée la tâche pour un caissier précis. */
export function TaskForm({ initial, assignTo }: { initial?: Task; assignTo?: AssignTo }) {
  const router = useRouter();
  const app = useAppState();
  const editing = !!initial;
  // Une tâche assignée est ponctuelle par défaut : elle concerne le service en cours.
  const [presetDate] = useState(() => (assignTo ? dateKey(serviceDate(new Date())) : undefined));
  const taskDate = initial?.date ?? presetDate;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "Caisse");
  const [time, setTime] = useState(initial?.time ?? "11:00");
  const [days, setDays] = useState<number[]>(initial?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [remind, setRemind] = useState<Reminder>(initial?.remind ?? (assignTo ? 5 : (app?.settings.defaultRemind ?? 5)));
  const [team, setTeam] = useState<TeamPref>(initial?.team ?? "both");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");
  // Tâche ponctuelle : liée à un seul service.
  const [once, setOnce] = useState(!!taskDate);

  const [h = "11", m = "00"] = time.split(":");
  const handover = app?.settings.handover ?? DEFAULT_HANDOVER;
  const outside = isOutsideTeamRange(time, team, handover);
  const [rangeFrom, rangeTo] = teamRange(team, handover);
  // Une ancienne tâche peut avoir une heure hors des nouveaux horaires : on la garde sélectionnable.
  const hours = HOURS.includes(Number(h)) ? HOURS : [...HOURS, Number(h)];
  const night = isAfterMidnight(time);
  const sortedDays = [...days].sort((a, b) => a - b);

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Donne un nom à ta tâche.");
    if (!once && days.length === 0) return setError("Choisis au moins un jour.");
    const onceDate = once ? taskDate : undefined;
    const task: Task = {
      id: initial?.id ?? crypto.randomUUID(),
      title: title.trim(),
      category,
      time,
      days: onceDate ? [weekdayIndex(parseDateKey(onceDate))] : sortedDays,
      ...(onceDate ? { date: onceDate } : {}),
      team,
      remind,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    if (assignTo && app) {
      const ok = await assignTask(assignTo.id, app.profile.id, task);
      if (!ok) return setError("La tâche n'a pas pu être envoyée. Réessaie.");
      showToast("📌 Tâche envoyée", `${task.title} → ${assignTo.prenom}`);
      return router.push("/equipe");
    }
    updateState((s) => ({
      ...s,
      tasks: editing ? s.tasks.map((t) => (t.id === task.id ? { ...task, ...(t.assigned ? { assigned: true } : {}) } : t)) : [...s.tasks, task],
    }));
    router.push("/");
  }

  function remove() {
    if (!initial || !window.confirm(`Supprimer « ${initial.title} » ?`)) return;
    updateState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== initial.id) }));
    router.push("/");
  }

  return (
    <form onSubmit={save} className="space-y-6 pb-8">
      <header className="flex items-center gap-3">
        <Link href={assignTo ? "/equipe" : "/"} aria-label="Retour" className="flex size-12 items-center justify-center rounded-full bg-white shadow-card">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="h-street text-3xl">{assignTo ? `Pour ${assignTo.prenom}` : editing ? "Modifier" : "Nouvelle tâche"}</h1>
      </header>

      <div>
        <label htmlFor="title" className={label}>Titre</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Vérifier la friteuse"
          maxLength={60}
          className={field}
        />
      </div>

      <fieldset>
        <legend className={label}>Catégorie</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`min-h-11 rounded-full border-2 px-4 text-[15px] font-bold ${
                category === c ? "border-pink bg-pink text-white" : "border-line bg-white"
              }`}
            >
              {CATEGORY_EMOJI[c]} {c}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>Pour qui ?</legend>
        <div className="grid grid-cols-3 gap-2">
          {TEAMS.map((tm) => (
            <button
              key={tm}
              type="button"
              aria-pressed={team === tm}
              onClick={() => setTeam(tm)}
              className={`min-h-12 rounded-2xl border-2 px-1 text-sm font-bold leading-tight ${team === tm ? "border-pink bg-pink text-white" : "border-line bg-white"}`}
            >
              {tm === "jour" ? "☀️ " : tm === "soir" ? "🌙 " : ""}
              {TEAM_LABEL[tm]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={label}>Heure</legend>
        <div className="flex items-center gap-2">
          <select aria-label="Heure" value={Number(h)} onChange={(e) => setTime(`${pad(Number(e.target.value))}:${m}`)} className={field}>
            {hours.map((x) => (
              <option key={x} value={x}>{pad(x)} h</option>
            ))}
          </select>
          <span className="text-2xl font-extrabold">:</span>
          <select aria-label="Minutes" value={Number(m)} onChange={(e) => setTime(`${h}:${pad(Number(e.target.value))}`)} className={field}>
            {MINUTES.map((x) => (
              <option key={x} value={x}>{pad(x)}</option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-xs font-medium text-mute">Journée de service de 11h à 2h : après minuit, la tâche reste dans la journée de la veille.</p>
        {outside && (
          <p role="status" className="mt-3 rounded-2xl bg-pink-soft p-3 text-[13px] font-semibold leading-snug text-pink-deep">
            ⚠️ {formatTime(time)} est en dehors de la plage de « {TEAM_LABEL[team].toLowerCase()} » ({formatMinutes(rangeFrom)} → {formatMinutes(rangeTo % 1440)}). Tu peux enregistrer quand même.
          </p>
        )}
      </fieldset>

      {once && taskDate ? (
        <div className="rounded-3xl bg-pink-soft p-4">
          <p className="text-sm font-extrabold uppercase tracking-wide">Jour</p>
          <p className="mt-1 text-[15px] font-semibold">📌 Juste pour le service du {formatServiceDate(parseDateKey(taskDate))}</p>
          <button
            type="button"
            onClick={() => {
              setDays([weekdayIndex(parseDateKey(taskDate))]);
              setOnce(false);
            }}
            className="mt-3 min-h-11 rounded-full border-2 border-pink bg-white px-4 text-sm font-bold text-pink-deep"
          >
            Répéter chaque semaine
          </button>
        </div>
      ) : (
        <fieldset>
          <legend className={label}>Jours de service</legend>
          <div className="flex justify-between gap-1.5">
            {DAY_LETTERS.map((letter, d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                aria-label={DAY_LONG[d]}
                onClick={() => toggleDay(d)}
                className={`size-11 rounded-full border-2 text-base font-extrabold ${
                  days.includes(d) ? "border-pink bg-pink text-white" : "border-line bg-white text-mute"
                }`}
              >
                {letter}
              </button>
            ))}
          </div>
          {night && sortedDays.length > 0 && (
            <p className="mt-3 rounded-2xl bg-pink-soft p-3 text-[13px] font-semibold leading-snug text-pink-deep">
              🌙 {formatTime(time)} est après minuit : cocher « {DAY_LONG[sortedDays[0]!]} » = service du {DAY_LONG[sortedDays[0]!]} soir,
              le rappel sonnera dans la nuit de {DAY_LONG[sortedDays[0]!]} à {DAY_LONG[(sortedDays[0]! + 1) % 7]}.
            </p>
          )}
        </fieldset>
      )}

      <fieldset>
        <legend className={label}>Rappel</legend>
        <div className="grid grid-cols-3 gap-2">
          {REMINDERS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={remind === r}
              onClick={() => setRemind(r)}
              className={`min-h-12 rounded-2xl border-2 px-1 text-sm font-bold leading-tight ${
                remind === r ? "border-pink bg-pink text-white" : "border-line bg-white"
              }`}
            >
              🔔 {reminderLabel(r)}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="note" className={label}>Note <span className="font-medium normal-case text-mute">(optionnel)</span></label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={200}
          placeholder="Ex : ticket Z + comptage"
          className={`${field} py-3`}
        />
      </div>

      {error && <p role="alert" className="rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white">{error}</p>}

      <div className="space-y-3">
        <button type="submit" className="min-h-14 w-full rounded-full bg-pink text-lg font-extrabold text-white shadow-pop active:scale-[0.98]">
          {assignTo ? "Envoyer la tâche" : editing ? "Enregistrer" : "Ajouter la tâche"}
        </button>
        {editing && (
          <button type="button" onClick={remove} className="min-h-12 w-full rounded-full border-2 border-ink/15 bg-white text-base font-bold text-pink-deep">
            Supprimer cette tâche
          </button>
        )}
      </div>
    </form>
  );
}
