import type { CategoryId, KeywordDict } from './categories';
import type { LearnedRules } from './categorize';

/** « metro » = ancien choix unique (listes créées avant l'ajout des deux Metro), conservé pour l'affichage. */
export type StoreId = 'metro-lomme' | 'metro-wattrelos' | 'salamarket' | 'autre' | 'metro';

export const STORES: Record<StoreId, string> = {
  'metro-lomme': 'Metro Lomme',
  'metro-wattrelos': 'Metro Wattrelos',
  salamarket: 'Salamarket',
  autre: 'Autre',
  metro: 'Métro',
};

/** Magasins proposés pour une nouvelle liste. */
export const STORE_CHOICES: StoreId[] = ['metro-lomme', 'metro-wattrelos', 'salamarket', 'autre'];

export function isStoreId(v: unknown): v is StoreId {
  return typeof v === 'string' && v in STORES;
}

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
  /** Rayons repliés dans l'écran Courses (conservés si l'app est fermée en plein milieu). */
  collapsed?: CategoryId[];
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
  /** Dernier magasin choisi, proposé par défaut pour la prochaine liste. */
  lastStore: StoreId;
}
