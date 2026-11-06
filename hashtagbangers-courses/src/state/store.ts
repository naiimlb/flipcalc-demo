import { useSyncExternalStore } from 'react';
import { CATEGORY_IDS, DEFAULT_KEYWORDS, DEFAULT_ORDER, type CategoryId, type KeywordDict } from '../lib/categories';
import { learn } from '../lib/categorize';
import { uid } from '../lib/ids';
import { cloneAsCourses, finishList, type FinishResult } from '../lib/lists';
import type { Item, Settings, ShoppingList } from '../lib/types';

export interface AppState {
  lists: ShoppingList[];
  /** Liste de courses affichée dans l'onglet Courses. */
  activeId: string | null;
  settings: Settings;
}

const STORAGE_KEY = 'hb-courses:v1';

export const DEFAULT_SETTINGS: Settings = {
  keywords: DEFAULT_KEYWORDS,
  order: DEFAULT_ORDER,
  learned: {},
  theme: 'auto',
  haptics: true,
  managerPhone: '',
};

function sanitizeOrder(order: unknown): CategoryId[] {
  const list = Array.isArray(order) ? order.filter((c): c is CategoryId => CATEGORY_IDS.includes(c)) : [];
  const unique = [...new Set(list)];
  return [...unique, ...DEFAULT_ORDER.filter((c) => !unique.includes(c))];
}

function sanitizeKeywords(dict: unknown): KeywordDict {
  const out = { ...DEFAULT_KEYWORDS };
  if (dict && typeof dict === 'object') {
    for (const c of CATEGORY_IDS) {
      const v = (dict as Record<string, unknown>)[c];
      if (Array.isArray(v)) out[c] = v.filter((k): k is string => typeof k === 'string');
    }
  }
  return out;
}

function load(): AppState {
  const empty: AppState = { lists: [], activeId: null, settings: DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw) as Partial<AppState>;
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) } as Settings;
    settings.order = sanitizeOrder(settings.order);
    settings.keywords = sanitizeKeywords(settings.keywords);
    const lists = Array.isArray(data.lists) ? data.lists : [];
    const activeId = lists.some((l) => l.id === data.activeId) ? (data.activeId ?? null) : null;
    return { lists, activeId, settings };
  } catch {
    return empty;
  }
}

let state: AppState = typeof localStorage === 'undefined' ? { lists: [], activeId: null, settings: DEFAULT_SETTINGS } : load();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

function persist() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* stockage plein ou indisponible : on garde l'état en mémoire */
    }
  }, 150);
}

if (typeof window !== 'undefined') {
  // Sauvegarde immédiate quand l'app passe en arrière-plan (iOS peut la tuer sans prévenir).
  const flush = () => {
    window.clearTimeout(saveTimer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  };
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  window.addEventListener('pagehide', flush);
}

function set(updater: (s: AppState) => AppState) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

export function getState(): AppState {
  return state;
}

export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state),
  );
}

function touch(list: ShoppingList): ShoppingList {
  return { ...list, updatedAt: Date.now() };
}

function updateList(id: string, fn: (l: ShoppingList) => ShoppingList) {
  set((s) => ({ ...s, lists: s.lists.map((l) => (l.id === id ? touch(fn(l)) : l)) }));
}

function updateItem(listId: string, itemId: string, fn: (it: Item) => Item) {
  updateList(listId, (l) => ({ ...l, items: l.items.map((it) => (it.id === itemId ? fn(it) : it)) }));
}

