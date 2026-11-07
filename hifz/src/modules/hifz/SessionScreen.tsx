"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArabicText } from "@/components/ArabicText";
import { AyahAudioPlayer } from "@/components/AyahAudioPlayer";
import { Icon } from "@/components/icons";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Button, ButtonLink } from "@/components/ui";
import { basmalaText } from "@/lib/quran/catalog";
import type { SurahData } from "@/lib/quran/types";
import { buildSession, countIntroducedOn, diffDays, schedule, toDayKey, type Grade, type SrsCard } from "@/lib/srs";
import { getDb } from "@/lib/storage/client";
import { getSettings, recordGrade } from "@/lib/storage/repository";
import { plural, relativeDay, surahName } from "./format";
import { useSurah } from "./hooks";
import { currentItem, gradeCurrent, isFinished, startQueue, type QueueItem, type QueueState } from "./session-queue";

type Phase = "discover" | "recite" | "revealed";

interface Loaded {
  today: string;
  queue: QueueState;
  cards: Map<string, SrsCard>;
}

const GRADES: { grade: Grade; label: string; tone: string }[] = [
  { grade: "again", label: "À revoir", tone: "border-again/40 text-again" },
  { grade: "hard", label: "Hésitant", tone: "border-hard/40 text-hard" },
  { grade: "good", label: "Je sais", tone: "border-good bg-good text-on-accent" },
];

function intervalLabel(days: number): string {
  if (days <= 1) return "demain";
  if (days < 31) return `${days} j`;
  return `${Math.round(days / 30)} mois`;
}

