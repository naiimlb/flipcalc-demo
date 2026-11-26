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
  describeFrequency,
  formatMinutes,
  formatServiceDate,
  formatTime,
  isAfterMidnight,
  isOutsideTeamRange,
  parseDateKey,
  reminderLabel,
  serviceDate,
  teamRange,
  validateFrequency,
  weekdayIndex,
  type TeamPref,
} from "@/lib/service";
import { updateState, useAppState } from "@/lib/store";
import { assignTask } from "@/lib/team";
import { showToast } from "@/lib/toast";
import { CATEGORIES, CATEGORY_EMOJI, type Category, type Task } from "@/lib/types";

// Heures proposées : de 10h (ouverture de caisse) à 01h55, la journée de service finit à 2h.
const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const TEAMS: TeamPref[] = ["jour", "soir", "both"];
const EVERY = [15, 30, 45, 60];
const LEADS = [0, 5, 10, 15, 30, 60];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const pad = (n: number) => String(n).padStart(2, "0");

const field = "w-full rounded-2xl border-2 border-line bg-white px-4 text-[17px] font-semibold min-h-12 focus:border-pink";
const label = "mb-2 block text-sm font-extrabold uppercase tracking-wide";
const chip = (on: boolean) =>
  `min-h-11 rounded-full border-2 px-4 text-[15px] font-bold ${on ? "border-pink bg-pink text-white" : "border-line bg-white"}`;

/** Deux listes (heure / minutes) pour choisir une heure de la journée de service. */
function TimeSelect({ legend, value, onChange }: { legend: string; value: string; onChange: (v: string) => void }) {
  const [h = "11", m = "00"] = value.split(":");
  // Une ancienne tâche peut avoir une heure hors des nouveaux horaires : on la garde sélectionnable.
  const hours = HOURS.includes(Number(h)) ? HOURS : [...HOURS, Number(h)];
  return (
    <div className="flex items-center gap-2">
      <select aria-label={`${legend} : heure`} value={Number(h)} onChange={(e) => onChange(`${pad(Number(e.target.value))}:${m}`)} className={field}>
        {hours.map((x) => (
          <option key={x} value={x}>{pad(x)} h</option>
        ))}
      </select>
      <span className="text-2xl font-extrabold">:</span>
      <select aria-label={`${legend} : minutes`} value={Number(m)} onChange={(e) => onChange(`${h}:${pad(Number(e.target.value))}`)} className={field}>
        {MINUTES.map((x) => (
          <option key={x} value={x}>{pad(x)}</option>
        ))}
      </select>
    </div>
  );
}

type AssignTo = { id: string; prenom: string };

