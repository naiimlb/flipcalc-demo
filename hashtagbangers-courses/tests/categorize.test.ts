import { describe, expect, it } from 'vitest';
import { DEFAULT_KEYWORDS, type CategoryId } from '../src/lib/categories';
import { categorize, learn } from '../src/lib/categorize';
import { normalize, productKey } from '../src/lib/normalize';
import { parseList } from '../src/lib/parser';

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

const cat = (name: string) => categorize(name, DEFAULT_KEYWORDS).category;

describe('liste d\'exemple : tout est bien classé', () => {
  const expected: Record<string, CategoryId> = {
    'Huile de friture 10L': 'epicerie',
    'Poulet pané 5kg': 'viandes',
    'Cheddar tranches': 'fromages',
    'Coca-Cola 33cl': 'boissons',
    'Boîtes burger': 'emballages',
    'Salade iceberg': 'legumes',
    'Frites 2,5kg': 'surgeles',
    'Sauce algérienne': 'sauces',
    'Pain burger brioché': 'pains',
    'Liquide vaisselle': 'hygiene',
  };
  const parsed = parseList(EXEMPLE);
  it('10 articles détectés', () => expect(parsed).toHaveLength(10));
  it.each(parsed.map((p) => [p.name, expected[p.name]] as const))('%s → %s', (name, category) => {
    expect(cat(name)).toBe(category);
  });
});

describe('classement d\'autres produits courants', () => {
  it.each<[string, CategoryId]>([
    ['Nuggets de poulet 1kg', 'surgeles'],
    ['Potatoes surgelées', 'surgeles'],
    ['Steak haché 45g', 'viandes'],
    ['Escalopes de dinde', 'viandes'],
    ['Ketchup Heinz 5kg', 'sauces'],
    ['Mayonnaise seau', 'sauces'],
    ['Pot de sauce 30ml', 'emballages'],
    ['Gobelets carton 50cl', 'emballages'],
    ['Serviettes kraft', 'emballages'],
    ['Sacs kraft', 'emballages'],
    ['Sacs poubelle 100L', 'hygiene'],
    ['Eau de javel', 'hygiene'],
    ['Essuie-tout', 'hygiene'],
    ['Eau minérale Cristaline', 'boissons'],
    ['Ice Tea pêche', 'boissons'],
    ['Oasis tropical', 'boissons'],
    ['Tomates grappe', 'legumes'],
    ['Oignons rouges', 'legumes'],
    ['Mozzarella râpée', 'fromages'],
    ['Œufs plein air', 'fromages'],
    ['Crème glacée vanille', 'surgeles'],
    ['Tortillas wraps 30cm', 'pains'],
    ['Pains burger sésame', 'pains'],
    ['Riz basmati', 'epicerie'],
    ['Chapelure', 'epicerie'],
    ['Trucmuche inconnu', 'autres'],
  ])('%s → %s', (name, category) => expect(cat(name)).toBe(category));
});

describe('insensible aux accents et à la casse', () => {
  it.each(['BOÎTES BURGER', 'boites burger', 'Boites Burger', 'boÎtes'])('%s → emballages', (n) =>
    expect(cat(n)).toBe('emballages'),
  );
  it('SAUCE ALGÉRIENNE / sauce algerienne', () => {
    expect(cat('SAUCE ALGÉRIENNE')).toBe('sauces');
    expect(cat('sauce algerienne')).toBe('sauces');
  });
  it('un mot-clé ne matche pas l\'intérieur d\'un mot', () => {
    // « eau » ne doit pas reconnaître « gâteau » ni « seau »
    expect(cat('Gâteau chocolat')).toBe('epicerie');
  });
});

describe('dictionnaire modifiable', () => {
  it('un mot-clé ajouté est pris en compte (accents ignorés)', () => {
    const dict = { ...DEFAULT_KEYWORDS, sauces: [...DEFAULT_KEYWORDS.sauces, 'Bigoudène'] };
    expect(categorize('Bigoudene maison', dict).category).toBe('sauces');
  });
  it('un mot-clé retiré n\'est plus reconnu', () => {
    const dict = { ...DEFAULT_KEYWORDS, boissons: DEFAULT_KEYWORDS.boissons.filter((k) => !k.startsWith('coca')) };
    expect(categorize('Coca-Cola 33cl', dict).category).toBe('boissons'); // « cola » reste
    const dict2 = { ...dict, boissons: dict.boissons.filter((k) => k !== 'cola') };
    expect(categorize('Coca-Cola 33cl', dict2).category).toBe('autres');
  });
});

describe('classements appris', () => {
  it('un déplacement manuel est mémorisé et prioritaire, quelle que soit la taille', () => {
    const learned = learn({}, 'Poulet pané 5kg', 'surgeles');
    expect(categorize('Poulet pané 5kg', DEFAULT_KEYWORDS, learned).category).toBe('surgeles');
    expect(categorize('POULET PANE 2,5 KG', DEFAULT_KEYWORDS, learned).category).toBe('surgeles');
    expect(categorize('Poulet rôti', DEFAULT_KEYWORDS, learned).category).toBe('viandes');
  });
});

describe('normalize / productKey', () => {
  it('retire accents, ligatures et casse', () => expect(normalize('  Œufs  BRIOCHÉS ')).toBe('oeufs brioches'));
  it('retire les tailles', () => expect(productKey('Coca-Cola 33cl x24')).toBe('coca cola'));
});
