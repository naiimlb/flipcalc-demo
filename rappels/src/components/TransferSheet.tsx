"use client";

import { useEffect, useState } from "react";
import { dateKey, formatMinutes, nextShift, parseDateKey, teamStartExt, type PlannedTask, type Team } from "@/lib/service";
import type { Colleague } from "@/lib/sharing";
import { refreshStore, useAppState } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { nextTeamMembers, sendTransfer } from "@/lib/transfers";

/**
 * « Transmettre au prochain caissier » : choisir un collègue de la prochaine équipe (Jour → équipe Soir du même jour,
 * Soir → équipe Jour du lendemain à 11h) ou « Toute la prochaine équipe », avec un petit message.
 */
export function TransferSheet({ tasks, date, team, onClose }: { tasks: PlannedTask[]; date: string; team: Team; onClose: () => void }) {
  const state = useAppState();
  const next = nextShift(team, parseDateKey(date));
  const targetDate = dateKey(next.date);
  const [members, setMembers] = useState<Colleague[] | null>(null);
  const [choice, setChoice] = useState<string>("team"); // "team" ou l'id d'un collègue
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    nextTeamMembers(targetDate, next.team).then(
      (m) => !off && setMembers(m),
      () => !off && (setMembers([]), setError("Impossible de charger la prochaine équipe. Vérifie ta connexion.")),
    );
    return () => {
      off = true;
    };
  }, [targetDate, next.team]);

  const when = next.team === "soir" ? `ce soir, dès ${formatMinutes(teamStartExt("soir", state?.settings.handover ?? 1110))}` : "demain, dès 11h00";
  const label = next.team === "soir" ? "l'équipe Soir" : "l'équipe Jour";

  async function send() {
    setBusy(true);
    setError("");
    let ok = 0;
    let lastError = "";
    for (const p of tasks) {
      const r = await sendTransfer(p.task.id, date, choice === "team" ? [] : [choice], targetDate, next.team, message);
      if (r.ok) ok++;
      else lastError = r.error;
    }
    await refreshStore(true);
    setBusy(false);
    if (ok === 0) {
      setError(
        /personne dans la prochaine/i.test(lastError)
          ? `Personne n'est prévu dans ${label} d'après les plannings. Choisis un collègue précis, ou laisse tomber.`
          : /déjà transmise/i.test(lastError)
            ? "Cette tâche est déjà transmise."
            : "La transmission n'a pas été envoyée. Réessaie.",
      );
      return;
    }
    showToast("📤 Transmise", ok > 1 ? `${ok} tâches envoyées à ${label}. Tu seras prévenu s'il y a un refus.` : `Envoyée à ${label}. Tu seras prévenu s'il y a un refus.`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/50" role="dialog" aria-modal="true" aria-label="Transmettre à la prochaine équipe" onClick={onClose}>
      <div className="mx-auto max-h-[90dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-8 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <p className="h-street text-2xl">Transmettre</p>
        <p className="mt-1 text-[15px] font-bold leading-snug">{tasks.length > 1 ? `${tasks.length} tâches` : tasks[0]?.task.title}</p>
        <p className="mt-0.5 text-[13px] text-mute">À {label}, {when}.</p>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide">À qui ?</legend>
          <div className="space-y-2">
            <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 ${choice === "team" ? "border-pink bg-pink-soft" : "border-line bg-white"}`}>
              <input type="radio" name="to" checked={choice === "team"} onChange={() => setChoice("team")} className="size-5 accent-[#ff1f6e]" />
              <span className="text-[17px] font-bold">Toute la prochaine équipe</span>
            </label>
            {members === null && <p className="text-sm text-mute">Chargement…</p>}
            {members?.map((m) => (
              <label key={m.id} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 ${choice === m.id ? "border-pink bg-pink-soft" : "border-line bg-white"}`}>
                <input type="radio" name="to" checked={choice === m.id} onChange={() => setChoice(m.id)} className="size-5 accent-[#ff1f6e]" />
                <span className="text-[17px] font-bold">{m.prenom}</span>
              </label>
            ))}
            {members?.length === 0 && !error && <p className="rounded-2xl bg-pink-soft p-3 text-sm font-semibold text-pink-deep">Personne n&apos;a {label} dans son planning ce jour-là.</p>}
          </div>
        </fieldset>

        <label className="mt-4 block text-sm font-extrabold uppercase tracking-wide" htmlFor="transfer-msg">Message <span className="font-medium normal-case text-mute">(facultatif)</span></label>
        <input id="transfer-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={140} placeholder="Ex : il manque de la monnaie" className="mt-2 h-12 w-full rounded-2xl border-2 border-line bg-white px-3 text-[17px] font-semibold focus:border-pink" />

        {error && <p role="alert" className="mt-4 rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="min-h-12 rounded-full border-2 border-line bg-white font-bold">Annuler</button>
          <button type="button" disabled={busy || members === null} onClick={send} className="min-h-12 rounded-full bg-pink font-extrabold text-white shadow-pop disabled:opacity-50">{busy ? "Envoi…" : "Transmettre"}</button>
        </div>
      </div>
    </div>
  );
}
