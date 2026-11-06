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

const SIZE_TOKENS = new Set(['kg', 'g', 'gr', 'grs', 'l', 'cl', 'ml', 'dl', 'x', 'pcs', 'pc', 'lot', 'colis']);

/**
 * Clé stable d'un produit pour mémoriser un classement manuel :
 * normalisée, sans les tailles / conditionnements (« 5kg », « 33cl », « x10 »).
 * « Poulet pané 5kg » et « poulet pane 2,5 KG » donnent tous deux « poulet pane ».
 */
export function productKey(name: string): string {
  return normalize(name)
    .replace(/[^a-z0-9' -]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !/\d/.test(t) && !SIZE_TOKENS.has(t))
    .join(' ')
    .trim();
}
