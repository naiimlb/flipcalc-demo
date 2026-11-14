"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { Icon } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { getSurahMeta, searchSurahs } from "@/lib/quran/catalog";
import type { SurahMeta } from "@/lib/quran/types";
import { getDb, getSurahLoader } from "@/lib/storage/client";
import { addProgram, ProgramError } from "@/lib/storage/repository";
import { plural } from "./format";

export function AddProgramScreen() {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [selected, setSelected] = useState<SurahMeta | null>(null);
  const results = searchSurahs(deferred);

  if (selected) return <RangeStep surah={selected} onBack={() => setSelected(null)} />;

  return (
    <>
      <header className="flex items-center gap-2 pb-4 pt-5">
        <Link href="/hifz/programme" className="grid size-11 place-items-center rounded-full text-accent" aria-label="Retour au programme">
          <Icon name="arrow-left" />
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Choisir une sourate</h1>
      </header>
      <label className="block">
        <span className="sr-only">Rechercher une sourate</span>
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nom ou numéro (ex. : Yasin, 36)"
          className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base outline-none focus:border-accent"
        />
      </label>
      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {results.map((s) => (
          <li key={s.number}>
            <button
              type="button"
              onClick={() => setSelected(s)}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-elevated"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-elevated text-sm font-semibold tabular-nums">
                {s.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{s.transliteration}</span>
                <span className="block text-sm text-muted">
                  {plural(s.ayahCount, "verset")} · {s.revelation === "meccan" ? "mecquoise" : "médinoise"}
                </span>
              </span>
              <span dir="rtl" lang="ar" className="shrink-0 font-amiri text-lg">
                {s.nameAr}
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 ? <li className="px-4 py-6 text-center text-muted">Aucune sourate trouvée.</li> : null}
      </ul>
    </>
  );
}

function RangeStep({ surah, onBack }: { surah: SurahMeta; onBack: () => void }) {
  const router = useRouter();
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(surah.ayahCount);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const count = to - from + 1;
  const options = Array.from({ length: surah.ayahCount }, (_, i) => i + 1);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await addProgram(getDb(), { surah: surah.number, from, to });
      // Téléchargement du texte pour l'avoir hors ligne (sans bloquer si le réseau manque).
      void getSurahLoader().load(surah.number).catch(() => {});
      router.push("/hifz/programme");
    } catch (e) {
      setError(e instanceof ProgramError ? e.message : "Impossible d'enregistrer le programme.");
      setSaving(false);
    }
  }

  const select =
    "min-h-12 w-full rounded-2xl border border-line bg-surface px-3 text-base tabular-nums outline-none focus:border-accent";

  return (
    <>
      <header className="flex items-center gap-2 pb-4 pt-5">
        <button type="button" onClick={onBack} className="grid size-11 place-items-center rounded-full text-accent" aria-label="Choisir une autre sourate">
          <Icon name="arrow-left" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">{surah.transliteration}</h1>
      </header>
      <Card>
        <p dir="rtl" lang="ar" className="text-center font-amiri text-2xl">
          {getSurahMeta(surah.number)?.nameAr}
        </p>
        <p className="mt-1 text-center text-sm text-muted">
          Sourate {surah.number} · {plural(surah.ayahCount, "verset")}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Du verset</span>
            <select
              className={select}
              value={from}
              onChange={(e) => {
                const v = Number(e.target.value);
                setFrom(v);
                if (v > to) setTo(v);
              }}
            >
              {options.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Au verset</span>
            <select className={select} value={to} onChange={(e) => setTo(Number(e.target.value))}>
              {options.filter((n) => n >= from).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-4 text-[15px] text-muted">
          {count === surah.ayahCount ? "Sourate entière" : plural(count, "verset")} à mémoriser, dans l&apos;ordre.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-again">
            {error}
          </p>
        ) : null}
        <Button className="mt-5 w-full" onClick={submit} disabled={saving}>
          {saving ? "Enregistrement…" : "Ajouter au programme"}
        </Button>
      </Card>
    </>
  );
}
