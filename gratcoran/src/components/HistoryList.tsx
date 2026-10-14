"use client";

import Link from "next/link";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Confidence } from "@/lib/quran/matcher";
import type { SurahInfo, VerseInfo } from "@/lib/quran/present";
import { ConfidenceBadge, SurahHeader, VerseBlock, verseRangeLabel } from "./quran";
import { Sheet } from "./Sheet";
import { Button, Notice } from "./ui";

export type HistoryEntry = {
  id: string;
  createdAt: string;
  confidence: Confidence;
  surah: SurahInfo;
  verseStart: number | null;
  verseEnd: number | null;
  verses: VerseInfo[];
};

const REVEAL = 92;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today)) return "Aujourd'hui";
  if (dayKey(d) === dayKey(yesterday)) return "Hier";
  const label = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function HistoryList({ initialEntries }: { initialEntries: HistoryEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Dates groupées dans le fuseau du téléphone : rendu après montage (pas d'écart serveur/client).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: HistoryEntry[] }>();
    for (const e of entries) {
      const d = new Date(e.createdAt);
      const key = dayKey(d);
      if (!map.has(key)) map.set(key, { label: dayLabel(d), items: [] });
      map.get(key)!.items.push(e);
    }
    return [...map.entries()];
  }, [entries]);

  async function remove(entry: HistoryEntry) {
    setSelected(null);
    setError(null);
    setEntries((list) => list.filter((e) => e.id !== entry.id));
    const { error } = await getBrowserSupabase().from("recognitions").delete().eq("id", entry.id);
    if (error) {
      setError("Suppression impossible. Vérifie ta connexion et réessaie.");
      setEntries((list) =>
        [...list, entry].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    }
  }

  if (entries.length === 0) return <EmptyState />;
  if (!mounted) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}
      <p className="text-sm text-muted">Glisse une ligne vers la gauche pour la supprimer.</p>
      <AnimatePresence initial={false}>
        {groups.map(([key, group]) => (
          <motion.section key={key} layout exit={{ opacity: 0 }}>
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
              {group.label}
            </h2>
            <ul className="overflow-hidden rounded-2xl bg-surface">
              <AnimatePresence initial={false}>
                {group.items.map((entry, i) => (
                  <motion.li
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 40 }}
                    className={i > 0 ? "border-t border-line" : ""}
                  >
                    <SwipeRow onOpen={() => setSelected(entry)} onDelete={() => remove(entry)}>
                      <RowContent entry={entry} />
                    </SwipeRow>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>
        ))}
      </AnimatePresence>

      <Sheet open={!!selected} onClose={() => setSelected(null)} label="Détail de la reconnaissance">
        {selected && <Detail entry={selected} onDelete={() => remove(selected)} />}
      </Sheet>
    </div>
  );
}

function RowContent({ entry }: { entry: HistoryEntry }) {
  const range = verseRangeLabel(entry.verseStart, entry.verseEnd);
  return (
    <div className="flex items-center gap-3.5 px-4 py-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand text-[15px] font-bold text-white">
        {entry.surah.number}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold">{entry.surah.transliteration}</p>
        <p className="truncate text-[14px] text-muted">
          {range ?? entry.surah.nameFrench} · {timeOf(entry.createdAt)}
          {entry.confidence === "medium" ? " · probable" : ""}
        </p>
      </div>
      <p lang="ar" dir="rtl" className="quran shrink-0 text-xl leading-none">
        {entry.surah.nameArabic}
      </p>
    </div>
  );
}

function SwipeRow({
  children,
  onOpen,
  onDelete,
}: {
  children: React.ReactNode;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const x = useMotionValue(0);
  const dragged = useRef(false);
  const actionOpacity = useTransform(x, [-REVEAL, -24, 0], [1, 0.4, 0]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const open = info.offset.x < -REVEAL / 2 || info.velocity.x < -500;
    if (info.offset.x < -REVEAL * 2) {
      onDelete();
      return;
    }
    animate(x, open ? -REVEAL : 0, { type: "spring", stiffness: 500, damping: 40 });
  };

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={onDelete}
        style={{ opacity: actionOpacity }}
        className="absolute inset-y-0 right-0 flex w-[92px] items-center justify-center bg-rose-500 text-[15px] font-semibold text-white"
        aria-label="Supprimer cette entrée"
      >
        Supprimer
      </motion.button>
      <motion.div
        role="button"
        tabIndex={0}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -REVEAL * 2.4, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={onDragEnd}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          if (x.get() < -4) animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
          else onOpen();
        }}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
        whileTap={{ backgroundColor: "rgba(127,127,127,0.08)" }}
        className="relative touch-pan-y bg-surface outline-none"
      >
        {children}
      </motion.div>
    </div>
  );
}

function Detail({ entry, onDelete }: { entry: HistoryEntry; onDelete: () => void }) {
  const date = new Date(entry.createdAt).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const range = verseRangeLabel(entry.verseStart, entry.verseEnd);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ConfidenceBadge level={entry.confidence} />
        <span className="text-xs text-muted">{date}</span>
      </div>
      <SurahHeader surah={entry.surah} />
      {range && <h3 className="text-[17px] font-semibold">{range}</h3>}
      {entry.verses.map((v) => (
        <VerseBlock key={v.number} verse={v} />
      ))}
      <Button variant="danger" onClick={onDelete}>
        Supprimer de l&apos;historique
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex animate-rise flex-col items-center rounded-3xl bg-surface px-6 py-12 text-center">
      <div className="flex h-16 items-end gap-1.5" aria-hidden>
        {[28, 46, 62, 40, 54, 30].map((h, i) => (
          <motion.span
            key={i}
            className="w-2.5 rounded-full bg-brand"
            initial={{ height: 8 }}
            animate={{ height: [h * 0.5, h, h * 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, repeatType: "mirror", delay: i * 0.12 }}
          />
        ))}
      </div>
      <h2 className="mt-6 text-xl font-bold tracking-tight">Aucune reconnaissance</h2>
      <p className="mt-1.5 max-w-xs text-[15px] text-muted">
        Les sourates que tu reconnais apparaîtront ici, classées par jour.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-brand px-6 font-semibold text-white active:scale-[0.97]"
      >
        Reconnaître une récitation
      </Link>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface" aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="h-11 w-11 animate-pulse rounded-2xl bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded-md bg-line" />
            <div className="h-3.5 w-1/3 animate-pulse rounded-md bg-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
