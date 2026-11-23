"use client";

import { useSyncExternalStore } from "react";
import { defaultState } from "./samples";
import type { AppState } from "./types";

// Stockage local pour la maquette. Plus tard : remplacer ce fichier par des appels à l'API
// (les écrans ne parlent qu'à useAppState / updateState).
const KEY = "hb-rappels:v1";

let lastRaw: string | null | undefined;
let cache: AppState = defaultState();
const listeners = new Set<() => void>();

function parse(raw: string | null): AppState {
  if (!raw) return defaultState();
  try {
    const data = JSON.parse(raw) as Partial<AppState>;
    if (data.v === 1 && Array.isArray(data.tasks)) {
      return { ...defaultState(), ...data, v: 1 } as AppState;
    }
  } catch {
    /* données corrompues : on repart des exemples */
  }
  return defaultState();
}

function read(): AppState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* stockage indisponible */
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    cache = parse(raw);
  }
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** null pendant le rendu serveur / avant hydratation. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Ne garde que les 3 dernières semaines de suivi. */
function prune(map: Record<string, true>): Record<string, true> {
  const limit = new Date();
  limit.setDate(limit.getDate() - 21);
  const min = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, "0")}-${String(limit.getDate()).padStart(2, "0")}`;
  return Object.fromEntries(Object.entries(map).filter(([k]) => (k.split("@")[1] ?? "") >= min)) as Record<string, true>;
}

export function updateState(fn: (s: AppState) => AppState) {
  const next = fn(read());
  next.done = prune(next.done);
  next.notified = prune(next.notified);
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* quota / navigation privée : on garde au moins la session en mémoire */
  }
  lastRaw = raw;
  cache = next;
  listeners.forEach((l) => l());
}

export function resetToSamples() {
  updateState((s) => ({ ...defaultState(), role: s.role }));
}

// ----- Horloge : un tick toutes les 15 s, sans setState dans un effet. -----
const TICK = 15_000;
function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 5_000);
  const onVisible = () => cb();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Heure courante en ms (arrondie à 15 s), null côté serveur. */
export function useNowMs(): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => Math.floor(Date.now() / TICK) * TICK,
    () => null,
  );
}
