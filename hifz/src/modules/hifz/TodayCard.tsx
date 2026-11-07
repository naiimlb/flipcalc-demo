"use client";

import { useMemo } from "react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { ButtonLink, Card } from "@/components/ui";
import { buildSession, countIntroducedOn, toDayKey } from "@/lib/srs";
import { computeStreak } from "@/lib/stats";
import { plural, relativeDay } from "./format";
import { useCards, useReviewDays } from "./hooks";

export function HifzTodayCard() {
  const cards = useCards();
  const reviewDays = useReviewDays();
  const { settings, loaded } = useSettings();

  const summary = useMemo(() => {
    if (!cards || !reviewDays || !loaded) return null;
    const today = toDayKey(new Date());
    const session = buildSession(cards, {
      today,
      newLimit: settings.dailyNewLimit,
      introducedToday: countIntroducedOn(cards, today),
    });
    const upcoming = cards
      .filter((c) => c.due && c.due > today)
      .map((c) => c.due!)
      .sort()[0];
    return {
      today,
      session,
      upcoming,
      remainingNew: cards.filter((c) => c.state === "new").length,
      streak: computeStreak(reviewDays, today),
    };
  }, [cards, reviewDays, loaded, settings.dailyNewLimit]);

  if (!summary) {
    return <div className="h-44 animate-pulse rounded-3xl bg-elevated" aria-busy="true" aria-label="Chargement" />;
  }

  if (cards!.length === 0) {
    return (
      <Card>
        <h2 className="text-xl font-semibold">Bienvenue</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Choisissez une sourate ou quelques versets à mémoriser. Chaque jour, l&apos;app vous proposera les révisions
          utiles et quelques nouveaux versets.
        </p>
        <ButtonLink href="/hifz/programme" className="mt-5 w-full">
          Choisir un programme
        </ButtonLink>
      </Card>
    );
  }

  const { session, streak, upcoming, today } = summary;
  const total = session.reviews.length + session.fresh.length;

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Session du jour</h2>
        {streak.current > 0 ? (
          <span className="text-sm text-muted">
            {plural(streak.current, "jour")} de suite{streak.activeToday ? "" : " · à poursuivre"}
          </span>
        ) : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-elevated p-4">
          <dt className="text-sm text-muted">À réviser</dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums">{session.reviews.length}</dd>
        </div>
        <div className="rounded-2xl bg-elevated p-4">
          <dt className="text-sm text-muted">Nouveaux</dt>
          <dd className="mt-1 text-3xl font-bold tabular-nums">{session.fresh.length}</dd>
        </div>
      </dl>
      {total > 0 ? (
        <ButtonLink href="/hifz/session" className="mt-5 w-full text-lg">
          Commencer
        </ButtonLink>
      ) : (
        <div className="mt-5 rounded-2xl bg-accent-soft p-4 text-[15px] leading-relaxed">
          <p className="font-semibold">Tout est à jour pour aujourd&apos;hui.</p>
          <p className="mt-1 text-muted">
            {upcoming ? `Prochaine révision ${relativeDay(upcoming, today)}.` : null}
            {summary.remainingNew === 0 ? " Ajoutez des versets à votre programme pour continuer." : null}
          </p>
          {summary.remainingNew > 0 ? (
            <ButtonLink href="/hifz/session?plus=1" variant="secondary" className="mt-3 w-full">
              Apprendre un verset de plus
            </ButtonLink>
          ) : (
            <ButtonLink href="/hifz/programme" variant="secondary" className="mt-3 w-full">
              Ajouter des versets
            </ButtonLink>
          )}
        </div>
      )}
    </Card>
  );
}
