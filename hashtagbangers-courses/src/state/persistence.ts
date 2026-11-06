import { useSyncExternalStore } from 'react';
import type { ShoppingList } from '../lib/types';
import { readAll, writeChanges, type Changes, type StateMeta } from './db';
import { DEFAULT_SETTINGS, sanitizeSnapshot, type AppState } from './snapshot';

/** Copie synchrone de tout l'état : filet de sécurité si iOS tue l'app avant la fin d'une écriture IndexedDB. */
const MIRROR_KEY = 'hb-courses:v2';
/** Ancien stockage (v1, localStorage seul) : lu une fois pour migrer, jamais effacé. */
const LEGACY_KEY = 'hb-courses:v1';

export type LoadSource = 'idb' | 'mirror' | 'legacy' | 'empty';

export interface Loaded {
  state: AppState;
  rev: number;
  source: LoadSource;
  /** IndexedDB est en retard (ou vide) par rapport à ce qui a été chargé : il faut la réécrire en entier. */
  needsRepair: boolean;
}

function readMirror(): { rev: number; state: AppState } | null {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const state = sanitizeSnapshot(data);
    if (!state) return null;
    return { rev: typeof data.rev === 'number' && Number.isFinite(data.rev) ? data.rev : 0, state };
  } catch {
    return null;
  }
}

function readLegacy(): AppState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? sanitizeSnapshot(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeMirror(state: AppState, rev: number, savedAt: number) {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify({ schema: 2, rev, savedAt, ...state }));
  } catch {
    /* stockage plein ou indisponible : IndexedDB reste la copie principale */
  }
}

function orderLists(lists: unknown[], order: string[]): unknown[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  const at = (l: unknown) => rank.get((l as ShoppingList).id) ?? Number.MAX_SAFE_INTEGER;
  return [...lists].sort((a, b) => at(a) - at(b));
}

/** Charge l'état : la révision la plus récente entre IndexedDB et la copie localStorage ; sinon migration v1. */
export async function loadPersisted(): Promise<Loaded> {
  let idb: { rev: number; state: AppState } | null = null;
  let idbReadable = true;
  try {
    const stored = await readAll();
    if (stored.meta) {
      const state = sanitizeSnapshot({
        lists: orderLists(stored.lists, stored.meta.listOrder ?? []),
        activeId: stored.meta.activeId,
        settings: stored.settings,
      });
      if (state) idb = { rev: stored.meta.rev, state };
    }
  } catch {
    idbReadable = false;
    setStatus({ idb: 'error' });
  }
  const mirror = readMirror();

  if (idb && (!mirror || idb.rev >= mirror.rev)) return { state: idb.state, rev: idb.rev, source: 'idb', needsRepair: false };
  if (mirror) return { state: mirror.state, rev: mirror.rev, source: 'mirror', needsRepair: idbReadable };

  const legacy = readLegacy();
  if (legacy) return { state: legacy, rev: 0, source: 'legacy', needsRepair: idbReadable };
  return { state: { lists: [], activeId: null, settings: DEFAULT_SETTINGS }, rev: 0, source: 'empty', needsRepair: false };
}

/* ---------- état de la sauvegarde (affiché dans Réglages) ---------- */

export interface SaveStatus {
  /** Date de la dernière écriture réussie dans IndexedDB. */
  savedAt: number | null;
  idb: 'pending' | 'ok' | 'error';
  /** Stockage persistant accordé par le navigateur (null = inconnu / non géré). */
  persisted: boolean | null;
}

let status: SaveStatus = { savedAt: null, idb: 'pending', persisted: null };
const statusListeners = new Set<() => void>();

function setStatus(patch: Partial<SaveStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}

export function getSaveStatus(): SaveStatus {
  return status;
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    getSaveStatus,
    getSaveStatus,
  );
}

/* ---------- écriture ---------- */

let queue: Promise<void> = Promise.resolve();
/** Une écriture a échoué : la prochaine réécrit tout (sinon un changement manqué pourrait rester perdu). */
let needFullWrite = false;

function metaOf(state: AppState, rev: number, savedAt: number): StateMeta {
  return { schema: 2, rev, savedAt, activeId: state.activeId, listOrder: state.lists.map((l) => l.id) };
}

function diff(prev: AppState, next: AppState, full: boolean): Changes {
  const savedAt = Date.now();
  const meta = metaOf(next, 0, savedAt);
  if (full) {
    return { putLists: next.lists, deleteIds: [], clearLists: true, meta, settings: next.settings };
  }
  const before = new Map(prev.lists.map((l) => [l.id, l]));
  const ids = new Set(next.lists.map((l) => l.id));
  return {
    putLists: next.lists.filter((l) => before.get(l.id) !== l),
    deleteIds: prev.lists.filter((l) => !ids.has(l.id)).map((l) => l.id),
    meta,
    settings: prev.settings !== next.settings ? next.settings : undefined,
  };
}

/**
 * Enregistre un changement IMMÉDIATEMENT (pas de délai) :
 * copie localStorage synchrone, puis transaction IndexedDB lancée dans la foulée.
 */
export function save(prev: AppState, next: AppState, rev: number, opts: { full?: boolean } = {}): void {
  const savedAt = Date.now();
  writeMirror(next, rev, savedAt);
  const changes = (full: boolean) => {
    const c = diff(prev, next, full);
    c.meta = metaOf(next, rev, savedAt);
    return c;
  };
  const wantFull = opts.full === true;
  queue = queue
    .then(async () => {
      const full = wantFull || needFullWrite;
      await writeChanges(changes(full));
      needFullWrite = false;
      setStatus({ savedAt, idb: 'ok' });
    })
    .catch(() => {
      needFullWrite = true;
      setStatus({ idb: 'error' });
    });
}

/** Résolue quand toutes les écritures lancées jusque-là sont terminées (tests, avant un export). */
export function whenSaved(): Promise<void> {
  return queue;
}

/** Demande au navigateur de ne pas purger les données du site. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage?.persist) {
      setStatus({ persisted: null });
      return null;
    }
    let ok = (await storage.persisted?.()) ?? false;
    if (!ok) ok = await storage.persist();
    setStatus({ persisted: ok });
    return ok;
  } catch {
    return null;
  }
}
