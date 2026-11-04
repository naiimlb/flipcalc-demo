"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditHistory } from "@/lib/design/edit";
import { validateDesign, type Design } from "@/lib/design/schema";
import type { RequestItem } from "@/lib/requests";

/** État de la sauvegarde automatique, affiché dans la barre du haut. */
export type SaveState = "idle" | "pending" | "saving" | "saved" | "local" | "error";

const LOCAL_PREFIX = "forma3d:edit:";
const SAVE_DELAY = 1200;

function readLocal(id: string): Design | null {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + id);
    if (!raw) return null;
    const v = validateDesign(JSON.parse(raw));
    return v.ok ? v.design : null;
  } catch {
    return null;
  }
}
function writeLocal(id: string, design: Design | null) {
  try {
    if (design) localStorage.setItem(LOCAL_PREFIX + id, JSON.stringify(design));
    else localStorage.removeItem(LOCAL_PREFIX + id);
  } catch {
    // stockage plein ou bloqué : la modification reste en mémoire
  }
}

/**
 * Modifications de la conception affichée : historique illimité (annuler / rétablir, par projet)
 * et sauvegarde automatique — dans le compte quand c'est possible, sinon sur cet appareil.
 */
export function useDesignEditor({
  item,
  items,
  cloud,
  apply,
  onSaved,
}: {
  item: RequestItem | null;
  items: RequestItem[];
  /** Le projet peut être enregistré dans le compte (connecté, projet terminé, pas un exemple). */
  cloud: (item: RequestItem) => boolean;
  /** Remplace la conception d'un projet dans l'état de l'éditeur. */
  apply(id: string, design: Design): void;
  /** Conception enregistrée en ligne (le fichier 3D sera régénéré). */
  onSaved(id: string): void;
}) {
  const histories = useRef(new Map<string, EditHistory>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef(new Map<string, Design>());
  const cloudOff = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const history = (id: string) => {
    let h = histories.current.get(id);
    if (!h) {
      h = new EditHistory();
      histories.current.set(id, h);
    }
    return h;
  };

  const persist = useCallback(
    async (target: RequestItem, design: Design, keepalive = false) => {
      if (!cloud(target) || cloudOff.current) {
        writeLocal(target.id, design);
        setSaveState("local");
        setSavedAt(Date.now());
        return;
      }
      setSaveState("saving");
      try {
        const res = await fetch(`/api/requests/${target.id}/design`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ design }),
          keepalive,
        });
        if (res.ok) {
          writeLocal(target.id, null);
          setSaveState("saved");
          setSavedAt(Date.now());
          onSaved(target.id);
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { code?: string };
        if (body.code === "edit_unavailable") cloudOff.current = true;
        // En ligne impossible (script SQL absent, quota, réseau) : gardé sur l'appareil, renvoyé plus tard.
        writeLocal(target.id, design);
        setSaveState(body.code === "edit_unavailable" ? "local" : "error");
        setSavedAt(Date.now());
      } catch {
        writeLocal(target.id, design);
        setSaveState("error");
      }
    },
    [cloud, onSaved],
  );

  const schedule = useCallback(
    (target: RequestItem, design: Design) => {
      latest.current.set(target.id, design);
      const previous = timers.current.get(target.id);
      if (previous) clearTimeout(previous);
      setSaveState("pending");
      timers.current.set(
        target.id,
        setTimeout(() => {
          timers.current.delete(target.id);
          latest.current.delete(target.id);
          void persist(target, design);
        }, SAVE_DELAY),
      );
    },
    [persist],
  );

  /** Applique une modification (avec une clé pour regrouper les frappes successives d'un même champ). */
  const edit = useCallback(
    (change: (design: Design) => Design, key: string | null = null) => {
      if (!item?.design || item.status !== "ready") return;
      const next = change(item.design);
      if (next === item.design) return;
      history(item.id).record(item.design, key);
      apply(item.id, next);
      schedule(item, next);
      bump();
    },
    [item, apply, schedule],
  );

  const undo = useCallback(() => {
    if (!item?.design) return;
    const previous = history(item.id).undo(item.design);
    if (!previous) return;
    apply(item.id, previous);
    schedule(item, previous);
    bump();
  }, [item, apply, schedule]);

  const redo = useCallback(() => {
    if (!item?.design) return;
    const next = history(item.id).redo(item.design);
    if (!next) return;
    apply(item.id, next);
    schedule(item, next);
    bump();
  }, [item, apply, schedule]);

  /** Enregistre tout de suite (Cmd/Ctrl + S, fermeture de la page). */
  const flush = useCallback(
    (keepalive = false) => {
      for (const [id, timer] of timers.current) {
        clearTimeout(timer);
        const design = latest.current.get(id);
        const target = items.find((i) => i.id === id);
        if (design && target) void persist(target, design, keepalive);
      }
      timers.current.clear();
      latest.current.clear();
    },
    [items, persist],
  );

  useEffect(() => {
    const onHide = () => flush(true);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  // Modifications gardées sur l'appareil (hors ligne ou sauvegarde en ligne indisponible) : réappliquées à l'ouverture.
  const restored = useRef(new Set<string>());
  useEffect(() => {
    for (const i of items) {
      if (restored.current.has(i.id) || !i.design || i.status !== "ready") continue;
      restored.current.add(i.id);
      const local = readLocal(i.id);
      if (!local || JSON.stringify(local) === JSON.stringify(i.design)) continue;
      apply(i.id, local);
      if (cloud(i)) schedule(i, local);
    }
  }, [items, apply, cloud, schedule]);

  // Le statut affiché suit le projet ouvert.
  useEffect(() => {
    setSaveState((s) => (s === "saving" || s === "pending" ? s : "idle"));
  }, [item?.id]);

  const h = item ? histories.current.get(item.id) : undefined;
  return {
    edit,
    undo,
    redo,
    flush,
    canUndo: Boolean(h?.canUndo),
    canRedo: Boolean(h?.canRedo),
    saveState,
    savedAt,
    pending: saveState === "pending" || saveState === "saving",
  };
}
