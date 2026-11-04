"use client";

import { useT } from "../app/Preferences";
import { useMemo, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import type { RequestItem, RequestStatus } from "@/lib/requests";
import { IconCube, IconSearch, IconTrash } from "../icons";
import { formatDateTime } from "./format";
import { StatusChip } from "./ui";

const FILTERS: { id: RequestStatus | "all"; label: "history.all" | "history.ready" | "history.processing" | "history.errors" }[] = [
  { id: "all", label: "history.all" },
  { id: "ready", label: "history.ready" },
  { id: "processing", label: "history.processing" },
  { id: "error", label: "history.errors" },
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
  const t = useT();
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
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
          <IconSearch size={14} className="text-ink-mute" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.filter")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-mute"
          />
        </div>
        <div className="flex gap-1 rounded-md bg-paper p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${filter === f.id ? "bg-surface text-ink ring-1 ring-line" : "text-ink-mute"}`}
            >
              {t(f.label)}
            </button>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
        {visible.length === 0 && <li className="py-10 text-center text-sm text-ink-mute">{t("history.empty")}</li>}
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-paper" style={{ color: item.design?.model.parts[0]?.color ?? "rgb(var(--ink-mute))" }}>
                <IconCube size={16} />
              </span>
              <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{item.title ?? item.prompt}</p>
                <p className="truncate text-xs text-ink-mute">{item.prompt}</p>
                <p className="mt-0.5 text-xs text-ink-mute">
                  {formatDateTime(item.createdAt)}
                  {item.sample ? " · exemple" : item.provider === "demo" ? " · modèle d'exemple" : ""}
                </p>
              </button>
              <StatusChip status={item.status} />
              {canDelete && !item.sample && (
                <button
                  type="button"
                  aria-label={t("history.delete")}
                  onClick={() => {
                    if (confirm("Supprimer définitivement cette demande ?")) onDelete(item.id);
                  }}
                  className="icon-btn hover:!border-danger/30 hover:!text-danger"
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
