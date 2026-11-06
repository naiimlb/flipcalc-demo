import { describe, expect, it, vi } from 'vitest';
import { createFromText, EXEMPLE, itemOf, launchApp, readStored } from './helpers';

const MIRROR = 'hb-courses:v2';
const LEGACY = 'hb-courses:v1';

describe('fermer et rouvrir l’app en plein milieu des courses', () => {
  it('rien n’est perdu : coches, quantités, ajout, suppression, catégorie, rayons repliés, liste ouverte', async () => {
    const app = await launchApp();
    const list = createFromText(app, EXEMPLE, 'metro-wattrelos');
    const id = list.id;

    app.actions.toggleItem(id, itemOf(app, id, 'Huile').id); // coché : tout pris
    app.actions.setTaken(id, itemOf(app, id, 'Frites').id, 3); // prise partielle 3/8
    app.actions.setTaken(id, itemOf(app, id, 'Coca').id, 2);
    app.actions.deleteItem(id, itemOf(app, id, 'Liquide vaisselle').id); // supprimé
    app.actions.addItem(id, { name: 'Nuggets 1kg', qty: 4, category: 'surgeles' }); // ajouté à la main
    app.actions.editItem(id, itemOf(app, id, 'Sauce algérienne').id, { category: 'epicerie' }); // catégorie changée
    app.actions.editItem(id, itemOf(app, id, 'Boîtes burger').id, { name: 'Boîtes burger kraft', qty: 600 }); // renommé
    app.actions.toggleCollapsed(id, 'boissons');
    app.actions.updateSettings({ managerPhone: '06 12 34 56 78', theme: 'dark' });

    const before = structuredClone(app.getState());
    await app.whenSaved();

    // L'app est fermée (plus rien en mémoire), puis rouverte.
    const reopened = await launchApp();
    expect(reopened.getState()).toEqual(before);
    expect(reopened.getState().activeId).toBe(id);
    expect(reopened.getState().lists[0].store).toBe('metro-wattrelos');
    expect(itemOf(reopened, id, 'Frites')).toMatchObject({ taken: 3, qty: 8 });
    expect(itemOf(reopened, id, 'Sauce algérienne').category).toBe('epicerie');
    expect(reopened.getState().lists[0].collapsed).toEqual(['boissons']);
    expect(() => itemOf(reopened, id, 'Liquide')).toThrow();
  });

  it('un changement fait juste avant la fermeture est déjà sur le téléphone (sans attendre, sans bouton)', async () => {
    const app = await launchApp();
    const list = createFromText(app, 'Frites x8\nCheddar tranches');
    app.actions.toggleItem(list.id, itemOf(app, list.id, 'Cheddar').id);
    // Aucun await : la copie synchrone contient déjà la coche.
    const mirror = JSON.parse(localStorage.getItem(MIRROR) as string);
    expect(mirror.lists[0].items.find((i: { name: string }) => i.name === 'Cheddar tranches').taken).toBe(1);

    // iOS tue l'app avant la fin de l'écriture IndexedDB : on rouvre immédiatement.
    const reopened = await launchApp();
    expect(itemOf(reopened, list.id, 'Cheddar').taken).toBe(1);
  });

  it('chaque action est écrite dans IndexedDB, une liste à la fois', async () => {
    const app = await launchApp();
    const a = createFromText(app, 'Frites x2');
    const b = createFromText(app, 'Cheddar x3');
    app.actions.setTaken(a.id, itemOf(app, a.id, 'Frites').id, 1);
    await app.whenSaved();
    const stored = await readStored();
    expect(stored.meta?.listOrder).toEqual([b.id, a.id]); // la plus récente en premier
    expect(stored.meta?.activeId).toBe(b.id);
    const storedA = (stored.lists as { id: string; items: { taken: number }[] }[]).find((l) => l.id === a.id);
    expect(storedA?.items[0].taken).toBe(1);
  });

  it('supprimer une liste la retire d’IndexedDB', async () => {
    const app = await launchApp();
    const a = createFromText(app, 'Frites');
    createFromText(app, 'Cheddar');
    app.actions.deleteList(a.id);
    await app.whenSaved();
    expect(((await readStored()).lists as { id: string }[]).map((l) => l.id)).not.toContain(a.id);
    const reopened = await launchApp();
    expect(reopened.getState().lists).toHaveLength(1);
  });

  it('terminer les courses : liste terminée + manquants archivés avec leur statut', async () => {
    const app = await launchApp();
    const list = createFromText(app, 'Frites x8\nCheddar x2\nCoca x4');
    app.actions.toggleItem(list.id, itemOf(app, list.id, 'Cheddar').id);
    app.actions.setTaken(list.id, itemOf(app, list.id, 'Frites').id, 3);
    const result = app.actions.finish(list.id);
    expect(result).toMatchObject({ takenCount: 2, missingCount: 2 });
    await app.whenSaved();

    const reopened = await launchApp();
    const lists = reopened.getState().lists;
    expect(lists.map((l) => [l.kind, l.status])).toEqual([
      ['manquants', 'terminee'],
      ['courses', 'terminee'],
    ]);
    expect(lists[0].items.map((i) => [i.name, i.qty])).toEqual([
      ['Frites', 5],
      ['Coca', 4],
    ].map(([n, q]) => [expect.stringContaining(n as string), q]));
    expect(reopened.getState().activeId).toBeNull();
  });
});

