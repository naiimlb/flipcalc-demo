import type { Settings, ShoppingList } from '../lib/types';

/**
 * IndexedDB : une entrée par liste (une action ne réécrit que la liste touchée)
 * + un enregistrement « state » (révision, liste ouverte, ordre) et un « settings ».
 */
const DB_NAME = 'hb-courses';
const DB_VERSION = 1;

export interface StateMeta {
  schema: 2;
  /** Numéro de révision : s'incrémente à chaque action. Sert à départager IndexedDB et la copie localStorage. */
  rev: number;
  savedAt: number;
  activeId: string | null;
  listOrder: string[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('lists')) db.createObjectStore('lists', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('Ouverture IndexedDB impossible'));
    req.onblocked = () => reject(new Error('IndexedDB bloquée'));
  });
  dbPromise = p;
  p.catch(() => {
    if (dbPromise === p) dbPromise = null;
  });
  return p;
}

const asPromise = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const txDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
  });

export interface StoredData {
  lists: unknown[];
  meta: StateMeta | undefined;
  settings: unknown;
}

export async function readAll(): Promise<StoredData> {
  const db = await openDb();
  const tx = db.transaction(['lists', 'meta'], 'readonly');
  const lists = asPromise(tx.objectStore('lists').getAll());
  const meta = asPromise(tx.objectStore('meta').get('state'));
  const settings = asPromise(tx.objectStore('meta').get('settings'));
  const [l, m, s] = await Promise.all([lists, meta, settings]);
  return { lists: l, meta: m as StateMeta | undefined, settings: s };
}

export interface Changes {
  putLists: ShoppingList[];
  deleteIds: string[];
  /** Vider d'abord la table des listes (réécriture complète). */
  clearLists?: boolean;
  meta: StateMeta;
  /** Présent seulement si les réglages ont changé. */
  settings?: Settings;
}

/** Une seule transaction : tout est écrit, ou rien. */
export async function writeChanges(c: Changes): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(['lists', 'meta'], 'readwrite');
  const lists = tx.objectStore('lists');
  const meta = tx.objectStore('meta');
  if (c.clearLists) lists.clear();
  for (const id of c.deleteIds) lists.delete(id);
  for (const l of c.putLists) lists.put(l);
  meta.put(c.meta, 'state');
  if (c.settings) meta.put(c.settings, 'settings');
  await txDone(tx);
}
