"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/Skeleton";
import { TransferSheet } from "@/components/TransferSheet";
import { pendingTasks, type BilanInput } from "@/lib/bilan";
import { dateKey, formatServiceDate, formatTime, myTeam, nextShift, parseDateKey, serviceDate, TEAM_LABEL, type PlannedTask, type Team } from "@/lib/service";
import { refreshStore, useAppState } from "@/lib/store";
import { abandonTask } from "@/lib/task-actions";
import { showToast } from "@/lib/toast";
import { acceptedTransferKeys, openBilan } from "@/lib/transfers";
import { CATEGORY_EMOJI, OCC_LABEL, type OccStatus } from "@/lib/types";

const btn = "min-h-12 rounded-full px-4 text-[15px] font-extrabold disabled:opacity-50";

function Bilan() {
  const state = useAppState();
  const params = useSearchParams();
  const [sheet, setSheet] = useState<PlannedTask[] | null>(null);
  const [busy, setBusy] = useState(false);
  const opened = useRef<string | null>(null);

  const asked = params.get("j");
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : dateKey(serviceDate(new Date()));

  // Ouvrir le bilan : pas de second rappel.
  useEffect(() => {
    if (!state || opened.current === date) return;
    opened.current = date;
    void openBilan(date);
  }, [state, date]);

  if (!state) return <Skeleton />;
  const uid = state.profile.id;
  const sDate = parseDateKey(date);
  const e = params.get("e");
  const team: Team = e === "jour" || e === "soir" ? e : (myTeam(state.settings.schedule, sDate) ?? "soir");

  const input: BilanInput = {
    tasks: state.tasks,
    uid,
    handover: state.settings.handover,
    transferIn: acceptedTransferKeys(state.transfers, uid),
    isDone: (k) => !!state.done[k],
    holder: (k) => state.claims[k]?.userId,
    outcome: (k) => state.outcomes[k]?.status,
  };
  const pending = pendingTasks(input, sDate, team);
  const next = nextShift(team, sDate);
  const nextLabel = next.team === "soir" ? "l'équipe Soir" : "l'équipe Jour";

  // Déjà traitées : tâches transmises, refusées, abandonnées ce jour-là.
  const treated = Object.entries(state.outcomes)
    .filter(([k]) => k.endsWith(`@${date}`))
    .map(([k, o]) => ({ key: k, task: state.tasks.find((t) => t.id === k.split("@")[0]), status: o.status as OccStatus, reason: o.reason }))
    .filter((x) => x.task);
  const transferInfo = (taskId: string) => {
    const rows = state.transfers.filter((t) => t.fromUser === uid && t.taskId === taskId && t.serviceDate === date);
    if (rows.length === 0) return "";
    const acc = rows.find((r) => r.status === "accepted");
    if (acc) return `acceptée par ${acc.toPrenom}`;
    return rows[0]!.wholeTeam ? "en attente (toute l'équipe)" : `en attente de ${rows[0]!.toPrenom}`;
  };

  async function dropAll(list: PlannedTask[], what: string) {
    if (!window.confirm(`${what} ? Elles restent dans l'historique comme « abandonnées ».`)) return;
    setBusy(true);
    let ok = 0;
    for (const p of list) if (await abandonTask(p.task, date)) ok++;
    await refreshStore(true);
    setBusy(false);
    if (ok) showToast("🗑️ Abandonnées", `${ok} tâche${ok > 1 ? "s" : ""} laissée${ok > 1 ? "s" : ""} tomber. Tout est dans l'historique.`);
  }

  async function dropOne(p: PlannedTask) {
    if (!window.confirm(`Laisser tomber « ${p.task.title} » ? Elle reste dans l'historique comme « abandonnée ».`)) return;
    setBusy(true);
    if (await abandonTask(p.task, date)) {
      await refreshStore(true);
      showToast("🗑️ Abandonnée", "Elle reste dans l'historique.");
    }
    setBusy(false);
  }

  return (
    <>
      <Header title="Bilan du service" />
      <p className="-mt-3 mb-4 text-sm font-bold text-mute">
        {TEAM_LABEL[team]} · journée du {formatServiceDate(sDate)}
      </p>

      {pending.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-card">
          <p className="text-lg font-extrabold">Tout est fait 🔥</p>
          <p className="mt-1 text-sm text-mute">Aucune tâche non faite pour ton équipe.</p>
        </div>
      ) : (
        <>
          <section className="mb-4 rounded-3xl bg-white p-4 shadow-card" aria-label="Actions groupées">
            <p className="h-street text-3xl">
              <span className="text-pink">{pending.length}</span> non faite{pending.length > 1 ? "s" : ""}
            </p>
            <div className="mt-3 space-y-2">
              <button type="button" disabled={busy} onClick={() => setSheet(pending)} className={`${btn} w-full bg-pink text-white shadow-pop`}>📤 Tout transmettre à la prochaine équipe</button>
              <button type="button" disabled={busy} onClick={() => dropAll(pending, `Laisser tomber les ${pending.length} tâches non faites`)} className={`${btn} w-full border-2 border-ink/15 bg-white text-pink-deep`}>🗑️ Tout laisser tomber</button>
            </div>
          </section>

          <ul className="space-y-3">
            {pending.map((p) => (
              <li key={p.key} className="rounded-3xl bg-white p-4 shadow-card">
                <Link href={`/taches/${p.task.id}?j=${date}`} className="block" aria-label={`Détail : ${p.task.title}`}>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-extrabold tabular-nums text-pink-deep">{formatTime(p.task.time)}</span>
                    {p.afterMidnight && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-white">🌙 nuit</span>}
                    {p.task.sharedBy && <span className="rounded-full bg-pink-soft px-2 py-0.5 text-[11px] font-bold text-pink-deep">👥 de {p.task.sharedBy}</span>}
                    {p.task.transferOnly && <span className="rounded-full bg-pink-soft px-2 py-0.5 text-[11px] font-bold text-pink-deep">📥 transmise</span>}
                  </p>
                  <p className="text-[17px] font-bold leading-snug">{p.task.title}</p>
                  <p className="mt-0.5 text-[13px] font-medium text-mute">{CATEGORY_EMOJI[p.task.category]} {p.task.category}</p>
                </Link>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy} onClick={() => setSheet([p])} className={`${btn} bg-pink text-[14px] text-white`}>📤 Transmettre au prochain caissier</button>
                  <button type="button" disabled={busy} onClick={() => dropOne(p)} className={`${btn} border-2 border-line bg-white text-[14px]`}>🗑️ Laisser tomber</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-[13px] text-mute">Si tu ne fais rien, elles restent dans l&apos;historique comme « non faites ».</p>
        </>
      )}

      {treated.length > 0 && (
        <section className="mt-6" aria-label="Déjà traitées">
          <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide">Déjà traitées</h2>
          <ul className="space-y-2">
            {treated.map((x) => (
              <li key={x.key} className="rounded-2xl bg-white/80 p-3 text-[15px]">
                <Link href={`/taches/${x.task!.id}?j=${date}`} className="block">
                  <span className="font-bold">{x.task!.title}</span>
                  <span className="ml-2 rounded-full bg-pink-soft px-2 py-0.5 text-[11px] font-bold text-pink-deep">{OCC_LABEL[x.status]}</span>
                  <span className="mt-0.5 block text-[13px] text-mute">
                    {x.status === "handed" ? `À ${nextLabel} · ${transferInfo(x.task!.id)}` : x.reason ?? ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/historique" className="mt-6 flex min-h-12 items-center justify-center rounded-full text-sm font-bold text-pink-deep underline underline-offset-4">Voir l&apos;historique</Link>

      {sheet && <TransferSheet tasks={sheet} date={date} team={team} onClose={() => setSheet(null)} />}
    </>
  );
}

export default function BilanPage() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Bilan />
    </Suspense>
  );
}