export const actions = {
  createList(list: ShoppingList) {
    set((s) => ({ ...s, lists: [list, ...s.lists], activeId: list.id }));
  },
  openList(id: string) {
    set((s) => ({
      ...s,
      activeId: id,
      lists: s.lists.map((l) => (l.id === id && l.kind === 'courses' ? { ...l, status: 'en_cours', finishedAt: undefined } : l)),
    }));
  },
  closeActive() {
    set((s) => ({ ...s, activeId: null }));
  },
  duplicateList(id: string): ShoppingList | null {
    const src = state.lists.find((l) => l.id === id);
    if (!src) return null;
    const copy = cloneAsCourses(src);
    set((s) => ({ ...s, lists: [copy, ...s.lists] }));
    return copy;
  },
  /** Nouvelle liste de courses à partir des manquants, ouverte dans l'onglet Courses. */
  coursesFromList(id: string): ShoppingList | null {
    const src = state.lists.find((l) => l.id === id);
    if (!src) return null;
    const copy = cloneAsCourses(src);
    set((s) => ({ ...s, lists: [copy, ...s.lists], activeId: copy.id }));
    return copy;
  },
  deleteList(id: string) {
    set((s) => ({ ...s, lists: s.lists.filter((l) => l.id !== id), activeId: s.activeId === id ? null : s.activeId }));
  },
  restoreList(list: ShoppingList, index: number) {
    set((s) => {
      const lists = [...s.lists];
      lists.splice(Math.min(index, lists.length), 0, list);
      return { ...s, lists };
    });
  },
  finish(id: string): FinishResult | null {
    const list = state.lists.find((l) => l.id === id);
    if (!list) return null;
    const result = finishList(list);
    set((s) => ({
      ...s,
      activeId: null,
      lists: [
        ...(result.missing ? [result.missing] : []),
        ...s.lists.map((l) => (l.id === id ? result.finished : l)),
      ],
    }));
    return result;
  },

  toggleItem(listId: string, itemId: string) {
    updateItem(listId, itemId, (it) => ({ ...it, taken: it.taken >= it.qty ? 0 : it.qty }));
  },
  setTaken(listId: string, itemId: string, taken: number) {
    updateItem(listId, itemId, (it) => ({ ...it, taken: Math.max(0, Math.min(it.qty, taken)) }));
  },
  editItem(listId: string, itemId: string, patch: Partial<Pick<Item, 'name' | 'qty' | 'category'>>) {
    const list = state.lists.find((l) => l.id === listId);
    const item = list?.items.find((i) => i.id === itemId);
    if (!item) return;
    const next = { ...item, ...patch };
    next.qty = Math.max(1, Math.min(9999, Math.round(next.qty)));
    next.taken = Math.min(next.taken, next.qty);
    if (patch.category && patch.category !== item.category) actions.learnCategory(next.name, patch.category);
    updateItem(listId, itemId, () => next);
  },
  addItem(listId: string, item: Omit<Item, 'id' | 'taken'>): Item {
    const full: Item = { ...item, id: uid(), taken: 0 };
    updateList(listId, (l) => ({ ...l, items: [...l.items, full] }));
    return full;
  },
  deleteItem(listId: string, itemId: string): { item: Item; index: number } | null {
    const list = state.lists.find((l) => l.id === listId);
    const index = list?.items.findIndex((i) => i.id === itemId) ?? -1;
    if (!list || index < 0) return null;
    const item = list.items[index];
    updateList(listId, (l) => ({ ...l, items: l.items.filter((i) => i.id !== itemId) }));
    return { item, index };
  },
  restoreItem(listId: string, item: Item, index: number) {
    updateList(listId, (l) => {
      const items = [...l.items];
      items.splice(Math.min(index, items.length), 0, item);
      return { ...l, items };
    });
  },
  setStore(listId: string, store: ShoppingList['store'], storeName?: string) {
    updateList(listId, (l) => ({ ...l, store, storeName: store === 'autre' ? storeName : undefined }));
  },

  learnCategory(name: string, category: CategoryId) {
    set((s) => ({ ...s, settings: { ...s.settings, learned: learn(s.settings.learned, name, category) } }));
  },
  forgetLearned(key?: string) {
    set((s) => {
      if (!key) return { ...s, settings: { ...s.settings, learned: {} } };
      const learned = { ...s.settings.learned };
      delete learned[key];
      return { ...s, settings: { ...s.settings, learned } };
    });
  },
  updateSettings(patch: Partial<Settings>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },
  setKeywords(category: CategoryId, keywords: string[]) {
    set((s) => ({ ...s, settings: { ...s.settings, keywords: { ...s.settings.keywords, [category]: keywords } } }));
  },
  resetKeywords() {
    set((s) => ({ ...s, settings: { ...s.settings, keywords: DEFAULT_KEYWORDS } }));
  },
  resetAll() {
    set(() => ({ lists: [], activeId: null, settings: DEFAULT_SETTINGS }));
  },
};