export function SessionScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La session est figée à l'ouverture : noter un verset ne la recompose pas.
  useEffect(() => {
    let alive = true;
    (async () => {
      const db = getDb();
      const [cards, settings] = await Promise.all([db.cards.orderBy("rank").toArray(), getSettings(db)]);
      const today = toDayKey(new Date());
      const extra = new URLSearchParams(window.location.search).get("plus") === "1";
      const introducedToday = countIntroducedOn(cards, today);
      let session = buildSession(cards, { today, newLimit: settings.dailyNewLimit, introducedToday });
      if (extra && session.reviews.length + session.fresh.length === 0) {
        session = buildSession(cards, { today, newLimit: introducedToday + 1, introducedToday });
      }
      if (alive) setLoaded({ today, queue: startQueue(session), cards: new Map(cards.map((c) => [c.key, c])) });
    })().catch(() => alive && setError("Impossible de lire vos données sur cet appareil."));
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <CenteredMessage title="Erreur" text={error} />;
  if (!loaded) return <div className="mt-24 h-64 animate-pulse rounded-3xl bg-elevated" aria-busy="true" aria-label="Chargement" />;

  return <SessionRunner initial={loaded} />;
}

function SessionRunner({ initial }: { initial: Loaded }) {
  const [queue, setQueue] = useState(initial.queue);
  const [cards, setCards] = useState(initial.cards);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const item = currentItem(queue);
  const total = queue.items.length;

  if (total === 0) {
    return (
      <CenteredMessage
        title="Rien à réviser aujourd'hui"
        text="Vos révisions sont à jour. Ajoutez des versets à votre programme ou revenez demain."
      />
    );
  }

  if (isFinished(queue) || !item) return <SessionSummary queue={queue} cards={cards} today={initial.today} />;

  async function grade(g: Grade) {
    if (!item || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next = await recordGrade(getDb(), item.key, g);
      setCards((m) => new Map(m).set(next.key, next));
      setQueue((q) => gradeCurrent(q, g));
    } catch {
      setSaveError("La note n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-48">
      <header className="sticky top-0 z-20 -mx-4 bg-bg/95 px-4 pb-3 pt-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/" className="grid size-11 place-items-center rounded-full text-muted active:bg-elevated" aria-label="Quitter la session">
            <Icon name="close" />
          </Link>
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label="Progression de la session"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={queue.index}
          >
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(queue.index / total) * 100}%` }} />
          </div>
          <span className="min-w-12 text-right text-sm font-medium tabular-nums text-muted">
            {queue.index + 1}/{total}
          </span>
        </div>
      </header>
      <VerseStep
        key={`${queue.index}-${item.key}`}
        item={item}
        card={cards.get(item.key)}
        today={initial.today}
        saving={saving}
        saveError={saveError}
        onGrade={grade}
      />
    </div>
  );
}

function VerseStep({
  item,
  card,
  today,
  saving,
  saveError,
  onGrade,
}: {
  item: QueueItem;
  card: SrsCard | undefined;
  today: string;
  saving: boolean;
  saveError: string | null;
  onGrade: (g: Grade) => void;
}) {
  const [phase, setPhase] = useState<Phase>(item.kind === "new" ? "discover" : "recite");
  const [hint, setHint] = useState(false);
  const surah = useSurah(item.surah);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [phase]);

  const previews = useMemo(() => {
    if (!card) return null;
    return Object.fromEntries(GRADES.map(({ grade }) => [grade, schedule(card, grade, today)])) as Record<Grade, SrsCard>;
  }, [card, today]);

  const badge = item.kind === "new" ? "Nouveau verset" : item.kind === "retry" ? "À reprendre" : "Révision";

  return (
    <article className="pt-2">
      <p className="text-sm font-medium text-accent">{badge}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-bold tracking-tight outline-none">
        {surahName(item.surah)} <span className="text-muted">· verset {item.ayah}</span>
      </h1>

      {surah.status === "loading" ? (
        <div className="mt-6 h-48 animate-pulse rounded-3xl bg-elevated" aria-busy="true" aria-label="Chargement du verset" />
      ) : surah.status === "error" ? (
        <div role="alert" className="mt-6 rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center gap-2 font-semibold">
            {surah.offline ? <Icon name="wifi-off" width={20} height={20} /> : null}
            Verset indisponible
          </div>
          <p className="mt-2 text-[15px] text-muted">{surah.message}</p>
          <Button variant="secondary" className="mt-4 w-full" onClick={surah.retry}>
            Réessayer
          </Button>
        </div>
      ) : (
        <VerseBody data={surah.data} item={item} phase={phase} hint={hint} />
      )}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 backdrop-blur-md">
        <div className="mx-auto max-w-lg">
          {saveError ? (
            <p role="alert" className="mb-2 text-center text-sm text-again">
              {saveError}
            </p>
          ) : null}
          {phase === "discover" ? (
            <Button className="w-full text-lg" onClick={() => setPhase("recite")} disabled={surah.status !== "ready"}>
              Je suis prêt à réciter
            </Button>
          ) : phase === "recite" ? (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setHint(true)} disabled={hint || surah.status !== "ready"}>
                Indice
              </Button>
              <Button className="flex-1 text-lg" onClick={() => setPhase("revealed")} disabled={surah.status !== "ready"}>
                <Icon name="eye" /> Révéler
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Comment s'est passée la récitation ?">
              {GRADES.map(({ grade, label, tone }) => (
                <button
                  key={grade}
                  type="button"
                  disabled={saving}
                  onClick={() => onGrade(grade)}
                  className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 px-1 font-semibold transition active:scale-[0.97] disabled:opacity-50 ${tone}`}
                >
                  <span className="text-[16px]">{label}</span>
                  {previews ? (
                    <span className="text-xs font-medium opacity-80">{intervalLabel(previews[grade].interval)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function VerseBody({ data, item, phase, hint }: { data: SurahData; item: QueueItem; phase: Phase; hint: boolean }) {
  const { settings } = useSettings();
  const ayah = data.ayahs[item.ayah - 1];
  const previous = item.ayah > 1 ? data.ayahs[item.ayah - 2] : undefined;
  if (!ayah) return null;
  const showBasmala = item.ayah === 1 && data.basmala;

  if (phase === "recite") {
    return (
      <div className="mt-5 space-y-4">
        {previous ? (
          <section className="rounded-3xl border border-line bg-surface p-4" aria-label="Verset précédent">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Verset précédent ({previous.n})</p>
            <ArabicText text={previous.ar} size="sm" className="text-muted" />
          </section>
        ) : showBasmala ? (
          <section className="rounded-3xl border border-line bg-surface p-4" aria-label="Basmala">
            <ArabicText text={basmalaText} size="sm" className="text-center text-muted" />
          </section>
        ) : null}
        <section className="grid min-h-48 place-items-center rounded-3xl border-2 border-dashed border-line p-6 text-center">
          <div>
            <p className="text-lg font-semibold">Récitez le verset {item.ayah} de mémoire</p>
            <p className="mt-1 text-[15px] text-muted">Puis révélez-le pour vérifier.</p>
            {hint ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Premier mot</p>
                <ArabicText text={ayah.ar.split(" ")[0] ?? ""} className="text-center" />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-3xl border border-line bg-surface p-5">
        {showBasmala ? <ArabicText text={basmalaText} size="sm" className="mb-3 text-center text-muted" /> : null}
        <ArabicText text={ayah.ar} />
        {settings.showTranslation ? (
          <p className="mt-4 border-t border-line pt-4 text-[15px] leading-relaxed text-muted">
            <span className="sr-only">Traduction : </span>
            {ayah.fr}
          </p>
        ) : null}
        {ayah.sajda ? <p className="mt-3 text-sm font-medium text-accent">Verset de prosternation (sajda)</p> : null}
      </section>
      <AyahAudioPlayer surah={item.surah} ayah={item.ayah} />
      {phase === "discover" ? (
        <p className="px-1 text-[15px] leading-relaxed text-muted">
          Lisez et écoutez le verset plusieurs fois. Quand vous pensez le connaître, passez à la récitation de mémoire.
        </p>
      ) : null}
      <p className="px-1 text-xs text-muted">
        Texte : Tanzil · Traduction : M. Hamidullah · Audio : EveryAyah —{" "}
        <Link href="/sources" className="underline">
          sources
        </Link>
      </p>
    </div>
  );
}

function SessionSummary({ queue, cards, today }: { queue: QueueState; cards: Map<string, SrsCard>; today: string }) {
  const seen = new Set(queue.items.map((i) => i.key));
  const next = [...cards.values()]
    .filter((c) => c.due && diffDays(today, c.due) > 0)
    .map((c) => c.due!)
    .sort()[0];
  const { good, hard, again } = queue.results;
  return (
    <div className="flex min-h-[80dvh] flex-col justify-center pt-safe">
      <div className="rounded-3xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-medium text-accent">Session terminée</p>
        <h1 className="mt-1 text-2xl font-bold">{plural(seen.size, "verset révisé", "versets révisés")}</h1>
        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          <Stat label="Je sais" value={good} className="text-good" />
          <Stat label="Hésitant" value={hard} className="text-hard" />
          <Stat label="À revoir" value={again} className="text-again" />
        </dl>
        {next ? <p className="mt-6 text-[15px] text-muted">Prochaine révision {relativeDay(next, today)}.</p> : null}
      </div>
      <ButtonLink href="/" className="mt-6 w-full text-lg">
        Terminer
      </ButtonLink>
      <ButtonLink href="/hifz/suivi" variant="ghost" className="mt-2 w-full">
        Voir mon suivi
      </ButtonLink>
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex flex-col-reverse rounded-2xl bg-elevated p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-2xl font-bold tabular-nums ${className}`}>{value}</dd>
    </div>
  );
}

function CenteredMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex min-h-[80dvh] flex-col justify-center pt-safe">
      <div className="rounded-3xl border border-line bg-surface p-6 text-center">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{text}</p>
      </div>
      <ButtonLink href="/" className="mt-6 w-full">
        Retour à l&apos;accueil
      </ButtonLink>
      <ButtonLink href="/hifz/programme" variant="ghost" className="mt-2 w-full">
        Mon programme
      </ButtonLink>
    </div>
  );
}
