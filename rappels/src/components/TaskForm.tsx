"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DAY_LETTERS, DAY_LONG, formatTime, isAfterMidnight, reminderLabel } from "@/lib/service";
import { updateState } from "@/lib/store";
import { CATEGORIES, CATEGORY_EMOJI, REMINDERS, type Category, type Reminder, type Task } from "@/lib/types";

// Heures proposées : le service va de 19h à 3h.
const HOURS = [19, 20, 21, 22, 23, 0, 1, 2];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const pad = (n: number) => String(n).padStart(2, "0");

const field = "w-full rounded-2xl border-2 border-line bg-white px-4 text-[17px] font-semibold min-h-12 focus:border-pink";
const label = "mb-2 block text-sm font-extrabold uppercase tracking-wide";

export function TaskForm({ initial }: { initial?: Task }) {
  const router = useRouter();
  const editing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "Caisse");
  const [time, setTime] = useState(initial?.time ?? "19:00");
  const [days, setDays] = useState<number[]>(initial?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [remind, setRemind] = useState<Reminder>(initial?.remind ?? 5);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState("");

  const [h = "19", m = "00"] = time.split(":");
  const night = isAfterMidnight(time);
  const sortedDays = [...days].sort((a, b) => a - b);

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Donne un nom à ta tâche.");
    if (days.length === 0) return setError("Choisis au moins un jour.");
    const task: Task = {
      id: initial?.id ?? `t-${Date.now().toString(36)}`,
      title: title.trim(),
      category,
      time,
      days: sortedDays,
      remind,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    updateState((s) => ({
      ...s,
      tasks: editing ? s.tasks.map((t) => (t.id === task.id ? task : t)) : [...s.tasks, task],
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
        <Link href="/" aria-label="Retour" className="flex size-12 items-center justify-center rounded-full bg-white shadow-card">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="h-street text-3xl">{editing ? "Modifier" : "Nouvelle tâche"}</h1>
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
        <legend className={label}>Heure</legend>
        <div className="flex items-center gap-2">
          <select aria-label="Heure" value={Number(h)} onChange={(e) => setTime(`${pad(Number(e.target.value))}:${m}`)} className={field}>
            {HOURS.map((x) => (
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
        <p className="mt-2 text-xs font-medium text-mute">Service de 19h à 3h : après minuit, la tâche reste dans le service de la veille.</p>
      </fieldset>

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
          {editing ? "Enregistrer" : "Ajouter la tâche"}
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
