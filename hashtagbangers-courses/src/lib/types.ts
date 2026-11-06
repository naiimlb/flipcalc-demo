import type { CategoryId, KeywordDict } from './categories';
import type { LearnedRules } from './categorize';

export type StoreId = 'metro' | 'salamarket' | 'autre';

export const STORES: Record<StoreId, string> = {
  metro: 'Métro',
  salamarket: 'Salamarket',
  autre: 'Autre',
};

export interface Item {
  id: string;
  name: string;
  /** Quantité demandée. */
  qty: number;
  /** Quantité réellement prise en magasin. */
  taken: number;
  category: CategoryId;
}

export type ListKind = 'courses' | 'manquants';
export type ListStatus = 'en_cours' | 'terminee';

export interface ShoppingList {
  id: string;
  kind: ListKind;
  status: ListStatus;
  store: StoreId;
  /** Nom libre quand le magasin est « Autre ». */
  storeName?: string;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  items: Item[];
  /** Pour une liste de manquants : la liste de courses d'origine. */
  sourceId?: string;
}

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  keywords: KeywordDict;
  order: CategoryId[];
  learned: LearnedRules;
  theme: Theme;
  haptics: boolean;
  /** Numéro WhatsApp du responsable (facultatif), format international sans « + ». */
  managerPhone: string;
}
