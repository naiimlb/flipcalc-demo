import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYWORDS } from '../src/lib/categories';
import { categorize, learn, normalizeLearned } from '../src/lib/categorize';
import { buildItems } from '../src/lib/lists';
import { productKey, productLabel } from '../src/lib/normalize';
import { parseList } from '../src/lib/parser';
import { createFromText, itemOf, launchApp } from './helpers';

describe('un même produit = une même clé', () => {
  it.each([
    ['Poulet pané 5kg', 'poulet pane'],
    ['poulet pane', 'poulet pane'],
    ['POULET PANÉ x3', 'poulet pane'],
    ['Poulets panés 2,5 kg', 'poulet pane'],
    ['3 x Poulet pané (x2)', 'poulet pane'],
    ['sauce algerienne 1L', 'sauce algerienne'],
    ['Sauce algérienne', 'sauce algerienne'],
    ['SAUCE ALGÉRIENNE 1 litre', 'sauce algerienne'],
    ['Coca-Cola 33cl', 'coca cola'],
    ['coca cola', 'coca cola'],
    ['Frites 2,5kg', 'frite'],
    ['Frites 5 kg x8', 'frite'],
    ['Œufs plein air x30', 'oeuf plein air'],
    ["Huile d'olive 1L", 'huile d olive'],
  ])('« %s » → %s', (name, key) => expect(productKey(name)).toBe(key));

  it('est idempotente', () => {
    for (const n of ['Poulets panés 5kg', 'Express', 'Coca-Cola 33cl', 'Boîtes burger x500', 'Pois chiches']) {
      expect(productKey(productKey(n))).toBe(productKey(n));
    }
  });

  it('deux produits différents restent différents', () => {
    expect(productKey('Sauce algérienne')).not.toBe(productKey('Sauce samouraï'));
    expect(productKey('Poulet pané')).not.toBe(productKey('Poulet rôti'));
  });

  it('nom lisible sans quantité ni format', () => {
    expect(productLabel('Poulet pané 5kg')).toBe('Poulet pané');
    expect(productLabel('2 x huile de friture 10L')).toBe('Huile de friture');
    expect(productLabel('sauce algerienne 1L')).toBe('Sauce algerienne');
  });
});

describe('changer la catégorie de « Sauce algérienne » (scénario demandé)', () => {
  it('« sauce algerienne 1L » dans une nouvelle liste tombe dans la catégorie choisie', async () => {
    const app = await launchApp();
    const first = createFromText(app, 'Sauce algérienne\nFrites 2,5kg x2');
    // Par défaut le dictionnaire la range dans « Sauces & Condiments ».
    expect(itemOf(app, first.id, 'Sauce algérienne').category).toBe('sauces');

    // Appui long > Changer de catégorie > Épicerie sèche.
    app.actions.editItem(first.id, itemOf(app, first.id, 'Sauce algérienne').id, { category: 'epicerie' });

    // Nouvelle liste, autre graphie, autre format : même produit.
    const second = createFromText(app, 'sauce algerienne 1L\nFrites 2,5kg');
    expect(itemOf(app, second.id, 'Sauce algerienne').category).toBe('epicerie');
    expect(itemOf(app, second.id, 'Frites').category).toBe('surgeles'); // le reste suit toujours le dictionnaire
  });

  it('la mémoire survit à la fermeture de l’app', async () => {
    const app = await launchApp();
    const list = createFromText(app, 'Sauce algérienne');
    app.actions.editItem(list.id, itemOf(app, list.id, 'Sauce').id, { category: 'epicerie' });
    await app.whenSaved();

    const reopened = await launchApp();
    const next = createFromText(reopened, 'Sauce algerienne 1L');
    expect(itemOf(reopened, next.id, 'Sauce').category).toBe('epicerie');
  });

  it('le choix de l’utilisateur est prioritaire sur le dictionnaire de mots-clés', async () => {
    const app = await launchApp();
    const l = createFromText(app, 'Cheddar tranches');
    expect(itemOf(app, l.id, 'Cheddar').category).toBe('fromages');
    app.actions.editItem(l.id, itemOf(app, l.id, 'Cheddar').id, { category: 'sauces' });
    expect(categorize('CHEDDAR tranches 1kg', DEFAULT_KEYWORDS, app.getState().settings.learned).category).toBe('sauces');
    expect(buildItems(parseList('Cheddar tranches 1kg'), DEFAULT_KEYWORDS, app.getState().settings.learned)[0].category).toBe('sauces');
  });

  it('ne mémorise rien si la catégorie ne change pas', async () => {
    const app = await launchApp();
    const l = createFromText(app, 'Sauce algérienne');
    app.actions.editItem(l.id, itemOf(app, l.id, 'Sauce').id, { qty: 4, category: 'sauces' });
    expect(app.getState().settings.learned).toEqual({});
  });
});