/** Formulaire de tâche libre. Avec `assignTo`, le responsable crée la tâche pour un caissier précis. */
export function TaskForm({ initial, assignTo }: { initial?: Task; assignTo?: AssignTo }) {
  const router = useRouter();
  const app = useAppState();
  const editing = !!initial;
  const [today] = useState(() => dateKey(serviceDate(new Date())));

  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "Autre");
  const [note, setNote] = useState(initial?.note ?? "");
  const [team, setTeam] = useState<TeamPref>(initial?.team ?? "both");
  // Programmation : une date précise, ou une répétition chaque semaine.
  const [mode, setMode] = useState<"date" | "repeat">(initial ? (initial.date ? "date" : "repeat") : assignTo ? "date" : "repeat");
  const [date, setDate] = useState(initial?.date ?? today);
  const [days, setDays] = useState<number[]>(initial?.days ?? ALL_DAYS);
  const [time, setTime] = useState(initial?.time ?? "12:00");
  // Fréquence des rappels.
  const [remind, setRemind] = useState(initial?.remind ?? (assignTo ? 5 : (app?.settings.defaultRemind ?? 5)));
  const [repeating, setRepeating] = useState(!!initial?.repeatEvery);
  const [every, setEvery] = useState(initial?.repeatEvery ?? 30);
  const [custom, setCustom] = useState(!!initial?.repeatEvery && !EVERY.includes(initial.repeatEvery));
  const [endTime, setEndTime] = useState(initial?.endTime ?? "18:00");
  const [untilDone, setUntilDone] = useState(initial?.untilDone ?? true);
  const [error, setError] = useState("");

  const handover = app?.settings.handover ?? DEFAULT_HANDOVER;
  const outside = isOutsideTeamRange(time, team, handover);
  const [rangeFrom, rangeTo] = teamRange(team, handover);
  const night = isAfterMidnight(time);
  const sortedDays = [...days].sort((a, b) => a - b);
  const leads = LEADS.includes(remind) ? LEADS : [...LEADS, remind].sort((a, b) => a - b);
  const nightDay = mode === "date" ? weekdayIndex(parseDateKey(date)) : sortedDays[0];

  // Tâche telle qu'elle serait enregistrée (sert aussi à l'aperçu des rappels).
  const draft: Task = {
    id: initial?.id ?? "nouvelle",
    title: title.trim(),
    category,
    time,
    days: mode === "date" ? [weekdayIndex(parseDateKey(date))] : sortedDays,
    ...(mode === "date" ? { date } : {}),
    team,
    remind,
    ...(repeating ? { repeatEvery: every, endTime } : {}),
    untilDone: repeating ? untilDone : true,
    paused: initial?.paused ?? false,
    ...(note.trim() ? { note: note.trim() } : {}),
  };
  const freqError = validateFrequency(draft);

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title) return setError("Donne un nom à ta tâche.");
    if (mode === "repeat" && days.length === 0) return setError("Choisis au moins un jour.");
    if (mode === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Choisis une date.");
    if (freqError) return setError(freqError);
    const task = draft.id === "nouvelle" ? { ...draft, id: crypto.randomUUID() } : draft;
    if (assignTo && app) {
      const ok = await assignTask(assignTo.id, app.profile.id, task);
      if (!ok) return setError("La tâche n'a pas pu être envoyée. Réessaie.");
      showToast("📌 Tâche envoyée", `${task.title} → ${assignTo.prenom}`);
      return router.push("/equipe");
    }
    void updateState((s) => ({
      ...s,
      tasks: editing ? s.tasks.map((t) => (t.id === task.id ? { ...task, ...(t.assigned ? { assigned: true } : {}), ...(t.ownerId ? { ownerId: t.ownerId } : {}), ...(t.shareMode ? { shareMode: t.shareMode } : {}) } : t)) : [...s.tasks, task],
    }));
    router.push("/");
  }

  function remove() {
    if (!initial || !window.confirm(`Supprimer « ${initial.title} » ?`)) return;
    void updateState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== initial.id) }));
    router.push("/");
  }

  function duplicate() {
    if (!initial) return;
    const copy: Task = { ...initial, id: crypto.randomUUID(), title: `${initial.title} (copie)`.slice(0, 60), assigned: undefined, shareMode: undefined };
    void updateState((s) => ({ ...s, tasks: [...s.tasks, copy] }));
    showToast("📄 Tâche dupliquée", "Tu peux maintenant modifier la copie.");
    router.push(`/tache/${copy.id}`);
  }

  function togglePause() {
    if (!initial) return;
    void updateState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === initial.id ? { ...t, paused: !t.paused } : t)) }));
    router.push("/");
  }

  return (
    <form onSubmit={save} noValidate className="space-y-6 pb-8">
      <header className="flex items-center gap-3">
        <Link href={assignTo ? "/equipe" : "/"} aria-label="Retour" className="flex size-12 items-center justify-center rounded-full bg-white shadow-card">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="h-street text-3xl">{assignTo ? `Pour ${assignTo.prenom}` : editing ? "Modifier" : "Nouvelle tâche"}</h1>
      </header>

      {initial?.paused && (
        <p className="rounded-2xl bg-pink-soft p-3 text-sm font-bold text-pink-deep">⏸️ Cette tâche est en pause : elle n&apos;apparaît plus et ne sonne plus.</p>
      )}

      <div>
        <label htmlFor="title" className={label}>Titre</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ce que tu veux : « Sortir les poubelles »…" maxLength={60} className={field} />
      </div>

      <fieldset>
        <legend className={label}>Catégorie <span className="font-medium normal-case text-mute">(optionnel)</span></legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={category === "Autre"} onClick={() => setCategory("Autre")} className={chip(category === "Autre")}>Aucune</button>
          {CATEGORIES.filter((c) => c !== "Autre").map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chip(category === c)}>
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
        <legend className={label}>Quand ?</legend>
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={mode === "date"} onClick={() => setMode("date")} className={`min-h-12 rounded-2xl border-2 text-[15px] font-bold ${mode === "date" ? "border-pink bg-pink text-white" : "border-line bg-white"}`}>
            📅 Une seule date
          </button>
          <button type="button" aria-pressed={mode === "repeat"} onClick={() => setMode("repeat")} className={`min-h-12 rounded-2xl border-2 text-[15px] font-bold ${mode === "repeat" ? "border-pink bg-pink text-white" : "border-line bg-white"}`}>
            🔁 Répéter
          </button>
        </div>

        {mode === "date" ? (
          <div>
            <input type="date" aria-label="Date de la journée de service" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            {/^\d{4}-\d{2}-\d{2}$/.test(date) && <p className="mt-2 text-xs font-medium text-mute">Journée de service du {formatServiceDate(parseDateKey(date))}.</p>}
          </div>
        ) : (
          <div>
            <div className="flex justify-between gap-1.5" role="group" aria-label="Jours de répétition">
              {DAY_LETTERS.map((letter, d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days.includes(d)}
                  aria-label={DAY_LONG[d]}
                  onClick={() => toggleDay(d)}
                  className={`size-11 rounded-full border-2 text-base font-extrabold ${days.includes(d) ? "border-pink bg-pink text-white" : "border-line bg-white text-mute"}`}
                >
                  {letter}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setDays(days.length === 7 ? [] : ALL_DAYS)} className="mt-2 min-h-11 rounded-full px-3 text-sm font-bold text-pink-deep underline">
              {days.length === 7 ? "Décocher tous les jours" : "Tous les jours"}
            </button>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className={label}>Heure de début</legend>
        <TimeSelect legend="Heure de début" value={time} onChange={setTime} />
        <p className="mt-2 text-xs font-medium text-mute">Journée de service de 11h à 2h : après minuit, la tâche reste dans la journée de la veille.</p>
        {night && nightDay !== undefined && (
          <p className="mt-3 rounded-2xl bg-pink-soft p-3 text-[13px] font-semibold leading-snug text-pink-deep">
            🌙 {formatTime(time)} est après minuit : pour la journée du {DAY_LONG[nightDay]}, le rappel sonnera dans la nuit du {DAY_LONG[nightDay]} au {DAY_LONG[(nightDay + 1) % 7]}.
          </p>
        )}
        {outside && (
          <p role="status" className="mt-3 rounded-2xl bg-pink-soft p-3 text-[13px] font-semibold leading-snug text-pink-deep">
            ⚠️ {formatTime(time)} est en dehors de la plage de « {TEAM_LABEL[team].toLowerCase()} » ({formatMinutes(rangeFrom)} → {formatMinutes(rangeTo)}). Tu peux enregistrer quand même.
          </p>
        )}
      </fieldset>

      <section className="space-y-4 rounded-3xl bg-white p-4 shadow-card" aria-label="Notifications">
        <h2 className="h-street text-xl">🔔 Notifications</h2>

        <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Fréquence">
          <button type="button" role="radio" aria-checked={!repeating} onClick={() => setRepeating(false)} className={`min-h-12 rounded-2xl border-2 px-4 text-left text-[15px] font-bold ${!repeating ? "border-pink bg-pink text-white" : "border-line bg-white"}`}>
            Une seule fois à l&apos;heure prévue
          </button>
          <button type="button" role="radio" aria-checked={repeating} onClick={() => setRepeating(true)} className={`min-h-12 rounded-2xl border-2 px-4 text-left text-[15px] font-bold ${repeating ? "border-pink bg-pink text-white" : "border-line bg-white"}`}>
            Répéter le rappel
          </button>
        </div>

        {repeating && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-bold text-mute">Toutes les…</p>
              <div className="flex flex-wrap gap-2">
                {EVERY.map((m) => (
                  <button key={m} type="button" aria-pressed={!custom && every === m} onClick={() => (setCustom(false), setEvery(m))} className={chip(!custom && every === m)}>
                    {m} min
                  </button>
                ))}
                <button type="button" aria-pressed={custom} onClick={() => setCustom(true)} className={chip(custom)}>Personnalisée</button>
              </div>
              {custom && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label="Nombre de minutes entre deux rappels"
                    value={every || ""}
                    onChange={(e) => setEvery(parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
                    placeholder="20"
                    className="h-12 w-24 rounded-2xl border-2 border-line bg-white text-center text-[17px] font-extrabold focus:border-pink"
                  />
                  <span className="font-semibold">minutes (5 à 720)</span>
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-mute">Jusqu&apos;à (fin de la fenêtre)</p>
              <TimeSelect legend="Heure de fin" value={endTime} onChange={setEndTime} />
            </div>

            <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-pink-soft px-4 py-2 text-[15px] font-bold">
              <input type="checkbox" checked={untilDone} onChange={(e) => setUntilDone(e.target.checked)} className="size-6 accent-[#ff1f6e]" />
              Répéter jusqu&apos;à ce que je coche la tâche
            </label>
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-bold text-mute">Premier rappel</p>
          <div className="flex flex-wrap gap-2">
            {leads.map((m) => (
              <button key={m} type="button" aria-pressed={remind === m} onClick={() => setRemind(m)} className={chip(remind === m)}>
                {reminderLabel(m)}
              </button>
            ))}
          </div>
        </div>

        <p role="status" className={`rounded-2xl p-3 text-[14px] font-semibold leading-snug ${freqError ? "bg-ink text-white" : "bg-pink-soft text-pink-deep"}`}>
          {freqError ?? describeFrequency(draft)}
        </p>
      </section>

      <div>
        <label htmlFor="note" className={label}>Note <span className="font-medium normal-case text-mute">(optionnel)</span></label>
        <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={200} placeholder="Ex : ticket Z + comptage" className={`${field} py-3`} />
      </div>

      {error && <p role="alert" className="rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white">{error}</p>}

      <div className="space-y-3">
        <button type="submit" className="min-h-14 w-full rounded-full bg-pink text-lg font-extrabold text-white shadow-pop active:scale-[0.98]">
          {assignTo ? "Envoyer la tâche" : editing ? "Enregistrer" : "Ajouter la tâche"}
        </button>
        {editing && !assignTo && (
          <Link href={`/partager/${initial?.id}`} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border-2 border-pink bg-white text-base font-extrabold text-pink-deep">
            👥 {initial?.shareMode ? "Gérer le partage" : "Partager avec des collègues"}
          </Link>
        )}
        {editing && !assignTo && (
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={duplicate} className="min-h-12 rounded-full border-2 border-ink/15 bg-white text-base font-bold">📄 Dupliquer</button>
            <button type="button" onClick={togglePause} className="min-h-12 rounded-full border-2 border-ink/15 bg-white text-base font-bold">
              {initial?.paused ? "▶️ Reprendre" : "⏸️ Pause"}
            </button>
          </div>
        )}
        {editing && !assignTo && (
          <button type="button" onClick={remove} className="min-h-12 w-full rounded-full border-2 border-ink/15 bg-white text-base font-bold text-pink-deep">
            Supprimer cette tâche
          </button>
        )}
      </div>
    </form>
  );
}
