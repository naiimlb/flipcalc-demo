import { useSyncExternalStore } from 'react';
import { DEFAULT_KEYWORDS, type CategoryId } from '../lib/categories';
import { forget, learn, type LearnedRules } from '../lib/categorize';
import { uid } from '../lib/ids';
import { cloneAsCourses, finishList, type FinishResult } from '../lib/lists';
import { productKey } from '../lib/normalize';
import type { Item, Settings, ShoppingList } from '../lib/types';
import { loadPersisted, requestPersistence, save } from './persistence';
import { DEFAULT_SETTINGS, type AppState } from './snapshot';

export { DEFAULT_SETTINGS, type AppState } from './snapshot';

let state: AppState = { lists: [], activeId: null, settings: DEFAULT_SETTINGS };
/** Numéro de révision : +1 à chaque action enregistrée. */
let rev = 0;
let hydration: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/**
 * Charge l'état sauvegardé (IndexedDB, copie localStorage ou ancien stockage v1).
 * À attendre avant d'afficher l'app. Sans effet si déjà fait.
 */
export function hydrate(): Promise<void> {
  hydration ??= (async () => {
    const loaded = await loadPersisted();
    state = loaded.state;
    rev = loaded.rev;
    if (loaded.source === 'legacy' || loaded.needsRepair) {
      // Migration v1 → IndexedDB, ou IndexedDB en retard sur la copie : réécriture complète.
      rev += 1;
      save(state, state, rev, { full: true });
    }
    notify();
    void requestPersistence();
  })();
  return hydration;
}

/** Enregistre l'état courant tel quel (après un import, par exemple). */
function set(updater: (s: AppState) => AppState) {
  const prev = state;
  const next = updater(prev);
  if (next === prev) return;
  state = next;
  rev += 1;
  save(prev, next, rev); // immédiat : pas de bouton « Sauvegarder », pas de délai
  notify();
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

function mapList(s: AppState, id: string, fn: (l: ShoppingList) => ShoppingList, bump = true): AppState {
  return { ...s, lists: s.lists.map((l) => (l.id === id ? (bump ? touch(fn(l)) : fn(l)) : l)) };
}

function updateList(id: string, fn: (l: ShoppingList) => ShoppingList) {
  set((s) => mapList(s, id, fn));
}

function updateItem(listId: string, itemId: string, fn: (it: Item) => Item) {
  updateList(listId, (l) => ({ ...l, items: l.items.map((it) => (it.id === itemId ? fn(it) : it)) }));
}

function withLearned(s: AppState, learned: LearnedRules): AppState {
  return learned === s.settings.learned ? s : { ...s, settings: { ...s.settings, learned } };
}

export const actions = {
  createList(list: ShoppingList) {
    set((s) => ({ ...s, lists: [list, ...s.lists], activeId: list.id, settings: { ...s.settings, lastStore: list.store } }));
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
      lists: [...(result.missing ? [result.missing] : []), ...s.lists.map((l) => (l.id === id ? result.finished : l))],
    }));
    return result;
  },

  toggleItem(listId: string, itemId: string) {
    updateItem(listId, itemId, (it) => ({ ...it, taken: it.taken >= it.qty ? 0 : it.qty }));
  },
  setTaken(listId: string, itemId: string, taken: number) {
    updateItem(listId, itemId, (it) => ({ ...it, taken: Math.max(0, Math.min(it.qty, taken)) }));
  },
  /**
   * Renomme / change la quantité / change la catégorie, en UNE seule écriture avec la mémoire des catégories :
   * - changer de catégorie mémorise le choix pour ce produit ;
   * - renommer un produit dont le classement est mémorisé fait suivre la mémoire sous le nouveau nom.
   */
  editItem(listId: string, itemId: string, patch: Partial<Pick<Item, 'name' | 'qty' | 'category'>>) {
    const item = state.lists.find((l) => l.id === listId)?.items.find((i) => i.id === itemId);
    if (!item) return;
    const next: Item = { ...item, ...patch };
    next.qty = Math.max(1, Math.min(9999, Math.round(next.qty)));
    next.taken = Math.min(next.taken, next.qty);

    set((s) => {
      let learned = s.settings.learned;
      const oldKey = productKey(item.name);
      const newKey = productKey(next.name);
      const renamed = oldKey !== newKey;
      const categoryChanged = next.category !== item.category;
      const followed = renamed && !!learned[oldKey];
      if (categoryChanged || followed) {
        learned = learn(learned, next.name, next.category);
        if (followed) learned = forget(learned, oldKey);
      }
      const updated = mapList(s, listId, (l) => ({ ...l, items: l.items.map((it) => (it.id === itemId ? next : it)) }));
      return withLearned(updated, learned);
    });
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
    set((s) => ({
      ...mapList(s, listId, (l) => ({ ...l, store, storeName: store === 'autre' ? storeName : undefined })),
      settings: { ...s.settings, lastStore: store },
    }));
  },
  /** Replie / déplie un rayon (mémorisé avec la liste, sans modifier sa date de mise à jour). */
  toggleCollapsed(listId: string, category: CategoryId) {
    set((s) =>
      mapList(
        s,
        listId,
        (l) => {
          const cur = new Set(l.collapsed ?? []);
          if (cur.has(category)) cur.delete(category);
          else cur.add(category);
          return { ...l, collapsed: [...cur] };
        },
        false,
      ),
    );
  },

  /* ----- mémoire des catégories ----- */
  learnCategory(name: string, category: CategoryId) {
    set((s) => withLearned(s, learn(s.settings.learned, name, category)));
  },
  /** Change la catégorie d'un produit déjà mémorisé (depuis les Réglages). */
  setLearnedCategory(key: string, category: CategoryId) {
    set((s) => {
      const rule = s.settings.learned[key];
      if (!rule) return s;
      return withLearned(s, { ...s.settings.learned, [key]: { ...rule, category, at: Date.now() } });
    });
  },
  /** Oublie un produit ; sans argument, oublie tout. Renvoie l'état précédent (pour « Annuler »). */
  forgetLearned(key?: string): LearnedRules {
    const prev = state.settings.learned;
    set((s) => withLearned(s, key ? forget(s.settings.learned, key) : {}));
    return prev;
  },
  restoreLearned(learned: LearnedRules) {
    set((s) => withLearned(s, learned));
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
  /** Remplace tout l'état (import d'une sauvegarde). Renvoie l'état précédent (pour « Annuler »). */
  replaceState(next: AppState): AppState {
    const prev = state;
    set(() => next);
    return prev;
  },
  resetAll() {
    set(() => ({ lists: [], activeId: null, settings: DEFAULT_SETTINGS }));
  },
};