describe('renommer un article : la mémoire suit', () => {
  it('le classement mémorisé passe sous le nouveau nom, l’ancien est oublié', async () => {
    const app = await launchApp();
    const l = createFromText(app, 'Poulet pané 5kg');
    const id = itemOf(app, l.id, 'Poulet').id;
    app.actions.editItem(l.id, id, { category: 'surgeles' });
    expect(Object.keys(app.getState().settings.learned)).toEqual(['poulet pane']);

    app.actions.editItem(l.id, id, { name: 'Poulet crispy 5kg' });
    const learned = app.getState().settings.learned;
    expect(Object.keys(learned)).toEqual(['poulet crispy']);
    expect(learned['poulet crispy'].category).toBe('surgeles');

    const next = createFromText(app, 'poulet crispy');
    expect(itemOf(app, next.id, 'Poulet crispy').category).toBe('surgeles');
  });

  it('corriger seulement l’accent ou la casse ne change rien (même produit)', async () => {
    const app = await launchApp();
    const l = createFromText(app, 'Poulet pane 5kg');
    const id = itemOf(app, l.id, 'Poulet').id;
    app.actions.editItem(l.id, id, { category: 'surgeles' });
    app.actions.editItem(l.id, id, { name: 'POULET PANÉ 5kg' });
    expect(Object.keys(app.getState().settings.learned)).toEqual(['poulet pane']);
  });

  it('renommer + changer de catégorie en même temps mémorise le nouveau nom', async () => {
    const app = await launchApp();
    const l = createFromText(app, 'Truc mystère');
    const id = itemOf(app, l.id, 'Truc').id;
    app.actions.editItem(l.id, id, { name: 'Sauce maison', category: 'epicerie' });
    expect(app.getState().settings.learned['sauce maison'].category).toBe('epicerie');
  });

  it('renommer un produit non mémorisé ne crée aucune règle', async () => {
    const app = await launchApp();
    const l = createFromText(app, 'Cheddar tranches');
    app.actions.editItem(l.id, itemOf(app, l.id, 'Cheddar').id, { name: 'Cheddar fumé' });
    expect(app.getState().settings.learned).toEqual({});
  });

  it('le nom, la catégorie et la mémoire sont enregistrés en une seule écriture', async () => {
    const app = await launchApp();
    const l = createFromText(app, 'Poulet pané 5kg');
    app.actions.editItem(l.id, itemOf(app, l.id, 'Poulet').id, { name: 'Poulet crispy', category: 'surgeles' });
    await app.whenSaved();
    const reopened = await launchApp();
    expect(reopened.getState().lists[0].items[0]).toMatchObject({ name: 'Poulet crispy', category: 'surgeles' });
    expect(reopened.getState().settings.learned['poulet crispy'].category).toBe('surgeles');
  });
});

describe('Réglages > Mes catégories mémorisées', () => {
  it('liste, modifie, supprime un par un, et réinitialise (avec retour arrière)', async () => {
    const app = await launchApp();
    app.actions.learnCategory('Sauce algérienne 1L', 'epicerie');
    app.actions.learnCategory('Poulet pané 5kg', 'surgeles');
    const { learned } = app.getState().settings;
    expect(Object.values(learned).map((r) => r.name).sort()).toEqual(['Poulet pané', 'Sauce algérienne']);

    app.actions.setLearnedCategory('sauce algerienne', 'sauces');
    expect(app.getState().settings.learned['sauce algerienne'].category).toBe('sauces');

    app.actions.forgetLearned('poulet pane');
    expect(Object.keys(app.getState().settings.learned)).toEqual(['sauce algerienne']);

    const before = app.actions.forgetLearned(); // « Réinitialiser »
    expect(app.getState().settings.learned).toEqual({});
    app.actions.restoreLearned(before); // « Annuler »
    expect(Object.keys(app.getState().settings.learned)).toEqual(['sauce algerienne']);
  });

  it('modifier une clé inconnue ne fait rien', async () => {
    const app = await launchApp();
    app.actions.setLearnedCategory('nimporte quoi', 'boissons');
    expect(app.getState().settings.learned).toEqual({});
  });
});

describe('anciennes données (v1 : clé → catégorie)', () => {
  it('sont relues et re-clés sans perte', () => {
    const out = normalizeLearned({ 'poulet pane': 'surgeles', 'coca-cola': 'boissons', vide: 'inconnue', '': 'autres', '5kg': 'viandes' });
    expect(Object.keys(out).sort()).toEqual(['coca cola', 'poulet pane']);
    expect(out['coca cola']).toMatchObject({ category: 'boissons', at: 0 });
  });

  it('learn() range le nom lisible', () => {
    const r = learn({}, 'Poulet pané 5kg', 'surgeles', 42);
    expect(r['poulet pane']).toEqual({ category: 'surgeles', name: 'Poulet pané', at: 42 });
  });
});
