"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RequestItem, RequestStatus } from "@/lib/requests";
import { IconCube, IconSearch, IconTrash } from "../icons";
import { formatDateTime } from "./format";
import { StatusChip } from "./ui";

const FILTERS: { id: RequestStatus | "all"; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "ready", label: "Prêtes" },
  { id: "processing", label: "En cours" },
  { id: "error", label: "Erreurs" },
];

export function HistoryTab({
  items,
  selectedId,
  onOpen,
  onDelete,
  canDelete,
}: {
  items: RequestItem[];
  selectedId: string | null;
  onOpen(id: string): void;
  onDelete(id: string): void;
  canDelete: boolean;
}) {
  const [filter, setFilter] = useState<RequestStatus | "all">("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr-FR");
    return items.filter(
      (i) =>
        (filter === "all" || i.status === filter) &&
        (!q || `${i.title ?? ""} ${i.prompt}`.toLocaleLowerCase("fr-FR").includes(q)),
    );
  }, [items, filter, query]);

  return (
    <div className="flex h-full min-h-[380px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-full border border-line bg-white px-3 py-2">
          <IconSearch size={14} className="text-ink-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer l'historique…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-mute"
          />
        </div>
        <div className="flex gap-1 rounded-full bg-paper p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === f.id ? "bg-white text-ink shadow-soft" : "text-ink-mute"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        {visible.length === 0 && <li className="py-10 text-center text-sm text-ink-mute">Aucune demande.</li>}
        <AnimatePresence initial={false}>
          {visible.map((item) => (
            <motion.li
              key={item.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={`panel flex items-center gap-3 p-3 ${selectedId === item.id ? "ring-2 ring-brand-accent/40" : ""}`}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{
                  background: `linear-gradient(135deg, ${item.design?.model.parts[0]?.color ?? "#5b6ee1"}, #7b5ce6)`,
                }}
              >
                <IconCube size={18} />
              </span>
              <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{item.title ?? item.prompt}</p>
                <p className="truncate text-xs text-ink-mute">{item.prompt}</p>
                <p className="mt-0.5 text-[11px] text-ink-mute">
                  {formatDateTime(item.createdAt)}
                  {item.sample ? " · exemple" : item.provider === "demo" ? " · modèle d'exemple" : ""}
                </p>
              </button>
              <StatusChip status={item.status} />
              {canDelete && !item.sample && (
                <button
                  type="button"
                  aria-label="Supprimer"
                  onClick={() => {
                    if (confirm("Supprimer définitivement cette demande ?")) onDelete(item.id);
                  }}
                  className="icon-btn hover:!border-rose-200 hover:!text-rose-600"
                >
                  <IconTrash size={14} />
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
