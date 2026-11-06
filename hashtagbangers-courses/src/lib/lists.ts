import { CATEGORIES, type CategoryId, type KeywordDict } from './categories';
import { categorize, type LearnedRules } from './categorize';
import { uid } from './ids';
import type { ParsedLine } from './parser';
import { STORES, type Item, type ShoppingList, type StoreId } from './types';

export type ItemState = 'todo' | 'partial' | 'done';

export function itemState(item: Item): ItemState {
  if (item.taken >= item.qty) return 'done';
  if (item.taken > 0) return 'partial';
  return 'todo';
}

export function missingQty(item: Item): number {
  return Math.max(0, item.qty - item.taken);
}

export interface ListStats {
  /** Articles dont une quantité a été prise (même partiellement). */
  taken: number;
  /** Articles dont il manque encore au moins une unité. */
  missing: number;
  total: number;
}

export function listStats(items: Item[]): ListStats {
  return {
    taken: items.filter((it) => it.taken > 0).length,
    missing: items.filter((it) => missingQty(it) > 0).length,
    total: items.length,
  };
}

export function buildItems(lines: ParsedLine[], dict: KeywordDict, learned: LearnedRules): Item[] {
  return lines.map((l) => ({
    id: uid(),
    name: l.name,
    qty: l.qty,
    taken: 0,
    category: categorize(l.name, dict, learned).category,
  }));
}

export function newList(store: StoreId, items: Item[], storeName?: string, now = Date.now()): ShoppingList {
  return {
    id: uid(),
    kind: 'courses',
    status: 'en_cours',
    store,
    storeName: store === 'autre' ? storeName?.trim() || undefined : undefined,
    createdAt: now,
    updatedAt: now,
    items,
  };
}

export function storeLabel(list: Pick<ShoppingList, 'store' | 'storeName'>): string {
  if (list.store === 'autre') return list.storeName?.trim() || '';
  return STORES[list.store];
}

export interface Progress {
  done: number;
  partial: number;
  total: number;
  /** 0..1, les prises partielles comptent au prorata. */
  ratio: number;
}

export function progress(items: Item[]): Progress {
  let done = 0;
  let partial = 0;
  let sum = 0;
  for (const it of items) {
    const s = itemState(it);
    if (s === 'done') done++;
    else if (s === 'partial') partial++;
    sum += it.qty > 0 ? Math.min(1, it.taken / it.qty) : 1;
  }
  return { done, partial, total: items.length, ratio: items.length ? sum / items.length : 0 };
}

export interface CategoryGroup {
  category: CategoryId;
  items: Item[];
}

/**
 * Regroupe par catégorie dans l'ordre du parcours magasin.
 * Dans chaque catégorie : articles à prendre, puis partiels, puis complets en bas
 * (ordre d'import conservé à l'intérieur de chaque état).
 */
export function groupByCategory(items: Item[], order: CategoryId[], sortDone = true): CategoryGroup[] {
  const rank: Record<ItemState, number> = { todo: 0, partial: 0, done: 1 };
  const known = new Set(order);
  const fullOrder = [...order, ...(Object.keys(CATEGORIES) as CategoryId[]).filter((c) => !known.has(c))];
  return fullOrder
    .map((category) => {
      const inCat = items
        .map((item, i) => ({ item, i }))
        .filter(({ item }) => item.category === category);
      if (sortDone) inCat.sort((a, b) => rank[itemState(a.item)] - rank[itemState(b.item)] || a.i - b.i);
      return { category, items: inCat.map(({ item }) => item) };
    })
    .filter((g) => g.items.length > 0);
}

/** Articles manquants (demandé − pris > 0), avec la quantité restante comme nouvelle quantité. */
export function missingItems(items: Item[]): Item[] {
  return items
    .filter((it) => missingQty(it) > 0)
    .map((it) => ({ ...it, id: uid(), qty: missingQty(it), taken: 0 }));
}

export interface FinishResult {
  finished: ShoppingList;
  missing: ShoppingList | null;
  takenCount: number;
  missingCount: number;
}

/** Termine une liste de courses et crée la liste des manquants s'il en reste. */
export function finishList(list: ShoppingList, now = Date.now()): FinishResult {
  const finished: ShoppingList = { ...list, status: 'terminee', finishedAt: now, updatedAt: now };
  const missing = missingItems(list.items);
  const takenCount = listStats(list.items).taken;
  return {
    finished,
    takenCount,
    missingCount: missing.length,
    missing: missing.length
      ? {
          id: uid(),
          kind: 'manquants',
          status: 'terminee',
          store: list.store,
          storeName: list.storeName,
          createdAt: now,
          updatedAt: now,
          finishedAt: now,
          items: missing,
          sourceId: list.id,
        }
      : null,
  };
}

/** Nouvelle liste de courses à partir d'une liste (manquants ou ancienne liste) : tout est remis à 0. */
export function cloneAsCourses(list: ShoppingList, now = Date.now()): ShoppingList {
  return {
    ...newList(list.store, list.items.map((it) => ({ ...it, id: uid(), taken: 0 })), list.storeName, now),
  };
}
