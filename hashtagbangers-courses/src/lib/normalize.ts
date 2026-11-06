/** Minuscules, sans accents ni ligatures : « Boîtes Œufs » → « boites oeufs ». */
export function normalize(text: string): string {
  return text
    .replace(/[œŒ]/g, 'oe')
    .replace(/[æÆ]/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tailles et conditionnements : ne font pas partie de l'identité d'un produit. */
const SIZE_TOKENS = new Set([
  'kg', 'kilo', 'kilos', 'g', 'gr', 'grs', 'gramme', 'grammes', 'mg',
  'l', 'litre', 'litres', 'cl', 'ml', 'dl',
  'x', 'pcs', 'pc', 'pce', 'pces', 'piece', 'pieces', 'lot', 'colis', 'unite', 'unites',
]);

/** Pluriel simple : « frites » = « frite », « panés » = « pane ». « ss » final conservé (express). */
function stem(token: string): string {
  return token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token;
}

/**
 * Clé stable d'un produit, pour retrouver un même produit d'une liste à l'autre
 * et mémoriser son classement. Insensible aux accents, à la casse, à la ponctuation
 * (« Coca-Cola » = « coca cola »), au pluriel, et ignore quantités et formats :
 * « Poulet pané 5kg », « poulet pane », « POULETS PANÉS x3 » → « poulet pane ».
 * Idempotente : productKey(productKey(x)) === productKey(x).
 */
export function productKey(name: string): string {
  return normalize(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !/\d/.test(t) && !SIZE_TOKENS.has(t))
    .map(stem)
    .join(' ');
}

/** Nom lisible du produit sans quantité ni format (« Poulet pané 5kg » → « Poulet pané »). */
export function productLabel(name: string): string {
  const tokens = name
    .replace(/ /g, ' ')
    .split(/\s+/)
    .filter((t) => {
      const n = normalize(t).replace(/[^a-z0-9]+/g, '');
      return n && /[a-z]/.test(n) && !/\d/.test(n) && !SIZE_TOKENS.has(n);
    });
  const label = tokens.join(' ').trim();
  if (!label) return name.trim();
  return label.charAt(0).toLocaleUpperCase('fr-FR') + label.slice(1);
}