describe('deux copies : IndexedDB + copie localStorage', () => {
  it('si IndexedDB est en retard, la copie la plus récente gagne puis IndexedDB est réparée', async () => {
    const app = await launchApp();
    const list = createFromText(app, 'Frites x8');
    await app.whenSaved();

    // IndexedDB tombe en panne : l'action suivante n'atteint que la copie localStorage.
    const realIdb = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });
    const broken = await launchApp();
    broken.actions.setTaken(list.id, itemOf(broken, list.id, 'Frites').id, 5);
    await broken.whenSaved();
    expect(broken.getSaveStatus().idb).toBe('error');

    // IndexedDB revient : on rouvre. La coche (5/8) est retrouvée et IndexedDB est remise à jour.
    Object.defineProperty(globalThis, 'indexedDB', { value: realIdb, configurable: true, writable: true });
    const repaired = await launchApp();
    expect(itemOf(repaired, list.id, 'Frites').taken).toBe(5);
    await repaired.whenSaved();
    const stored = (await readStored()).lists as { items: { taken: number }[] }[];
    expect(stored[0].items[0].taken).toBe(5);

    // Même sans la copie localStorage, tout est dans IndexedDB.
    localStorage.removeItem(MIRROR);
    const again = await launchApp();
    expect(itemOf(again, list.id, 'Frites').taken).toBe(5);
  });

  it('sans IndexedDB du tout, tout est conservé grâce à la copie localStorage', async () => {
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });
    const app = await launchApp();
    const list = createFromText(app, EXEMPLE);
    app.actions.toggleItem(list.id, itemOf(app, list.id, 'Salade').id);
    const before = structuredClone(app.getState());
    const reopened = await launchApp();
    expect(reopened.getState()).toEqual(before);
  });

  it('une copie illisible est ignorée sans planter', async () => {
    localStorage.setItem(MIRROR, '{pas du json');
    const app = await launchApp();
    expect(app.getState().lists).toEqual([]);
  });

  it('une écriture IndexedDB qui a échoué est rattrapée à l’action suivante (réécriture complète)', async () => {
    const app = await launchApp();
    const a = createFromText(app, 'Frites');
    await app.whenSaved();
    const real = globalThis.indexedDB;
    Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });
    const flaky = await launchApp();
    const b = createFromText(flaky, 'Cheddar'); // échoue côté IndexedDB
    await flaky.whenSaved();
    expect(flaky.getSaveStatus().idb).toBe('error');

    Object.defineProperty(globalThis, 'indexedDB', { value: real, configurable: true, writable: true });
    const back = await launchApp(); // reprend depuis la copie, réécrit tout
    back.actions.setTaken(a.id, itemOf(back, a.id, 'Frites').id, 1);
    await back.whenSaved();
    localStorage.removeItem(MIRROR);
    const final = await launchApp();
    expect(final.getState().lists.map((l) => l.id).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('migration depuis la v1 (localStorage seul)', () => {
  it('reprend les listes, les réglages et les catégories apprises, sans toucher à l’ancienne copie', async () => {
    const legacy = {
      lists: [
        {
          id: 'l1', kind: 'courses', status: 'en_cours', store: 'metro', createdAt: 1000, updatedAt: 2000,
          items: [{ id: 'i1', name: 'Poulet pané 5kg', qty: 3, taken: 1, category: 'surgeles' }],
        },
      ],
      activeId: 'l1',
      settings: { theme: 'dark', haptics: false, managerPhone: '0612345678', order: ['boissons'], learned: { 'poulet pane': 'surgeles' } },
    };
    localStorage.setItem(LEGACY, JSON.stringify(legacy));

    const app = await launchApp();
    const s = app.getState();
    expect(s.lists[0]).toMatchObject({ id: 'l1', store: 'metro', status: 'en_cours' });
    expect(s.lists[0].items[0]).toMatchObject({ taken: 1, qty: 3, category: 'surgeles' });
    expect(s.activeId).toBe('l1');
    expect(s.settings).toMatchObject({ theme: 'dark', haptics: false, managerPhone: '0612345678' });
    expect(s.settings.learned['poulet pane']).toMatchObject({ category: 'surgeles' });
    expect(s.settings.order[0]).toBe('boissons');
    expect(s.settings.order).toHaveLength(11);

    await app.whenSaved();
    expect(localStorage.getItem(LEGACY)).toBe(JSON.stringify(legacy)); // jamais effacée : retour arrière possible
    expect(((await readStored()).lists as unknown[]).length).toBe(1); // copiée dans IndexedDB

    const reopened = await launchApp(); // les lancements suivants lisent IndexedDB
    expect(reopened.getState()).toEqual(s);
  });
});

describe('stockage persistant', () => {
  it('demande navigator.storage.persist() au lancement', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { storage: { persist, persisted: async () => false } });
    try {
      const app = await launchApp();
      await vi.waitFor(() => expect(app.getSaveStatus().persisted).toBe(true));
      expect(persist).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ne redemande pas si c’est déjà accordé, et gère un refus', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { storage: { persist, persisted: async () => true } });
    let app = await launchApp();
    await vi.waitFor(() => expect(app.getSaveStatus().persisted).toBe(true));
    expect(persist).not.toHaveBeenCalled();

    vi.stubGlobal('navigator', { storage: { persist: async () => false, persisted: async () => false } });
    app = await launchApp();
    await vi.waitFor(() => expect(app.getSaveStatus().persisted).toBe(false));
    vi.unstubAllGlobals();
  });

  it('un navigateur sans API de stockage ne casse rien', async () => {
    vi.stubGlobal('navigator', {});
    try {
      const app = await launchApp();
      await vi.waitFor(() => expect(app.getSaveStatus().persisted).toBeNull());
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
