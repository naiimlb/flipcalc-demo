"use client";

import { useMemo } from "react";
import { ButtonLink, Card, PageHeader, SectionTitle } from "@/components/ui";
import { getSurahMeta } from "@/lib/quran/catalog";
import { addDays, toDayKey } from "@/lib/srs";
import { computeStreak, dailyActivity, regularity, stateTotals, surahProgress } from "@/lib/stats";
import { ActivityChart } from "./ActivityChart";
import { plural } from "./format";
import { useCards, useReviewDays } from "./hooks";
import { ProgressBar, StateLegend } from "./ProgressBar";

function Tile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-[28px] font-semibold leading-tight tabular-nums">{value}</dd>
      {detail ? <dd className="mt-0.5 text-sm text-muted">{detail}</dd> : null}
    </div>
  );
}

export function StatsScreen() {
  const cards = useCards();
  const reviewDays = useReviewDays();

  const stats = useMemo(() => {
    if (!cards || !reviewDays) return null;
    const today = toDayKey(new Date());
    const activity = dailyActivity(reviewDays, today, 30);
    const in7 = addDays(today, 7);
    return {
      today,
      streak: computeStreak(reviewDays, today),
      totals: stateTotals(cards),
      activity,
      regularity: regularity(activity),
      activeDays: activity.filter((a) => a.count > 0).length,
      surahs: surahProgress(cards),
      dueTomorrow: cards.filter((c) => c.due === addDays(today, 1)).length,
      dueWeek: cards.filter((c) => c.due && c.due > today && c.due <= in7).length,
      reviews: reviewDays.length,
    };
  }, [cards, reviewDays]);

  if (!stats) return <PageHeader title="Suivi" />;

  if (stats.totals.total === 0) {
    return (
      <>
        <PageHeader title="Suivi" />
        <Card>
          <p className="text-[15px] text-muted">Votre suivi apparaîtra ici après vos premières révisions.</p>
          <ButtonLink href="/hifz/programme" className="mt-4 w-full">
            Choisir un programme
          </ButtonLink>
        </Card>
      </>
    );
  }

  const { streak, totals } = stats;

  return (
    <>
      <PageHeader title="Suivi" subtitle={`${plural(stats.reviews, "révision")} au total`} />
      <dl className="grid grid-cols-2 gap-3">
        <Tile
          label="Série"
          value={plural(streak.current, "jour")}
          detail={streak.best > streak.current ? `Record : ${plural(streak.best, "jour")}` : streak.activeToday ? "Révisé aujourd'hui" : "À poursuivre aujourd'hui"}
        />
        <Tile label="Versets acquis" value={String(totals.mastered)} detail={`sur ${totals.total} suivis`} />
        <Tile label="En cours" value={String(totals.learning)} detail={plural(totals.new, "nouveau à venir", "nouveaux à venir")} />
        <Tile label="Régularité" value={`${Math.round(stats.regularity * 100)} %`} detail={`${plural(stats.activeDays, "jour actif", "jours actifs")} sur 30`} />
      </dl>

      <SectionTitle>Révisions par jour, 30 derniers jours</SectionTitle>
      <Card>
        <ActivityChart activity={stats.activity} />
      </Card>

      <SectionTitle>À venir</SectionTitle>
      <Card className="text-[15px]">
        <p>
          Demain : <strong>{plural(stats.dueTomorrow, "verset")}</strong>
        </p>
        <p className="mt-1">
          7 prochains jours : <strong>{plural(stats.dueWeek, "verset")}</strong>
        </p>
      </Card>

      <SectionTitle>Sourates</SectionTitle>
      <Card>
        <ul className="space-y-4">
          {stats.surahs.map((s) => {
            const meta = getSurahMeta(s.surah);
            return (
              <li key={s.surah}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {meta?.transliteration} <span className="text-sm font-normal text-muted">({s.surah})</span>
                  </p>
                  <p className="text-sm tabular-nums text-muted">
                    {s.mastered}/{meta?.ayahCount ?? s.total}
                  </p>
                </div>
                <ProgressBar totals={{ ...s, total: meta?.ayahCount ?? s.total }} className="mt-2" />
              </li>
            );
          })}
        </ul>
        <div className="mt-4 border-t border-line pt-3">
          <StateLegend totals={totals} />
        </div>
      </Card>
    </>
  );
}
