import { describe, expect, it } from 'vitest';
import { backupFileName, buildBackup, parseBackup } from '../src/lib/backup';
import { createFromText, EXEMPLE, itemOf, launchApp } from './helpers';

describe('exporter / importer ses données', () => {
  it('aller-retour complet : listes, historique, réglages et catégories mémorisées', async () => {
    const app = await launchApp();
    const list = createFromText(app, EXEMPLE, 'salamarket');
    app.actions.toggleItem(list.id, itemOf(app, list.id, 'Huile').id);
    app.actions.editItem(list.id, itemOf(app, list.id, 'Sauce').id, { category: 'epicerie' });
    app.actions.finish(list.id);
    app.actions.updateSettings({ managerPhone: '0612345678' });
    const state = app.getState();

    const text = JSON.stringify(buildBackup(state, 1_700_000_000_000));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.state).toEqual(state);
    expect(parsed.listCount).toBe(2);
    expect(parsed.learnedCount).toBe(1);
    expect(parsed.exportedAt).toBe(1_700_000_000_000);
  });

  it('nouveau téléphone : importer restaure tout, et la mémoire des catégories continue de marcher', async () => {
    const old = await launchApp();
    const list = createFromText(old, 'Sauce algérienne\nFrites x8');
    old.actions.editItem(list.id, itemOf(old, list.id, 'Sauce').id, { category: 'epicerie' });
    old.actions.setTaken(list.id, itemOf(old, list.id, 'Frites').id, 3);
    const file = JSON.stringify(buildBackup(old.getState()));

    // Téléphone neuf : stockage vide.
    localStorage.clear();
    globalThis.indexedDB = new (await import('fake-indexeddb')).IDBFactory();
    const fresh = await launchApp();
    expect(fresh.getState().lists).toEqual([]);

    const parsed = parseBackup(file);
    if (!parsed.ok) throw new Error(parsed.error);
    fresh.actions.replaceState(parsed.state);
    await fresh.whenSaved();

    const reopened = await launchApp();
    expect(reopened.getState().lists).toHaveLength(1);
    expect(itemOf(reopened, list.id, 'Frites')).toMatchObject({ taken: 3, qty: 8 });
    const next = createFromText(reopened, 'sauce algerienne 1L');
    expect(itemOf(reopened, next.id, 'Sauce').category).toBe('epicerie');
  });

  it('« Annuler » après un import remet l’état précédent', async () => {
    const app = await launchApp();
    createFromText(app, 'Frites');
    const mine = structuredClone(app.getState());
    const prev = app.actions.replaceState({ ...mine, lists: [], activeId: null });
    expect(app.getState().lists).toEqual([]);
    app.actions.replaceState(prev);
    expect(app.getState()).toEqual(mine);
  });

  it.each([
    ['pas du json', /illisible/],
    ['{"foo":1}', /pas une sauvegarde/],
    ['[]', /pas une sauvegarde/],
    ['null', /pas une sauvegarde/],
    ['{"app":"autre-app","lists":[]}', /pas une sauvegarde/],
    ['{"app":"hashtagbangers-courses"}', /pas une sauvegarde/],
    ['{"app":"hashtagbangers-courses","version":99,"lists":[]}', /plus récente/],
  ])('refuse %s', (text, error) => {
    const r = parseBackup(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(error);
  });

  it('un fichier abîmé est nettoyé : quantités, catégories, magasins, doublons', () => {
    const r = parseBackup(
      JSON.stringify({
        app: 'hashtagbangers-courses',
        version: 2,
        activeId: 'inexistante',
        lists: [
          {
            id: 'a', store: 'magasin-inconnu', status: 'bizarre', createdAt: 5,
            items: [
              { id: 'x', name: 'Frites', qty: -4, taken: 99, category: 'nimporte' },
              { name: '   ', qty: 2 },
              { id: 'y', name: 'Cheddar', qty: 1e9, taken: 1.4 },
              null,
              'texte',
            ],
          },
          { id: 'a', items: [] },
          'pas une liste',
        ],
        settings: { theme: 'fluo', learned: { 'Poulet pané 5kg': 'surgeles', x: 'faux' }, order: ['boissons', 'boissons', 'zzz'] },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.lists).toHaveLength(1);
    const l = r.state.lists[0];
    expect(l).toMatchObject({ store: 'autre', status: 'en_cours', kind: 'courses', updatedAt: 5 });
    expect(l.items).toEqual([
      { id: 'x', name: 'Frites', qty: 1, taken: 1, category: 'autres' },
      { id: 'y', name: 'Cheddar', qty: 9999, taken: 1, category: 'autres' },
    ]);
    expect(r.state.activeId).toBeNull();
    expect(r.state.settings.theme).toBe('auto');
    expect(r.state.settings.order.slice(0, 2)).toEqual(['boissons', 'emballages']);
    expect(Object.keys(r.state.settings.learned)).toEqual(['poulet pane']);
  });

  it('nom du fichier : date du jour', () => {
    expect(backupFileName(new Date(2026, 10, 6, 12).getTime())).toBe('hashtagbangers-courses-2026-11-06.json');
  });
});
