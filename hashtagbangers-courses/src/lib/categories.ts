/**
 * Catégories de produits et dictionnaire de mots-clés par défaut.
 * Les mots-clés sont écrits sans accents, en minuscules (ils sont de toute façon normalisés).
 * Un mot-clé reconnaît aussi son pluriel (s / x / es) : « boite » reconnaît « Boîtes ».
 */

export type CategoryId =
  | 'viandes'
  | 'surgeles'
  | 'sauces'
  | 'fromages'
  | 'legumes'
  | 'pains'
  | 'boissons'
  | 'epicerie'
  | 'emballages'
  | 'hygiene'
  | 'autres';

export interface Category {
  id: CategoryId;
  label: string;
  emoji: string;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  viandes: { id: 'viandes', label: 'Viandes & Poulet', emoji: '🥩' },
  surgeles: { id: 'surgeles', label: 'Surgelés', emoji: '🧊' },
  sauces: { id: 'sauces', label: 'Sauces & Condiments', emoji: '🥫' },
  fromages: { id: 'fromages', label: 'Fromages & Produits laitiers', emoji: '🧀' },
  legumes: { id: 'legumes', label: 'Légumes & Salades', emoji: '🥬' },
  pains: { id: 'pains', label: 'Pains & Boulangerie', emoji: '🍞' },
  boissons: { id: 'boissons', label: 'Boissons', emoji: '🥤' },
  epicerie: { id: 'epicerie', label: 'Épicerie sèche', emoji: '🫙' },
  emballages: { id: 'emballages', label: 'Emballages', emoji: '📦' },
  hygiene: { id: 'hygiene', label: 'Hygiène & Entretien', emoji: '🧽' },
  autres: { id: 'autres', label: 'Autres', emoji: '🛒' },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

/**
 * Ordre de parcours par défaut dans un cash & carry type Métro :
 * non-alimentaire et sec d'abord, puis le frais, et le surgelé en dernier
 * pour préserver la chaîne du froid. « Autres » toujours en bas.
 */
export const DEFAULT_ORDER: CategoryId[] = [
  'emballages',
  'hygiene',
  'epicerie',
  'sauces',
  'boissons',
  'pains',
  'legumes',
  'fromages',
  'viandes',
  'surgeles',
  'autres',
];

export type KeywordDict = Record<CategoryId, string[]>;

export const DEFAULT_KEYWORDS: KeywordDict = {
  viandes: [
    'poulet', 'poulets', 'volaille', 'dinde', 'boeuf', 'veau', 'agneau', 'mouton', 'viande',
    'steak', 'steak hache', 'hache', 'kebab', 'doner', 'gyros', 'tacos viande', 'merguez',
    'saucisse', 'chipolata', 'cordon bleu', 'escalope', 'filet de poulet', 'blanc de poulet',
    'cuisse', 'pilon', 'aile', 'wings', 'tenders', 'jambon', 'bacon', 'lardon', 'pastrami',
    'cervelas', 'salami', 'chorizo', 'pepperoni', 'boulette', 'kefta', 'cheval', 'tranche de dinde',
  ],
  surgeles: [
    'frite', 'frites', 'potatoes', 'potatoe', 'wedges', 'nuggets', 'nugget', 'surgele', 'surgeles',
    'congele', 'glace', 'glaces', 'creme glacee', 'sorbet', 'onion rings', 'oignons frits panes',
    'mozzarella sticks', 'sticks mozza', 'jalapenos panes', 'cheese bites', 'croquette', 'galette de pomme de terre',
    'hash brown', 'rosti', 'chicken wings surgele', 'tiramisu', 'cookie dough', 'glacon', 'glacons',
  ],
  sauces: [
    'sauce', 'ketchup', 'mayonnaise', 'mayo', 'moutarde', 'algerienne', 'samourai', 'andalouse',
    'biggy', 'barbecue', 'bbq', 'harissa', 'blanche', 'cocktail', 'curry', 'tartare', 'pita sauce',
    'vinaigrette', 'vinaigre', 'cornichon', 'cornichons', 'pickles', 'jalapeno', 'piment', 'tabasco',
    'sriracha', 'poivre', 'sel', 'epice', 'epices', 'condiment', 'aioli', 'burger sauce', 'chili',
  ],
  fromages: [
    'cheddar', 'fromage', 'emmental', 'mozzarella', 'mozza', 'raclette', 'chevre', 'feta',
    'gouda', 'edam', 'parmesan', 'kiri', 'vache qui rit', 'reblochon', 'maroilles', 'bleu',
    'beurre', 'creme', 'creme fraiche', 'creme liquide', 'lait', 'yaourt', 'oeuf', 'oeufs',
    'boursin', 'cancoillotte', 'tranches cheddar', 'cheese',
  ],
  legumes: [
    'salade', 'iceberg', 'laitue', 'tomate', 'tomates', 'oignon', 'oignons', 'oignon rouge',
    'concombre', 'poivron', 'carotte', 'chou', 'pomme de terre', 'patate', 'champignon',
    'avocat', 'citron', 'ail', 'persil', 'coriandre', 'menthe', 'legume', 'legumes',
    'mesclun', 'roquette', 'batavia', 'radis', 'fruit', 'fruits', 'pomme', 'banane', 'mache',
  ],
  pains: [
    'pain', 'pains', 'pain burger', 'bun', 'buns', 'brioche', 'brioches', 'brioche burger',
    'galette', 'tortilla', 'wrap', 'wraps', 'pita', 'naan', 'baguette', 'panini', 'bagel',
    'viennoiserie', 'croissant', 'tacos', 'feuille de brick', 'brick', 'pain bao', 'pain kebab',
    'pain pita', 'pain hot dog', 'hot dog', 'muffin',
  ],
  boissons: [
    'coca', 'coca-cola', 'cola', 'pepsi', 'fanta', 'sprite', 'oasis', 'ice tea', 'lipton',
    'orangina', 'schweppes', '7up', 'seven up', 'red bull', 'monster', 'eau', 'cristaline',
    'evian', 'vittel', 'perrier', 'san pellegrino', 'jus', 'boisson', 'soda', 'limonade',
    'canette', 'canettes', 'sirop', 'cafe', 'the', 'capri-sun', 'capri sun', 'tropico',
    'hawai', 'vimto', 'mirinda', 'dr pepper', 'energy', 'redbull', 'ayran',
  ],
  epicerie: [
    'huile', 'huile de friture', 'friture', 'farine', 'sucre', 'riz', 'pates', 'semoule',
    'chapelure', 'panure', 'levure', 'conserve', 'boite de conserve', 'haricot', 'pois chiche',
    'mais', 'thon', 'olive', 'olives', 'chips', 'biscuit', 'gateau', 'chocolat', 'nutella',
    'confiture', 'miel', 'cereale', 'lentille', 'bouillon', 'cube', 'graisse', 'oignons frits',
    'pringles', 'snack', 'bonbon', 'dessert', 'compote', 'fecule',
  ],
  emballages: [
    'boite', 'boites', 'boite burger', 'barquette', 'sac', 'sacs', 'sachet', 'gobelet',
    'gobelets', 'couvercle', 'paille', 'pailles', 'serviette', 'serviettes', 'papier',
    'papier alu', 'aluminium', 'film', 'film etirable', 'emballage', 'pot', 'pots', 'pot sauce',
    'ramequin', 'couvert', 'couverts', 'fourchette', 'cuillere', 'couteau', 'carton',
    'cornet', 'cornet frites', 'kraft', 'wrap papier', 'papier ingraissable', 'etiquette',
    'pique', 'touillette', 'porte gobelet', 'bac', 'bol', 'assiette', 'set de table',
  ],
  hygiene: [
    'liquide vaisselle', 'vaisselle', 'lessive', 'javel', 'eau de javel', 'degraissant',
    'nettoyant', 'desinfectant', 'detergent', 'savon', 'gel hydroalcoolique', 'essuie-tout',
    'essuie tout', 'sopalin', 'bobine', 'papier toilette', 'papier wc', 'eponge', 'eponges',
    'gant', 'gants', 'charlotte', 'tablier', 'sac poubelle', 'sacs poubelle', 'poubelle',
    'balai', 'serpillere', 'raclette sol', 'sanitaire', 'wc', 'lingette', 'desodorisant',
    'anticalcaire', 'produit vaisselle', 'tablette lave-vaisselle', 'lave-vaisselle', 'microfibre',
    'cif', 'ajax', 'mr propre', 'decapant four', 'hygiene', 'entretien',
  ],
  autres: [],
};
