import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYWORDS, DEFAULT_ORDER } from '../src/lib/categories';
import { buildItems, finishList, groupByCategory, itemState, newList, progress } from '../src/lib/lists';
import { buildMissingMessage, whatsappUrl } from '../src/lib/message';
import { parseList } from '../src/lib/parser';

const NOW = new Date(2026, 10, 6, 18, 30).getTime();

function sample() {
  const items = buildItems(
    parseList('Poulet pané x3\nFrites 2,5kg x2\nCheddar tranches x4\nCoca-Cola 33cl x2'),
    DEFAULT_KEYWORDS,
    {},
  );
  return newList('metro', items, undefined, NOW);
}

describe('états d\'un article', () => {
  it('à prendre / partiel / complet', () => {
    const base = { id: 'a', name: 'X', qty: 5, taken: 0, category: 'autres' as const };
    expect(itemState(base)).toBe('todo');
    expect(itemState({ ...base, taken: 2 })).toBe('partial');
    expect(itemState({ ...base, taken: 5 })).toBe('done');
  });
});

describe('fin des courses', () => {
  it('manquant = demandé − pris, seulement si > 0', () => {
    const list = sample();
    list.items[0].taken = 0; // poulet : manque 3
    list.items[1].taken = 0; // frites : manque 2
    list.items[2].taken = 4; // cheddar : complet
    list.items[3].taken = 1; // coca : manque 1
    const r = finishList(list, NOW);
    expect(r.finished.status).toBe('terminee');
    expect(r.takenCount).toBe(2);
    expect(r.missingCount).toBe(3);
    expect(r.missing?.kind).toBe('manquants');
    expect(r.missing?.store).toBe('metro');
    expect(r.missing?.items.map((i) => [i.name, i.qty, i.taken])).toEqual([
      ['Poulet pané', 3, 0],
      ['Frites 2,5kg', 2, 0],
      ['Coca-Cola 33cl', 1, 0],
    ]);
  });

  it('rien ne manque → pas de liste de manquants', () => {
    const list = sample();
    list.items.forEach((i) => (i.taken = i.qty));
    expect(finishList(list, NOW).missing).toBeNull();
  });

  it('message au format attendu', () => {
    const list = sample();
    list.items[2].taken = 4;
    list.items[3].taken = 2;
    const { missing } = finishList(list, NOW);
    expect(buildMissingMessage(missing!, DEFAULT_ORDER)).toBe(
      ['🛒 Manquants Métro – 06/11', '🥩 Viandes & Poulet\n• Poulet pané x3', '🧊 Surgelés\n• Frites 2,5kg x2'].join('\n\n'),
    );
  });

  it('magasin « Autre » avec ou sans nom', () => {
    const l = { ...sample(), store: 'autre' as const, storeName: 'Promocash', finishedAt: NOW };
    expect(buildMissingMessage(l, DEFAULT_ORDER).split('\n')[0]).toBe('🛒 Manquants Promocash – 06/11');
    expect(buildMissingMessage({ ...l, storeName: undefined }, DEFAULT_ORDER).split('\n')[0]).toBe('🛒 Manquants – 06/11');
  });
});

describe('regroupement et progression', () => {
  it('ordre du parcours magasin et articles complets en bas', () => {
    const items = buildItems(parseList('Frites\nSurgelé mystère\nCheddar\nCoca'), DEFAULT_KEYWORDS, {});
    items[0].taken = 1;
    const groups = groupByCategory(items, DEFAULT_ORDER);
    expect(groups.map((g) => g.category)).toEqual(['boissons', 'fromages', 'surgeles']);
    expect(groups[2].items.map((i) => i.name)).toEqual(['Surgelé mystère', 'Frites']);
  });

  it('progression au prorata', () => {
    const list = sample();
    list.items[0].taken = 3;
    list.items[1].taken = 1;
    const p = progress(list.items);
    expect(p).toMatchObject({ done: 1, partial: 1, total: 4 });
    expect(p.ratio).toBeCloseTo((1 + 0.5) / 4);
  });
});

describe('WhatsApp', () => {
  it('sans numéro', () => expect(whatsappUrl('a b')).toBe('https://wa.me/?text=a%20b'));
  it('numéro français national', () => expect(whatsappUrl('x', '06 12 34 56 78')).toBe('https://wa.me/33612345678?text=x'));
  it('numéro international', () => expect(whatsappUrl('x', '+33 6 12 34 56 78')).toBe('https://wa.me/33612345678?text=x'));
});
