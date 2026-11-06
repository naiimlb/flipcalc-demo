import { describe, expect, it } from 'vitest';
import { parseLine, parseList } from '../src/lib/parser';

const EXEMPLE = `2 x Huile de friture 10L
Poulet pané 5kg x3
Cheddar tranches
4 Coca-Cola 33cl
Boîtes burger x500
Salade iceberg x6
Frites 2,5kg - 8
Sauce algérienne
Pain burger brioché x10
Liquide vaisselle`;

describe('parseList — liste d\'exemple', () => {
  it('extrait les 10 articles avec nom et quantité', () => {
    expect(parseList(EXEMPLE)).toEqual([
      { name: 'Huile de friture 10L', qty: 2 },
      { name: 'Poulet pané 5kg', qty: 3 },
      { name: 'Cheddar tranches', qty: 1 },
      { name: 'Coca-Cola 33cl', qty: 4 },
      { name: 'Boîtes burger', qty: 500 },
      { name: 'Salade iceberg', qty: 6 },
      { name: 'Frites 2,5kg', qty: 8 },
      { name: 'Sauce algérienne', qty: 1 },
      { name: 'Pain burger brioché', qty: 10 },
      { name: 'Liquide vaisselle', qty: 1 },
    ]);
  });
});

describe('parseLine — formats de quantité', () => {
  const cases: [string, string, number][] = [
    ['2 x Huile de friture 10L', 'Huile de friture 10L', 2],
    ['2x Huile 10L', 'Huile 10L', 2],
    ['2 × Huile 10L', 'Huile 10L', 2],
    ['x2 Huile 10L', 'Huile 10L', 2],
    ['Huile 10L x2', 'Huile 10L', 2],
    ['Huile 10L x 2', 'Huile 10L', 2],
    ['Huile 10L (x2)', 'Huile 10L', 2],
    ['Huile 10L 2x', 'Huile 10L', 2],
    ['Huile 10L - 2', 'Huile 10L', 2],
    ['Huile 10L : 2', 'Huile 10L', 2],
    ['Huile 10L (2)', 'Huile 10L', 2],
    ['Huile 10L 2 colis', 'Huile 10L', 2],
    ['Huile 10L 3 cartons', 'Huile 10L', 3],
    ['Huile 10L\t2', 'Huile 10L', 2],
    ['Huile 10L    2', 'Huile 10L', 2],
    ['Huile 10L; 2', 'Huile 10L', 2],
    ['Huile 10L Qté : 4', 'Huile 10L', 4],
    ['3 Cheddar tranches', 'Cheddar tranches', 3],
    ['Cheddar tranches', 'Cheddar tranches', 1],
    ['5 kg poulet', '5 kg poulet', 1],
    ['Coca-Cola 33cl x24', 'Coca-Cola 33cl', 24],
    ['Frites 2,5kg', 'Frites 2,5kg', 1],
  ];
  it.each(cases)('« %s » → %s ×%i', (line, name, qty) => {
    expect(parseLine(line)).toEqual({ name, qty });
  });
});

describe('parseLine — puces, numéros et prix', () => {
  const cases: [string, string, number][] = [
    ['- 2 x Huile 10L', 'Huile 10L', 2],
    ['• Sauce algérienne', 'Sauce algérienne', 1],
    ['* Frites 2,5kg x8', 'Frites 2,5kg', 8],
    ['1. Poulet pané 5kg x3', 'Poulet pané 5kg', 3],
    ['2) Cheddar tranches', 'Cheddar tranches', 1],
    ['☐ Liquide vaisselle', 'Liquide vaisselle', 1],
    ['[ ] Liquide vaisselle', 'Liquide vaisselle', 1],
    ['2 x Huile de friture 10L 25,99 €', 'Huile de friture 10L', 2],
    ['2 x Huile de friture 10L - 25,99€ HT', 'Huile de friture 10L', 2],
    ['Huile de friture 10L €25.99 x2', 'Huile de friture 10L', 2],
    ['Huile de friture 10L 25,99 x2', 'Huile de friture 10L', 2],
    ['Huile de friture 10L\t25,99 €\t2', 'Huile de friture 10L', 2],
    ['sauce samouraï', 'Sauce samouraï', 1],
  ];
  it.each(cases)('« %s » → %s ×%i', (line, name, qty) => {
    expect(parseLine(line)).toEqual({ name, qty });
  });
});

describe('parseLine — lignes ignorées', () => {
  it.each([
    '',
    '   ',
    'Total : 245,80 €',
    'TOTAL TTC 245,80',
    'Sous-total 120,00 €',
    'TVA 5,5% 12,30',
    'Montant HT : 200,00 €',
    'Ma liste Métro',
    'Liste de courses',
    'Panier (10 articles)',
    '10 articles',
    'Métro',
    'Salamarket :',
    'Boissons :',
    '-----------',
    '25,99 €',
    '12',
    'Produit | Quantité | Prix',
    'Désignation\tQté\tPrix',
    'Livraison : gratuite',
  ])('ignore « %s »', (line) => {
    expect(parseLine(line)).toBeNull();
  });
});

describe('parseList — robustesse', () => {
  it('ignore en-têtes, totaux et lignes vides au milieu d\'une vraie liste', () => {
    const txt = `Ma liste Métro\n\n- 2 x Huile 10L\n\n• Frites 2,5kg x8\nTotal : 99,90 €\n`;
    expect(parseList(txt)).toEqual([
      { name: 'Huile 10L', qty: 2 },
      { name: 'Frites 2,5kg', qty: 8 },
    ]);
  });

  it('gère les fins de ligne Windows', () => {
    expect(parseList('Frites x2\r\nCheddar\r\n')).toEqual([
      { name: 'Frites', qty: 2 },
      { name: 'Cheddar', qty: 1 },
    ]);
  });

  it('applique « Quantité : 3 » sur sa propre ligne au produit précédent', () => {
    const txt = `Huile de friture 10L\nQuantité : 3\n25,99 €\nFrites 2,5kg\nx2`;
    expect(parseList(txt)).toEqual([
      { name: 'Huile de friture 10L', qty: 3 },
      { name: 'Frites 2,5kg', qty: 2 },
    ]);
  });

  it('fusionne les doublons en additionnant les quantités', () => {
    expect(parseList('Frites x2\nfrites x3')).toEqual([{ name: 'Frites', qty: 5 }]);
  });

  it('met la première lettre en majuscule', () => {
    expect(parseList('cheddar tranches')).toEqual([{ name: 'Cheddar tranches', qty: 1 }]);
  });
});
