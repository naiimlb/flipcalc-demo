import { CATEGORY_IDS, DEFAULT_KEYWORDS, DEFAULT_ORDER, type CategoryId, type KeywordDict } from '../lib/categories';
import { normalizeLearned } from '../lib/categorize';
import { uid } from '../lib/ids';
import { isStoreId, type Item, type Settings, type ShoppingList, type Theme } from '../lib/types';

/** Tout ce qui est sauvegardé : les listes, la liste ouverte et les réglages. */
export interface AppState {
  lists: ShoppingList[];
  /** Liste de courses affichée dans l'onglet Courses. */
  activeId: string | null;
  settings: Settings;
}

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

export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    keywords: sanitizeKeywords(r.keywords),
    order: sanitizeOrder(r.order),
    learned: normalizeLearned(r.learned),
    theme: r.theme === 'light' || r.theme === 'dark' || r.theme === 'auto' ? (r.theme as Theme) : 'auto',
    haptics: typeof r.haptics === 'boolean' ? r.haptics : true,
    managerPhone: typeof r.managerPhone === 'string' ? r.managerPhone : '',
    lastStore: isStoreId(r.lastStore) ? r.lastStore : 'metro-lomme',
  };
}

export const DEFAULT_SETTINGS: Settings = sanitizeSettings({});

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

function sanitizeItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = str(r.name)?.trim();
  if (!name) return null;
  const qty = Math.max(1, Math.min(9999, Math.round(num(r.qty, 1))));
  const taken = Math.max(0, Math.min(qty, Math.round(num(r.taken, 0))));
  const category = CATEGORY_IDS.includes(r.category as CategoryId) ? (r.category as CategoryId) : 'autres';
  return { id: str(r.id) ?? uid(), name, qty, taken, category };
}

export function sanitizeList(raw: unknown): ShoppingList | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const now = Date.now();
  const createdAt = num(r.createdAt, now);
  const kind = r.kind === 'manquants' ? 'manquants' : 'courses';
  const list: ShoppingList = {
    id: str(r.id) ?? uid(),
    kind,
    status: r.status === 'terminee' ? 'terminee' : kind === 'manquants' ? 'terminee' : 'en_cours',
    store: isStoreId(r.store) ? r.store : 'autre',
    createdAt,
    updatedAt: num(r.updatedAt, createdAt),
    items: (Array.isArray(r.items) ? r.items : []).map(sanitizeItem).filter((i): i is Item => i !== null),
  };
  const storeName = str(r.storeName);
  if (storeName) list.storeName = storeName;
  if (typeof r.finishedAt === 'number' && Number.isFinite(r.finishedAt)) list.finishedAt = r.finishedAt;
  const sourceId = str(r.sourceId);
  if (sourceId) list.sourceId = sourceId;
  if (Array.isArray(r.collapsed)) list.collapsed = r.collapsed.filter((c): c is CategoryId => CATEGORY_IDS.includes(c));
  return list;
}

/** Valide et nettoie un état lu depuis le stockage ou un fichier. Renvoie null si ce n'est pas un objet. */
export function sanitizeSnapshot(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const lists: ShoppingList[] = [];
  for (const l of Array.isArray(r.lists) ? r.lists : []) {
    const list = sanitizeList(l);
    if (!list || seen.has(list.id)) continue;
    seen.add(list.id);
    lists.push(list);
  }
  return {
    lists,
    activeId: typeof r.activeId === 'string' && seen.has(r.activeId) ? r.activeId : null,
    settings: sanitizeSettings(r.settings),
  };
}
