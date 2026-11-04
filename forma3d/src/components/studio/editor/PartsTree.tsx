"use client";

import { useEffect, useRef, useState } from "react";
import type { Design } from "@/lib/design/schema";
import { IconChevronDown, IconChevronRight, IconCopy, IconCube, IconTrash } from "../../icons";
import { useT } from "../../app/Preferences";
import { EmptyState, LoadingRegion, Skeleton } from "../../ui/Skeleton";

const eye = (open: boolean) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {open ? (
      <>
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1" />
    )}
  </svg>
);

/**
 * Arborescence des pièces : l'assemblage puis chaque pièce (sélection, masquer / afficher, renommer d'un double-clic,
 * dupliquer, supprimer). Flèches haut / bas pour passer d'une pièce à l'autre.
 */
export function PartsTree({
  design,
  selection,
  selectedIds,
  onSelect,
  hiddenIds,
  onToggleHidden,
  onRename,
  onDuplicate,
  onDelete,
  editable,
  loading = false,
}: {
  design: Design | null;
  selection: string | null;
  /** Sélection multiple (Maj / ⌘). */
  selectedIds?: string[];
  onSelect(id: string | null, additive?: boolean): void;
  hiddenIds: string[];
  onToggleHidden(id: string): void;
  onRename(id: string, name: string): void;
  onDuplicate(id: string): void;
  onDelete(id: string): void;
  editable: boolean;
  /** Une conception est en cours de génération : squelette au lieu de l'état vide. */
  loading?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const parts = design?.model.parts ?? [];

  // La pièce sélectionnée (dans la vue 3D) reste visible dans la liste.
  useEffect(() => {
    if (!selection) return;
    list.current?.querySelector<HTMLElement>(`[data-part="${CSS.escape(selection)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selection]);

  if (!design) {
    return (
      <section className="panel overflow-hidden p-1.5" aria-label={t("editor.parts")}>
        {loading ? (
          <LoadingRegion label={t("state.loading")} className="space-y-1.5 p-1.5">
            <Skeleton className="h-6 w-2/3" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </LoadingRegion>
        ) : (
          <EmptyState icon={<IconCube size={20} />} title={t("empty.parts.title")} hint={t("empty.parts.hint")} />
        )}
      </section>
    );
  }

  const move = (dir: 1 | -1) => {
    const index = parts.findIndex((p) => p.id === selection);
    const next = parts[(index + dir + parts.length) % parts.length];
    if (next) onSelect(next.id);
  };

  return (
    <section className="panel overflow-hidden p-1.5" aria-label={t("editor.parts")}>
      <div className="flex items-center gap-1 px-1.5 py-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="tap flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1 text-start text-[12.5px] font-semibold text-ink"
        >
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          <IconCube size={14} className="text-neon-blue" />
          <span className="truncate">{t("editor.assembly")}</span>
          <span className="ms-auto text-[11px] font-medium text-ink-mute">{parts.length}</span>
        </button>
      </div>
      {open && (
        <ul
          ref={list}
          role="tree"
          aria-label={t("editor.parts")}
          className="max-h-[42dvh] space-y-0.5 overflow-y-auto scrollbar-thin"
          onKeyDown={(e) => {
            if (renaming) return;
            if (e.key === "ArrowDown") move(1);
            else if (e.key === "ArrowUp") move(-1);
            else return;
            e.preventDefault();
          }}
        >
          {parts.map((part) => {
            const selected = selectedIds ? selectedIds.includes(part.id) : part.id === selection;
            const hidden = hiddenIds.includes(part.id);
            return (
              <li key={part.id} role="treeitem" aria-selected={selected} data-part={part.id} className={`group flex items-center gap-1 rounded-xl ps-5 pe-1 ${selected ? "bg-neon-blue/15" : "hover:bg-paper"}`}>
                <span aria-hidden className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: part.color }} />
                {renaming === part.id ? (
                  <input
                    autoFocus
                    defaultValue={part.name}
                    aria-label={t("editor.renamePart")}
                    className="input !h-8 !rounded-lg !px-2 !py-1 !text-[12px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onRename(part.id, e.currentTarget.value);
                        setRenaming(null);
                      } else if (e.key === "Escape") setRenaming(null);
                      e.stopPropagation();
                    }}
                    onBlur={(e) => {
                      onRename(part.id, e.currentTarget.value);
                      setRenaming(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
                      onSelect(selected && !additive && selectedIds?.length === 1 ? null : part.id, additive);
                    }}
                    onDoubleClick={() => editable && setRenaming(part.id)}
                    className={`tap flex min-h-9 min-w-0 flex-1 items-center gap-1.5 text-start text-[12px] ${hidden ? "text-ink-mute line-through" : selected ? "font-semibold text-ink" : "text-ink-soft"}`}
                    title={part.role || part.name}
                  >
                    <span className="truncate">{part.name}</span>
                    {part.locked && (
                      <span className="shrink-0 text-[10px]" aria-label={t("ops.locked")} title={t("ops.locked")}>
                        🔒
                      </span>
                    )}
                    {part.group && <span className="shrink-0 rounded bg-neon-violet/15 px-1 text-[9px] font-bold text-neon-violet">{t("ops.groupBadge")}</span>}
                    <span className="ms-auto shrink-0 text-[10px] text-ink-mute">{t(`shape.${part.shape}`)}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggleHidden(part.id)}
                  aria-pressed={hidden}
                  aria-label={hidden ? t("editor.show", { name: part.name }) : t("editor.hide", { name: part.name })}
                  className={`tap flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${hidden ? "text-ink-mute" : "text-ink-soft opacity-60 group-hover:opacity-100"} hover:bg-fg/10`}
                >
                  {eye(!hidden)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {editable && selection && (
        <div className="mt-1.5 flex gap-1.5 border-t border-line px-1 pt-2">
          <button type="button" onClick={() => setRenaming(selection)} className="btn-ghost tap flex-1 !px-2 !py-1.5 !text-[11px]">
            {t("editor.rename")}
          </button>
          <button type="button" onClick={() => onDuplicate(selection)} className="btn-ghost tap !px-2.5 !py-1.5 !text-[11px]" title={`${t("editor.duplicate")} (⌘D)`}>
            <IconCopy size={13} /> {t("editor.duplicate")}
          </button>
          <button
            type="button"
            onClick={() => onDelete(selection)}
            disabled={parts.length <= 1}
            className="btn tap !px-2.5 !py-1.5 !text-[11px] text-rose-500 hover:bg-rose-500/10"
            aria-label={`${t("editor.delete")} (⌫)`}
            title={`${t("editor.delete")} (⌫)`}
          >
            <IconTrash size={13} />
          </button>
        </div>
      )}
    </section>
  );
}
