"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { IntInput } from "@/components/NumInput";
import { ShareBadge } from "@/components/ShareBadge";
import { Skeleton } from "@/components/Skeleton";
import { shiftOver } from "@/lib/bilan";
import { doneKey } from "@/lib/db-map";
import { claimedByOther, dateKey, formatServiceDate, formatTime, frequencyLabel, parseDateKey, serviceDate, TEAM_LABEL } from "@/lib/service";
import { occAct, PROGRESS_LABEL, respondShare, shareOverview, type Participant } from "@/lib/sharing";
import { refreshStore, useAppState } from "@/lib/store";
import { abandonTask, declineTask, setTaskDone } from "@/lib/task-actions";
import { showToast } from "@/lib/toast";
import { HISTORY_LABEL, myStatus, respondTransfer, taskHistory, type HistoryItem, type MyStatus } from "@/lib/transfers";
import { CATEGORY_EMOJI, isMine, isSharedWithMe, OCC_LABEL, type OccStatus } from "@/lib/types";

const LATER = [10, 15, 30, 60];
const big = "min-h-16 w-full rounded-3xl px-4 text-lg font-extrabold active:scale-[0.98] disabled:opacity-50";
const small = "min-h-12 rounded-full border-2 border-line bg-white px-4 text-base font-bold disabled:opacity-50";
const chip = (on: boolean) => `min-h-11 rounded-full border-2 px-4 text-[15px] font-bold ${on ? "border-pink bg-pink text-white" : "border-line bg-white"}`;

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", "h");

