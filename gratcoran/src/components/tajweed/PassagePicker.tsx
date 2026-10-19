"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { SurahMeta } from "@/lib/tajweed/server";
import { MAX_VERSES } from "@/lib/tajweed/analyze";
import { pratiqueHref } from "@/lib/tajweed/links";
import { Button } from "../ui";

const SUGGESTIONS = [
  { label: "Al-Fatiha", s: 1, from: 1, to: 3 },
  { label: "Ayat al-Kursi", s: 2, from: 255, to: 255 },
  { label: "Al-Ikhlas", s: 112, from: 1, to: 3 },
  { label: "Al-Falaq", s: 113, from: 1, to: 3 },
  { label: "An-Nas", s: 114, from: 1, to: 3 },
  { label: "Al-Kawthar", s: 108, from: 1, to: 3 },
];

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9؀-ۿ]/gi, "")
    .toLowerCase();

export function PassagePicker({ surahs }: { surahs: SurahMeta[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SurahMeta | null>(null);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);

  const results = useMemo(() => {
    const q = fold(query);
    if (!q) return [];
    return surahs
      .filter(
        (s) =>
          String(s.number) === q ||
          fold(s.transliteration).includes(q) ||
          fold(s.nameFrench).includes(q) ||
          fold(s.nameArabic).includes(q),
      )
      .slice(0, 8);
  }, [query, surahs]);

  function choose(s: SurahMeta) {
    setSelected(s);
    setQuery("");
    setFrom(1);
    setTo(Math.min(s.verses, MAX_VERSES));
  }

  function onFrom(v: number) {
    setFrom(v);
    if (to < v || to > v + MAX_VERSES - 1) setTo(Math.min(v + MAX_VERSES - 1, selected!.verses));
  }

  return (
    <section className="glass rounded-[28px] p-5" aria-labelledby="picker-title">
      <h2 id="picker-title" className="text-[19px] font-bold tracking-tight">
        Choisis un passage
      </h2>
      <p className="mt-1 text-[14px] text-muted">De 1 à {MAX_VERSES} versets par essai, 30 secondes maximum.</p>

      <label htmlFor="surah-search" className="sr-only">
        Rechercher une sourate
      </label>
      <div className="relative mt-4">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          id="surah-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Nom ou numéro de sourate"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 w-full rounded-2xl border border-line bg-surface/80 pl-11 pr-4 text-[16px] outline-none transition focus:border-emerald focus:ring-4 focus:ring-emerald/15"
        />
      </div>

      <AnimatePresence initial={false}>
        {results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-2xl bg-surface"
            role="listbox"
            aria-label="Sourates trouvées"
          >
            {results.map((s) => (
              <li key={s.number}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => choose(s)}
                  className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left active:bg-line/50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-sm font-bold text-white">{s.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{s.transliteration}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {s.nameFrench} · {s.verses} versets
                    </span>
                  </span>
                  <span lang="ar" dir="rtl" className="quran text-xl leading-none">
                    {s.nameArabic}
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {!selected && results.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((x) => (
            <button
              key={x.label}
              type="button"
              onClick={() => router.push(pratiqueHref({ surah: x.s, verseStart: x.from, verseEnd: x.to }))}
              className="pressable min-h-[40px] rounded-full bg-emerald/10 px-4 text-[14px] font-semibold text-emerald-deep dark:text-emerald"
            >
              {x.label}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-bg/70 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand font-bold text-white">{selected.number}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-bold">{selected.transliteration}</p>
              <p className="truncate text-[14px] text-muted">{selected.nameFrench}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="min-h-[44px] px-2 text-[14px] font-semibold text-muted">
              Changer
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="text-[13px] font-medium text-muted">
              Du verset
              <select
                value={from}
                onChange={(e) => onFrom(Number(e.target.value))}
                className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 text-[16px] text-ink"
              >
                {Array.from({ length: selected.verses }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[13px] font-medium text-muted">
              au verset
              <select
                value={to}
                onChange={(e) => setTo(Number(e.target.value))}
                className="mt-1 h-12 w-full rounded-xl border border-line bg-surface px-3 text-[16px] text-ink"
              >
                {Array.from({ length: Math.min(MAX_VERSES, selected.verses - from + 1) }, (_, i) => from + i).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button className="mt-4" onClick={() => router.push(pratiqueHref({ surah: selected.number, verseStart: from, verseEnd: to }))}>
            Commencer
          </Button>
        </motion.div>
      )}
    </section>
  );
}
