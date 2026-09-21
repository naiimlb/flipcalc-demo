/* =====================================================================
   seed.js — kits de départ (fournisseurs + produits pré-remplis)
   Tout est modifiable par l'utilisateur après chargement.
   ===================================================================== */
import * as store from './store.js';

/* p = [nom, zone, unité, conditionnement, étiquette, fournisseur, cible, stock actuel] */
const KITS = {
  'fast-food': {
    label: 'Kit Fast-food',
    desc: '26 produits et 3 fournisseurs : burgers, frites, sauces, boissons, emballages.',
    suppliers: [
      { key: 'gros', name: 'Metro Pro', phone: '+33 6 12 34 56 78', email: 'commandes@metropro.example', order_days: ['lun', 'mer', 'ven'] },
      { key: 'pain', name: 'Boulangerie Durand', phone: '+33 6 23 45 67 89', email: 'contact@durand.example', order_days: ['mar', 'jeu', 'sam'] },
      { key: 'frais', name: 'Frais & Co', phone: '+33 6 34 56 78 90', email: 'commandes@fraisco.example', order_days: ['lun', 'jeu'] },
    ],
    products: [
      ['Steak haché 45 g surgelé', 'Congélateur', 'pièce', 48, 'carton de 48', 'gros', 240, 96],
      ['Steak haché 150 g surgelé', 'Congélateur', 'pièce', 24, 'carton de 24', 'gros', 96, 24],
      ['Frites surgelées 2,5 kg', 'Congélateur', 'sac', 4, 'carton de 4 sacs', 'gros', 16, 5],
      ['Nuggets de poulet 1 kg', 'Congélateur', 'sachet', 6, 'carton de 6', 'gros', 12, 3],
      ['Filet de poulet pané', 'Congélateur', 'pièce', 30, 'carton de 30', 'gros', 60, 30],
      ['Onion rings 1 kg', 'Congélateur', 'sachet', 6, 'carton de 6', 'gros', 12, 12],
      ['Cheddar en tranches 1 kg', 'Frigo', 'paquet', 6, 'carton de 6', 'frais', 12, 4],
      ['Salade iceberg', 'Frigo', 'pièce', 6, 'colis de 6', 'frais', 12, 0],
      ['Tomates rondes', 'Frigo', 'kg', 5, 'cageot de 5 kg', 'frais', 10, 3],
      ['Oignons rouges', 'Frigo', 'kg', 5, 'sac de 5 kg', 'frais', 10, 6],
      ['Bacon tranché 500 g', 'Frigo', 'paquet', 10, 'carton de 10', 'frais', 10, 2],
      ['Cornichons tranchés 2 kg', 'Frigo', 'seau', 4, 'carton de 4', 'gros', 4, 4],
      ['Pain burger sésame', 'Sec', 'pièce', 48, 'carton de 48', 'pain', 240, 96],
      ['Pain burger brioché', 'Sec', 'pièce', 48, 'carton de 48', 'pain', 96, 48],
      ['Sauce burger 5 L', 'Sec', 'bidon', 2, 'carton de 2', 'gros', 4, 1],
      ['Ketchup 5 L', 'Sec', 'bidon', 2, 'carton de 2', 'gros', 4, 2],
      ['Mayonnaise 5 L', 'Sec', 'bidon', 2, 'carton de 2', 'gros', 4, 0],
      ['Sauce algérienne 1 L', 'Sec', 'flacon', 6, 'carton de 6', 'gros', 12, 5],
      ['Huile de friture 10 L', 'Sec', 'bidon', 2, 'carton de 2', 'gros', 6, 2],
      ['Coca-Cola 33 cl', 'Boissons', 'canette', 24, 'pack de 24', 'gros', 96, 36],
      ['Oasis tropical 33 cl', 'Boissons', 'canette', 24, 'pack de 24', 'gros', 48, 12],
      ['Eau minérale 50 cl', 'Boissons', 'bouteille', 24, 'pack de 24', 'gros', 48, 48],
      ['Gobelet 40 cl + couvercle', 'Emballages', 'pièce', 500, 'carton de 500', 'gros', 1000, 350],
      ['Boîte burger kraft', 'Emballages', 'pièce', 300, 'carton de 300', 'gros', 900, 300],
      ['Barquette frites moyenne', 'Emballages', 'pièce', 500, 'carton de 500', 'gros', 1000, 1000],
      ['Sac papier à emporter', 'Emballages', 'pièce', 250, 'lot de 250', 'gros', 500, 120],
    ],
  },

  snack: {
    label: 'Kit Snack',
    desc: '18 produits et 3 fournisseurs : sandwichs, tacos, paninis, boissons.',
    suppliers: [
      { key: 'gros', name: 'Metro Pro', phone: '+33 6 12 34 56 78', email: 'commandes@metropro.example', order_days: ['lun', 'mer', 'ven'] },
      { key: 'pain', name: 'Boulangerie Durand', phone: '+33 6 23 45 67 89', email: 'contact@durand.example', order_days: ['mar', 'jeu', 'sam'] },
      { key: 'frais', name: 'Frais & Co', phone: '+33 6 34 56 78 90', email: 'commandes@fraisco.example', order_days: ['lun', 'jeu'] },
    ],
    products: [
      ['Galette à tacos 30 cm', 'Sec', 'pièce', 48, 'carton de 48', 'pain', 192, 96],
      ['Pain panini', 'Sec', 'pièce', 30, 'sachet de 30', 'pain', 90, 30],
      ['Baguette viennoise', 'Sec', 'pièce', 20, 'lot de 20', 'pain', 40, 20],
      ['Frites surgelées 2,5 kg', 'Congélateur', 'sac', 4, 'carton de 4 sacs', 'gros', 12, 4],
      ['Escalope de poulet marinée', 'Congélateur', 'kg', 5, 'carton de 5 kg', 'gros', 15, 5],
      ['Viande hachée kebab', 'Congélateur', 'kg', 10, 'broche de 10 kg', 'gros', 20, 10],
      ['Cordon bleu', 'Congélateur', 'pièce', 30, 'carton de 30', 'gros', 60, 60],
      ['Fromage râpé 1 kg', 'Frigo', 'sachet', 6, 'carton de 6', 'frais', 12, 3],
      ['Salade iceberg', 'Frigo', 'pièce', 6, 'colis de 6', 'frais', 12, 2],
      ['Tomates rondes', 'Frigo', 'kg', 5, 'cageot de 5 kg', 'frais', 10, 5],
      ['Sauce blanche 5 L', 'Sec', 'bidon', 2, 'carton de 2', 'gros', 4, 1],
      ['Sauce samouraï 1 L', 'Sec', 'flacon', 6, 'carton de 6', 'gros', 12, 6],
      ['Huile de friture 10 L', 'Sec', 'bidon', 2, 'carton de 2', 'gros', 4, 0],
      ['Coca-Cola 33 cl', 'Boissons', 'canette', 24, 'pack de 24', 'gros', 72, 24],
      ['Ice Tea pêche 33 cl', 'Boissons', 'canette', 24, 'pack de 24', 'gros', 48, 24],
      ['Eau minérale 50 cl', 'Boissons', 'bouteille', 24, 'pack de 24', 'gros', 48, 12],
      ['Papier tacos + sachet', 'Emballages', 'pièce', 500, 'carton de 500', 'gros', 1000, 400],
      ['Sac papier à emporter', 'Emballages', 'pièce', 250, 'lot de 250', 'gros', 500, 250],
    ],
  },

  traiteur: {
    label: 'Kit Traiteur',
    desc: '18 produits et 3 fournisseurs : buffets, plateaux, contenants.',
    suppliers: [
      { key: 'gros', name: 'Metro Pro', phone: '+33 6 12 34 56 78', email: 'commandes@metropro.example', order_days: ['lun', 'mer', 'ven'] },
      { key: 'frais', name: 'Frais & Co', phone: '+33 6 34 56 78 90', email: 'commandes@fraisco.example', order_days: ['lun', 'jeu'] },
      { key: 'boisson', name: 'Cave Martin', phone: '+33 6 45 67 89 01', email: 'commandes@cavemartin.example', order_days: ['mer'] },
    ],
    products: [
      ['Saumon fumé 1 kg', 'Frigo', 'paquet', 4, 'carton de 4', 'frais', 8, 2],
      ['Plateau de charcuterie', 'Frigo', 'pièce', 6, 'colis de 6', 'frais', 12, 6],
      ['Fromage à découper 2 kg', 'Frigo', 'pièce', 4, 'carton de 4', 'frais', 8, 3],
      ['Crème fraîche 1 L', 'Frigo', 'brique', 12, 'carton de 12', 'frais', 24, 8],
      ['Beurre doux 500 g', 'Frigo', 'plaquette', 20, 'carton de 20', 'frais', 20, 20],
      ['Crevettes cuites 1 kg', 'Congélateur', 'sachet', 6, 'carton de 6', 'gros', 12, 0],
      ['Mini-feuilletés apéritif', 'Congélateur', 'sachet', 10, 'carton de 10', 'gros', 30, 10],
      ['Pâte feuilletée 2 kg', 'Congélateur', 'bloc', 6, 'carton de 6', 'gros', 12, 6],
      ['Farine T55 25 kg', 'Sec', 'sac', 1, 'sac de 25 kg', 'gros', 4, 1],
      ['Riz basmati 5 kg', 'Sec', 'sac', 4, 'carton de 4', 'gros', 8, 4],
      ['Huile d’olive 5 L', 'Sec', 'bidon', 2, 'carton de 2', 'gros', 4, 2],
      ['Vinaigre balsamique 1 L', 'Sec', 'flacon', 6, 'carton de 6', 'gros', 6, 6],
      ['Jus d’orange 1 L', 'Boissons', 'brique', 12, 'carton de 12', 'boisson', 36, 12],
      ['Eau pétillante 1 L', 'Boissons', 'bouteille', 12, 'pack de 12', 'boisson', 36, 24],
      ['Vin blanc 75 cl', 'Boissons', 'bouteille', 6, 'carton de 6', 'boisson', 24, 6],
      ['Plateau carton 40 cm', 'Emballages', 'pièce', 100, 'carton de 100', 'gros', 200, 50],
      ['Barquette traiteur 1 L', 'Emballages', 'pièce', 250, 'carton de 250', 'gros', 500, 250],
      ['Couverts jetables', 'Emballages', 'lot', 100, 'carton de 100 lots', 'gros', 200, 60],
    ],
  },
};

export const kitFor = (type) => KITS[type] || KITS['fast-food'];
export const kitList = () => Object.entries(KITS).map(([id, k]) => ({ id, ...k }));

/** Crée les fournisseurs puis les produits du kit dans la base locale. */
export function applyKit(type) {
  const kit = kitFor(type);
  const ids = {};
  for (const s of kit.suppliers) {
    const rec = store.put('suppliers', {
      name: s.name, phone: s.phone, email: s.email, order_days: s.order_days,
    });
    ids[s.key] = rec.id;
  }
  store.putMany('products', kit.products.map(([name, zone, unit, pack, label, sup, target, current], i) => ({
    name, zone, unit,
    pack_size: pack,
    pack_label: label,
    supplier_id: ids[sup] || null,
    target_stock: target,
    current_stock: current,
    sort_index: i,
  })));
  return { suppliers: kit.suppliers.length, products: kit.products.length };
}
