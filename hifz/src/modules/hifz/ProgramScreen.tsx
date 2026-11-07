"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { ButtonLink, Card, PageHeader } from "@/components/ui";
import { getSurahMeta } from "@/lib/quran/catalog";
import type { SrsCard } from "@/lib/srs";
import { stateTotals } from "@/lib/stats";
import { getDb } from "@/lib/storage/client";
import type { Program } from "@/lib/storage/db";
import { removeProgram } from "@/lib/storage/repository";
import { rangeLabel } from "./format";
import { useCards, usePrograms } from "./hooks";
import { OfflineAudioButton } from "./OfflineAudioButton";
import { ProgressBar, StateLegend } from "./ProgressBar";

export function ProgramScreen() {
  const programs = usePrograms();
  const cards = useCards();

  return (
    <>
      <PageHeader
        title="Programme"
        subtitle="Les versets que vous mémorisez."
        action={
          <ButtonLink href="/hifz/programme/ajouter" className="px-4">
            <Icon name="plus" width={20} height={20} /> Ajouter
          </ButtonLink>
        }
      />
      {!programs || !cards ? (
        <div className="h-32 animate-pulse rounded-3xl bg-elevated" />
      ) : programs.length === 0 ? (
        <Card>
          <p className="text-[15px] leading-relaxed text-muted">
            Aucun programme pour l&apos;instant. Commencez par une courte sourate, par exemple Al-Fatiha ou une sourate
            du juz &apos;Amma, ou par quelques versets d&apos;une sourate plus longue.
          </p>
          <ButtonLink href="/hifz/programme/ajouter" className="mt-4 w-full">
            Choisir une sourate
          </ButtonLink>
        </Card>
      ) : (
        <ul className="space-y-3">
          {programs.map((p) => (
            <ProgramItem key={p.id} program={p} cards={cards} />
          ))}
        </ul>
      )}
    </>
  );
}

function ProgramItem({ program, cards }: { program: Program; cards: SrsCard[] }) {
  const meta = getSurahMeta(program.surah);
  const [busy, setBusy] = useState(false);
  const inRange = useMemo(
    () => cards.filter((c) => c.surah === program.surah && c.ayah >= program.from && c.ayah <= program.to),
    [cards, program],
  );
  const totals = stateTotals(inRange);

  async function remove() {
    const ok = window.confirm(
      "Retirer ce programme ?\n\nLes versets pas encore commencés seront retirés. Ceux que vous avez déjà appris restent en révision pour ne pas les oublier.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      await removeProgram(getDb(), program.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">Sourate {program.surah}</p>
            <h2 className="text-lg font-semibold">{meta?.transliteration}</h2>
            <p className="text-sm text-muted">{rangeLabel(program.surah, program.from, program.to)}</p>
          </div>
          <p dir="rtl" lang="ar" className="shrink-0 pt-1 font-amiri text-xl">
            {meta?.nameAr}
          </p>
        </div>
        <ProgressBar totals={totals} className="mt-4" />
        <div className="mt-2">
          <StateLegend totals={totals} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <OfflineAudioButton surah={program.surah} from={program.from} to={program.to} />
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="flex min-h-10 items-center gap-1.5 text-sm font-medium text-again disabled:opacity-50"
          >
            <Icon name="trash" width={18} height={18} /> Retirer
          </button>
        </div>
      </Card>
    </li>
  );
}
