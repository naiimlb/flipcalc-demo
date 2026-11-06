import { vi } from 'vitest';
import { buildItems, newList } from '../src/lib/lists';
import { parseList } from '../src/lib/parser';
import type { ShoppingList, StoreId } from '../src/lib/types';

/** « Ouvre l'app » : modules rechargés (plus rien en mémoire), puis lecture du stockage, comme au lancement. */
export async function launchApp() {
  vi.resetModules();
  const store = await import('../src/state/store');
  const persistence = await import('../src/state/persistence');
  await store.hydrate();
  return { ...store, ...persistence };
}

export type App = Awaited<ReturnType<typeof launchApp>>;

export const EXEMPLE = `2 x Huile de friture 10L
Poulet pané 5kg x3
Cheddar tranches
4 Coca-Cola 33cl
Boîtes burger x500
Salade iceberg x6
Frites 2,5kg - 8
Sauce algérienne
Pain burger brioché x10
Liquide vaisselle`;

/** Crée une liste depuis un texte collé, avec les réglages courants (mots-clés + catégories mémorisées). */
export function createFromText(app: App, text: string, store: StoreId = 'metro-lomme'): ShoppingList {
  const { settings } = app.getState();
  const list = newList(store, buildItems(parseList(text), settings.keywords, settings.learned));
  app.actions.createList(list);
  return list;
}

export const itemOf = (app: App, listId: string, name: string) => {
  const it = app.getState().lists.find((l) => l.id === listId)?.items.find((i) => i.name.startsWith(name));
  if (!it) throw new Error(`Article introuvable : ${name}`);
  return it;
};

/** Contenu brut d'IndexedDB, lu avec le module de l'app actuellement « ouverte » (même connexion). */
export async function readStored() {
  return (await import('../src/state/db')).readAll();
}