function TaskDetail({ id }: { id: string }) {
  const state = useAppState();
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get("j");
  const [people, setPeople] = useState<Participant[] | null>(null);
  const [mine, setMine] = useState<MyStatus | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "later" | "decline">(null);
  const [minutes, setMinutes] = useState(10);
  const [custom, setCustom] = useState(false);
  const [reason, setReason] = useState("");
  const seenFor = useRef<string | null>(null);

  // Journée de service du lien (celle de la notification) ; à défaut, la journée en cours.
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : dateKey(serviceDate(new Date()));
  const task = state?.tasks.find((t) => t.id === id);
  const uid = state?.profile.id ?? "";
  const incoming = state?.transfers.find((t) => t.toUser === uid && t.taskId === id && t.targetDate === date);
  const accepted = !!task && (task.transferOnly ? incoming?.status === "accepted" : !isSharedWithMe(task) || task.shareStatus === "accepted");

  const reload = () => {
    void myStatus(id, date).then(setMine, () => undefined);
    void shareOverview(id, date).then(setPeople, () => undefined);
    void taskHistory(id, date).then(setHistory, () => undefined);
  };

  // Ouvrir la page = « signe de vie » : les relances s'arrêtent. La tâche reste « vue » tant que je n'ai pas choisi une action.
  useEffect(() => {
    if (!task || !accepted || seenFor.current === `${id}@${date}`) return;
    seenFor.current = `${id}@${date}`;
    void occAct(id, date, "seen").then(() => {
      void myStatus(id, date).then(setMine, () => undefined);
      void shareOverview(id, date).then(setPeople, () => undefined);
      void taskHistory(id, date).then(setHistory, () => undefined);
    });
  }, [task, accepted, id, date]);

  useEffect(() => {
    if (!task || !accepted) return;
    const t = setInterval(() => void shareOverview(id, date).then(setPeople, () => undefined), 20_000);
    return () => clearInterval(t);
  }, [task, accepted, id, date]);

  // Page ouverte depuis une invitation de transmission (pas encore acceptée) : on charge quand même l'historique.
  useEffect(() => {
    if (task && !accepted) void taskHistory(id, date).then(setHistory, () => undefined);
  }, [task, accepted, id, date]);

  if (!state) return <Skeleton />;
  if (!task) {
    return (
      <div className="pt-6 text-center">
        <p className="text-xl font-extrabold">Tâche introuvable 🤷</p>
        <p className="mt-2 text-sm text-mute">Elle a peut-être été supprimée, ou n&apos;est plus partagée avec toi.</p>
        <Link href="/" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-pink px-6 font-bold text-white">Retour</Link>
      </div>
    );
  }

  const key = doneKey(task.id, date);
  const done = !!state.done[key];
  const holder = claimedByOther(state.claims, key, uid);
  const own = isMine(task, uid);
  const over = shiftOver(new Date(), parseDateKey(date), state.settings.schedule, state.settings.handover);
  const outcome = state.outcomes[key]?.status;
  const base: Exclude<OccStatus, "missed"> = outcome ?? mine?.status ?? "todo";
  const status: OccStatus = done ? "done" : base === "todo" && over ? "missed" : base;
  const closed = status === "declined" || status === "abandoned" || status === "handed";
  const sender = incoming?.fromPrenom ?? task.sharedBy ?? null;

  async function later() {
    setBusy(true);
    const r = await occAct(id, date, "postpone", minutes);
    setBusy(false);
    if (!r.ok) return showToast("⚠️ Pas enregistré", "Vérifie ta connexion et réessaie.");
    setPanel(null);
    setInfo(`⏰ Reporté : je te rappelle dans ${minutes} min.`);
    reload();
  }

  async function decline() {
    setBusy(true);
    const ok = await declineTask(task!, date, reason);
    setBusy(false);
    if (!ok) return;
    setPanel(null);
    setReason("");
    setInfo(sender && !own ? `🚫 Refusée. ${sender} est prévenu.` : "🚫 Refusée. Plus de rappel pour aujourd'hui.");
    reload();
  }

  async function take() {
    setBusy(true);
    const r = await occAct(id, date, "taken");
    setBusy(false);
    if (!r.ok) {
      if ("takenBy" in r) showToast(`🙌 ${r.takenBy} s'en occupe déjà`, "Tu n'as plus rien à faire pour cette tâche.");
      await refreshStore(true);
      return;
    }
    setInfo("🙋 Tu t'en occupes. Tes collègues sont prévenus.");
    await refreshStore(true);
    reload();
  }

  async function finish() {
    setBusy(true);
    const ok = await setTaskDone(task!, date, !done);
    setBusy(false);
    if (ok) {
      setInfo(done ? null : "✅ Fait, bien joué !");
      reload();
    }
  }

  async function reopen() {
    setBusy(true);
    const r = await occAct(id, date, "reopen");
    setBusy(false);
    if (!r.ok) return showToast("⚠️ Pas enregistré", "Vérifie ta connexion et réessaie.");
    setInfo("↩️ Tu as repris la tâche.");
    await refreshStore(true);
    reload();
  }

  async function abandon() {
    if (!window.confirm(`Laisser tomber « ${task!.title} » ? Elle reste dans l'historique.`)) return;
    setBusy(true);
    const ok = await abandonTask(task!, date);
    setBusy(false);
    if (ok) {
      setInfo("🗑️ Abandonnée. Elle reste dans l'historique.");
      reload();
    }
  }

  async function answerShare(accept: boolean) {
    setBusy(true);
    try {
      await respondShare(id, accept);
      await refreshStore(true);
      if (!accept) router.push("/");
    } catch {
      showToast("⚠️ Pas enregistré", "Vérifie ta connexion et réessaie.");
    }
    setBusy(false);
  }

  async function answerTransfer(accept: boolean) {
    if (!incoming) return;
    setBusy(true);
    const r = await respondTransfer(incoming.id, accept);
    setBusy(false);
    if (!r.ok) {
      showToast(r.takenBy ? `🙌 ${r.takenBy} l'a déjà prise` : "Plus disponible", r.takenBy ? "Un collègue de l'équipe a accepté avant toi." : "Cette transmission n'est plus en attente.");
      return;
    }
    if (accept) setInfo("📥 Tâche acceptée. Elle est dans ton planning.");
    else router.push("/");
  }

  const dayLabel = formatServiceDate(parseDateKey(date));
  const statusLine =
    status === "postponed" && mine?.postponedUntil
      ? `Reportée : rappel à ${hhmm(mine.postponedUntil)}`
      : status === "declined"
        ? `Refusée${(state.outcomes[key]?.reason ?? mine?.reason) ? ` : ${state.outcomes[key]?.reason ?? mine?.reason}` : ""}`
        : status === "handed"
          ? `Transmise à ${mine?.handedTo ?? "la prochaine équipe"}`
          : status === "abandoned"
            ? "Abandonnée : gardée dans l'historique"
            : status === "missed"
              ? "Non faite : la fin de ton équipe est passée"
              : OCC_LABEL[status];

  return (
    <article className="pb-6">
      <Link href="/" className="mb-3 inline-flex min-h-11 items-center text-sm font-bold text-pink-deep">← Retour</Link>

      <div className="rounded-3xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-3xl font-extrabold tabular-nums text-pink-deep">{formatTime(task.time)}</span>
          <ShareBadge task={task} />
          {task.transferOnly && incoming && <span className="rounded-full bg-pink-soft px-2 py-0.5 text-[11px] font-bold text-pink-deep">📥 transmise par {incoming.fromPrenom}</span>}
          {task.assigned && <span className="rounded-full bg-pink-soft px-2 py-0.5 text-[11px] font-bold text-pink-deep">📌 Assignée</span>}
        </div>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{task.title}</h1>
        {task.note && <p className="mt-2 text-[15px] leading-snug text-ink/80">{task.note}</p>}
        <p className="mt-3 text-[13px] font-medium text-mute">
          {CATEGORY_EMOJI[task.category]} {task.category} · {TEAM_LABEL[task.team]} · 🔔 {frequencyLabel(task)}
        </p>
        <p className="mt-1 text-[13px] font-medium text-mute">
          Journée du {dayLabel} ·{" "}
          {task.transferOnly ? `transmise par ${incoming?.fromPrenom ?? "un collègue"}` : own ? (task.assigned ? "assignée par un responsable" : "créée par toi") : `partagée par ${task.sharedBy ?? "un collègue"}`}
        </p>
        {accepted && (
          <p className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-extrabold ${status === "done" ? "bg-pink text-white" : status === "missed" ? "bg-ink text-white" : "bg-pink-soft text-pink-deep"}`} data-status={status}>
            {status === "done" ? "✅ " : ""}{statusLine}
          </p>
        )}
      </div>

      {task.transferOnly && incoming?.status === "pending" && (
        <div role="status" className="mt-4 rounded-3xl border-2 border-pink bg-white p-4">
          <p className="text-[15px] font-extrabold text-pink-deep">📥 {incoming.fromPrenom} t&apos;a transmis cette tâche{incoming.wholeTeam ? " (à toute l'équipe)" : ""}.</p>
          {incoming.message && <p className="mt-1 text-[15px] leading-snug">« {incoming.message} »</p>}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => answerTransfer(true)} className="min-h-12 rounded-full bg-pink font-extrabold text-white shadow-pop">Accepter</button>
            <button type="button" disabled={busy} onClick={() => answerTransfer(false)} className="min-h-12 rounded-full border-2 border-line bg-white font-bold">Refuser</button>
          </div>
        </div>
      )}
      {task.transferOnly && incoming && incoming.status !== "pending" && incoming.status !== "accepted" && (
        <p role="status" className="mt-4 rounded-2xl bg-ink px-4 py-3 text-[15px] font-bold text-white">
          {incoming.status === "closed" ? "🙌 Un collègue de l'équipe l'a prise." : incoming.status === "declined" ? "Tu as refusé cette transmission." : "Cette transmission a expiré."}
        </p>
      )}

      {isSharedWithMe(task) && task.shareStatus !== "accepted" && (
        <div role="status" className="mt-4 rounded-3xl border-2 border-pink bg-white p-4">
          <p className="text-[15px] font-extrabold text-pink-deep">
            {task.shareStatus === "declined" ? `Tu as masqué cette tâche de ${task.sharedBy}.` : `👥 ${task.sharedBy} t'a partagé cette tâche.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => answerShare(true)} className="min-h-12 rounded-full bg-pink font-extrabold text-white shadow-pop">{task.shareStatus === "declined" ? "La reprendre" : "Accepter"}</button>
            {task.shareStatus !== "declined" && (
              <button type="button" disabled={busy} onClick={() => answerShare(false)} className="min-h-12 rounded-full border-2 border-line bg-white font-bold">Refuser</button>
            )}
          </div>
        </div>
      )}

      {accepted && (
        <>
          {holder && (
            <p role="status" className="mt-4 rounded-2xl bg-ink px-4 py-3 text-[15px] font-bold text-white">
              🙌 {holder.prenom} s&apos;en occupe. Tu n&apos;as plus rien à faire, tes rappels sont arrêtés.
            </p>
          )}
          {info && <p role="status" className="mt-4 rounded-2xl bg-pink-soft px-4 py-3 text-[15px] font-bold text-pink-deep">{info}</p>}

          {closed ? (
            <div className="mt-4 space-y-3">
              {status !== "handed" && <button type="button" disabled={busy} onClick={reopen} className={`${big} border-2 border-pink bg-white text-pink-deep`}>↩️ Reprendre la tâche</button>}
              {status === "handed" && <p className="rounded-2xl bg-white p-4 text-[15px] text-ink/80 shadow-card">Elle a été transmise : si personne ne la prend, elle te revient et tu es prévenu.</p>}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <button type="button" disabled={busy || !!holder} onClick={finish} className={`${big} ${done ? "border-2 border-pink bg-white text-pink-deep" : "bg-pink text-white shadow-pop"}`}>
                {done ? "↩️ Remettre à faire" : "✅ Fait"}
              </button>
              <button type="button" disabled={busy || done || !!holder} aria-expanded={panel === "later"} onClick={() => setPanel(panel === "later" ? null : "later")} className={`${big} border-2 border-line bg-white`}>
                ⏰ Rappelle-moi plus tard
              </button>
              {panel === "later" && (
                <div className="rounded-3xl bg-white p-4 shadow-card">
                  <p className="mb-2 text-sm font-extrabold">Dans combien de temps ?</p>
                  <div className="flex flex-wrap gap-2">
                    {LATER.map((m) => (
                      <button key={m} type="button" aria-pressed={!custom && minutes === m} onClick={() => (setCustom(false), setMinutes(m))} className={chip(!custom && minutes === m)}>{m} min</button>
                    ))}
                    <button type="button" aria-pressed={custom} onClick={() => setCustom(true)} className={chip(custom)}>Autre</button>
                  </div>
                  {custom && (
                    <div className="mt-3 flex items-center gap-2">
                      <IntInput aria-label="Nombre de minutes avant le rappel" value={minutes} max={720} onChange={setMinutes} placeholder="20" className="h-12 w-24 rounded-2xl border-2 border-line bg-white text-center text-[17px] font-extrabold focus:border-pink" />
                      <span className="font-semibold">minutes (1 à 720)</span>
                    </div>
                  )}
                  <button type="button" disabled={busy || minutes < 1} onClick={later} className="mt-3 min-h-12 w-full rounded-full bg-pink text-base font-extrabold text-white shadow-pop disabled:opacity-50">
                    Me rappeler dans {minutes || "…"} min
                  </button>
                  <p className="mt-2 text-[13px] text-mute">Pendant ce délai, plus de relance automatique.</p>
                </div>
              )}
              <button type="button" disabled={busy || done} aria-expanded={panel === "decline"} onClick={() => setPanel(panel === "decline" ? null : "decline")} className={`${big} border-2 border-ink/15 bg-white text-pink-deep`}>
                🚫 Refuser
              </button>
              {panel === "decline" && (
                <div className="rounded-3xl bg-white p-4 shadow-card">
                  <p className="text-[15px] font-extrabold">Tu ne feras pas cette tâche ?</p>
                  <p className="mt-0.5 text-[13px] text-mute">{sender && !own ? `${sender} sera prévenu.` : "Elle est annulée pour aujourd'hui, personne n'est prévenu."}</p>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} placeholder="Pourquoi ? (facultatif)" aria-label="Motif du refus" className="mt-3 h-12 w-full rounded-2xl border-2 border-line bg-white px-3 text-[17px] font-semibold focus:border-pink" />
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button type="button" disabled={busy} onClick={decline} className="min-h-12 rounded-full bg-ink font-extrabold text-white">Oui, refuser</button>
                    <button type="button" onClick={() => setPanel(null)} className="min-h-12 rounded-full border-2 border-line bg-white font-bold">Annuler</button>
                  </div>
                </div>
              )}
              {task.shareMode === "one" && (
                <button type="button" disabled={busy || done || !!holder} onClick={take} className={small + " w-full"}>🙋 Je m&apos;en occupe</button>
              )}
              {(status === "missed" || over) && !done && (
                <Link href={`/bilan?j=${date}`} className={`${small} inline-flex w-full items-center justify-center`}>📋 Voir le bilan du service</Link>
              )}
              {!done && (
                <button type="button" disabled={busy} onClick={abandon} className="min-h-11 w-full text-sm font-bold text-mute underline underline-offset-4">Laisser tomber cette tâche</button>
              )}
            </div>
          )}

          {task.shareMode && (
            <section aria-label="Personnes concernées" className="mt-6 rounded-3xl bg-white p-4 shadow-card">
              <p className="text-sm font-extrabold uppercase tracking-wide">Concernés</p>
              <p className="mt-0.5 text-[13px] text-mute">{task.shareMode === "one" ? "Un seul s'en occupe : le premier qui appuie sur « Je m'en occupe »." : "Chacun la fait de son côté."}</p>
              {people === null ? (
                <p className="mt-3 text-sm text-mute">Chargement…</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {people.map((p) => (
                    <li key={p.userId} className="flex items-center justify-between gap-3 text-[15px]">
                      <span className="font-bold">
                        {p.userId === uid ? "Toi" : p.prenom}
                        {p.isOwner && <span className="ml-2 text-[11px] font-semibold text-mute">créateur</span>}
                      </span>
                      <span className="text-sm font-semibold text-mute">
                        {p.shareStatus === "pending" ? "⏳ Pas encore répondu" : p.shareStatus === "declined" ? "🙈 Refusée" : PROGRESS_LABEL[p.progress]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {own && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link href={`/tache/${task.id}`} className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-ink/15 bg-white text-base font-bold">✏️ Modifier</Link>
              <Link href={`/partager/${task.id}`} className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-pink bg-white text-base font-extrabold text-pink-deep">👥 Partager</Link>
            </div>
          )}
          {!own && !task.transferOnly && <p className="mt-6 text-center text-[13px] text-mute">Seul {task.sharedBy} peut modifier cette tâche.</p>}
        </>
      )}

      {history && history.length > 0 && (
        <details className="mt-6 rounded-3xl bg-white p-4 shadow-card">
          <summary className="min-h-11 cursor-pointer text-sm font-extrabold uppercase tracking-wide">Historique ({history.length})</summary>
          <ul className="mt-2 space-y-2">
            {history.map((h, i) => (
              <li key={i} className="text-[14px] leading-snug">
                <span className="font-bold tabular-nums text-pink-deep">{hhmm(h.at)}</span>{" "}
                <span className="font-bold">{h.who ?? h.concerned ?? "Quelqu'un"}</span> {HISTORY_LABEL[h.action] ?? h.action}
                {h.detail ? <span className="text-mute"> · {h.detail}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<Skeleton />}>
      <TaskDetail id={id} />
    </Suspense>
  );
}
