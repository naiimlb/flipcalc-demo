"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { ShareBadge } from "@/components/ShareBadge";
import { Skeleton } from "@/components/Skeleton";
import { doneKey } from "@/lib/db-map";
import {
  claimedByOther,
  dateKey,
  formatServiceDate,
  formatTime,
  frequencyLabel,
  parseDateKey,
  serviceDate,
  TEAM_LABEL,
} from "@/lib/service";
import { occAct, PROGRESS_LABEL, respondShare, shareOverview, type Participant } from "@/lib/sharing";
import { refreshStore, useAppState } from "@/lib/store";
import { setTaskDone } from "@/lib/task-actions";
import { showToast } from "@/lib/toast";
import { CATEGORY_EMOJI, isMine, isSharedWithMe } from "@/lib/types";

const POSTPONE_MIN = 10;
const big = "min-h-16 w-full rounded-3xl text-lg font-extrabold active:scale-[0.98] disabled:opacity-50";

function TaskDetail({ id }: { id: string }) {
  const state = useAppState();
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get("j");
  const [people, setPeople] = useState<Participant[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const seenFor = useRef<string | null>(null);

  // Journée de service du lien (celle de la notification) ; à défaut, la journée en cours.
  const date = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : dateKey(serviceDate(new Date()));
  const task = state?.tasks.find((t) => t.id === id);
  const uid = state?.profile.id ?? "";
  const accepted = !!task && (!isSharedWithMe(task) || task.shareStatus === "accepted");

  // Hors ligne ou tâche non partagée : on n'affiche simplement pas le bloc « Concernés ».
  const loadPeople = () => void shareOverview(id, date).then(setPeople, () => undefined);

  // Ouvrir la page = « signe de vie » : les relances s'arrêtent (« Vu »).
  useEffect(() => {
    if (!task || !accepted || seenFor.current === `${id}@${date}`) return;
    seenFor.current = `${id}@${date}`;
    void occAct(id, date, "seen").then(() => shareOverview(id, date)).then(setPeople, () => undefined);
  }, [task, accepted, id, date]);

  useEffect(() => {
    if (!task || !accepted) return;
    const t = setInterval(() => void shareOverview(id, date).then(setPeople, () => undefined), 20_000);
    return () => clearInterval(t);
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
  const iTook = state.claims[key]?.userId === uid || people?.find((p) => p.userId === uid)?.progress === "taken";
  const mine = isMine(task, uid);
  const others = people?.filter((p) => !p.isOwner || !mine) ?? [];

  async function act(action: "seen" | "taken" | "postpone") {
    setBusy(true);
    const r = await occAct(id, date, action, POSTPONE_MIN);
    setBusy(false);
    if (!r.ok) {
      if ("takenBy" in r) showToast(`🙌 ${r.takenBy} s'en occupe déjà`, "Tu n'as plus rien à faire pour cette tâche.");
      else showToast("⚠️ Pas enregistré", "Vérifie ta connexion et réessaie.");
      await refreshStore(true);
      return;
    }
    setInfo(action === "seen" ? "👀 C'est noté, tu as vu la tâche." : action === "taken" ? "🙋 Tu t'en occupes. Tes collègues sont prévenus." : `⏱️ Reporté : je te le rappelle dans ${POSTPONE_MIN} min.`);
    await refreshStore(true);
    loadPeople();
  }

  async function finish() {
    setBusy(true);
    const ok = await setTaskDone(task!, date, !done);
    setBusy(false);
    if (ok) {
      setInfo(done ? null : "✅ Fait, bien joué !");
      loadPeople();
    }
  }

  async function answer(accept: boolean) {
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

  const dayLabel = formatServiceDate(parseDateKey(date));

  return (
    <article className="pb-6">
      <Link href="/" className="mb-3 inline-flex min-h-11 items-center text-sm font-bold text-pink-deep">← Retour</Link>

      <div className="rounded-3xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-3xl font-extrabold tabular-nums text-pink-deep">{formatTime(task.time)}</span>
          <ShareBadge task={task} />
          {done && <span className="rounded-full bg-pink px-2 py-0.5 text-[11px] font-extrabold text-white">✅ Faite</span>}
        </div>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{task.title}</h1>
        {task.note && <p className="mt-2 text-[15px] leading-snug text-ink/80">{task.note}</p>}
        <p className="mt-3 text-[13px] font-medium text-mute">
          {CATEGORY_EMOJI[task.category]} {task.category} · {TEAM_LABEL[task.team]} · 🔔 {frequencyLabel(task)}
        </p>
        <p className="mt-1 text-[13px] font-medium text-mute">Journée du {dayLabel}</p>
      </div>

      {isSharedWithMe(task) && task.shareStatus !== "accepted" && (
        <div role="status" className="mt-4 rounded-3xl border-2 border-pink bg-white p-4">
          <p className="text-[15px] font-extrabold text-pink-deep">
            {task.shareStatus === "declined" ? `Tu as masqué cette tâche de ${task.sharedBy}.` : `👥 ${task.sharedBy} t'a partagé cette tâche.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => answer(true)} className="min-h-12 rounded-full bg-pink font-extrabold text-white shadow-pop">{task.shareStatus === "declined" ? "La reprendre" : "Accepter"}</button>
            {task.shareStatus !== "declined" && (
              <button type="button" disabled={busy} onClick={() => answer(false)} className="min-h-12 rounded-full border-2 border-line bg-white font-bold">Refuser</button>
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

          <div className="mt-4 space-y-3">
            <button type="button" disabled={busy || !!holder} onClick={finish} className={`${big} ${done ? "border-2 border-pink bg-white text-pink-deep" : "bg-pink text-white shadow-pop"}`}>
              {done ? "↩️ Remettre à faire" : "✅ Fait"}
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" disabled={busy || done || !!holder} onClick={() => act("seen")} className={`${big} border-2 border-line bg-white text-base`}>👀 Vu</button>
              <button type="button" disabled={busy || done || !!holder || iTook} onClick={() => act("taken")} className={`${big} border-2 border-line bg-white text-base`}>
                {iTook ? "🙋 Tu t'en occupes" : "🙋 Je m'en occupe"}
              </button>
            </div>
            <button type="button" disabled={busy || done || !!holder} onClick={() => act("postpone")} className={`${big} border-2 border-line bg-white text-base`}>
              ⏱️ Reporter de {POSTPONE_MIN} min
            </button>
          </div>

          {task.shareMode && (
            <section aria-label="Personnes concernées" className="mt-6 rounded-3xl bg-white p-4 shadow-card">
              <p className="text-sm font-extrabold uppercase tracking-wide">Concernés</p>
              <p className="mt-0.5 text-[13px] text-mute">{task.shareMode === "one" ? "Un seul s'en occupe : le premier qui appuie sur « Je m'en occupe »." : "Chacun la fait de son côté."}</p>
              {people === null ? (
                <p className="mt-3 text-sm text-mute">Chargement…</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {[...people].map((p) => (
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
              {others.length === 0 && people !== null && <p className="mt-2 text-sm text-mute">Personne d&apos;autre pour le moment.</p>}
            </section>
          )}

          {mine && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link href={`/tache/${task.id}`} className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-ink/15 bg-white text-base font-bold">✏️ Modifier</Link>
              <Link href={`/partager/${task.id}`} className="inline-flex min-h-12 items-center justify-center rounded-full border-2 border-pink bg-white text-base font-extrabold text-pink-deep">👥 Partager</Link>
            </div>
          )}
          {!mine && <p className="mt-6 text-center text-[13px] text-mute">Seul {task.sharedBy} peut modifier cette tâche.</p>}
        </>
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
