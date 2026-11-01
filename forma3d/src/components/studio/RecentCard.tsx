"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { RequestItem } from "@/lib/requests";
import { IconAlert, IconCheck, IconCube, Spinner } from "../icons";

const DAY = 86_400_000;

/**
 * Carte flottante « Dernières demandes » : frise de la semaine, chaque demande
 * est placée sur le jour de sa création, avec son statut.
 */
export function RecentCard({
  items,
  selectedId,
  onSelect,
  className = "",
}: {
  items: RequestItem[];
  selectedId: string | null;
  onSelect(id: string): void;
  className?: string;
}) {
  // Les dates dépendent de l'heure locale : calculées après le montage (pas d'écart d'hydratation).
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setToday(d.getTime());
  }, []);

  const days = today === null ? [] : Array.from({ length: 7 }, (_, i) => new Date(today - (6 - i) * DAY));
  const rows = items.slice(0, 5);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-[28px] bg-white p-5 shadow-float ring-1 ring-black/5 ${className}`}
      aria-label="Dernières demandes"
    >
      <h2 className="text-xl font-semibold tracking-tight">Dernières demandes</h2>
      <div className="mt-3 grid grid-cols-7 text-[11px] text-ink-mute">
        {days.map((d) => (
          <span key={d.getTime()} className="truncate">
            {d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")} {d.getDate()}
          </span>
        ))}
      </div>
      <ul className="mt-2 space-y-2.5">
        {rows.length === 0 && <li className="py-4 text-center text-xs text-ink-mute">Vos demandes apparaîtront ici.</li>}
        {rows.map((item, index) => {
          const created = new Date(item.createdAt);
          created.setHours(0, 0, 0, 0);
          const dayIndex = today === null ? 0 : Math.max(0, Math.min(6, 6 - Math.round((today - created.getTime()) / DAY)));
          // Décalage horizontal selon le jour, limité pour garder la pastille lisible.
          const offset = Math.min(dayIndex, 2.4) / 7;
          return (
            <motion.li
              key={item.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.08 }}
              className="relative"
            >
              <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={`relative flex max-w-full items-center gap-2 rounded-xl py-1.5 pl-2 pr-1.5 text-left transition ${
                  selectedId === item.id ? "bg-brand-accent/10 ring-1 ring-brand-accent/30" : "bg-paper hover:bg-brand-accent/5"
                }`}
                style={{ marginLeft: `${offset * 100}%`, maxWidth: `${100 - offset * 100}%` }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: `linear-gradient(135deg, ${item.design?.model.parts[0]?.color ?? "#5b6ee1"}, #ff5fb5)` }}
                >
                  <IconCube size={13} />
                </span>
                <span className="min-w-0 truncate text-[13px] font-medium">{item.title ?? item.prompt}</span>
                <StatusPill item={item} />
              </button>
            </motion.li>
          );
        })}
      </ul>
    </motion.aside>
  );
}

function StatusPill({ item }: { item: RequestItem }) {
  if (item.status === "processing") {
    return (
      <span className="chip ml-1 shrink-0 bg-brand-accent/10 text-brand-accent">
        <Spinner size={11} />
      </span>
    );
  }
  if (item.status === "error") {
    return (
      <span className="chip ml-1 shrink-0 bg-rose-500 text-white">
        <IconAlert size={11} />
      </span>
    );
  }
  return (
    <span className="chip ml-1 shrink-0 bg-brand-accent text-white">
      <IconCheck size={11} strokeWidth={2.6} /> {item.design?.model.parts.length ?? 0}
    </span>
  );
}
