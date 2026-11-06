import { normalize } from './normalize';

export interface ParsedLine {
  name: string;
  qty: number;
}

const MAX_QTY = 9999;

/** Unités de taille : « 10L », « 5 kg », « 33cl »… un nombre suivi d'une unité n'est pas une quantité. */
const UNIT = String.raw`(?:kg|g|gr|grs|mg|l|litres?|cl|ml|dl|cm|mm|m|oz|lb|%|°)`;

/** En-têtes, totaux et lignes de service à ignorer (testés sur le texte normalisé). */
const SKIP_PATTERNS: RegExp[] = [
  /^(sous[- ]?)?total\b/,
  /^montant\b/,
  /^(net|reste) a payer\b/,
  /^tva\b/,
  /^(prix|p\.?u\.?|pu)\b/,
  /^(h\.?t\.?|t\.?t\.?c\.?)\b/,
  /^frais\b/,
  /^livraison\b/,
  /^remise\b/,
  /^economie/,
  /^reduction\b/,
  /^(ma |mes |la |votre )?(liste|panier|commande|recapitulatif|recap)\b/,
  /^courses\b/,
  /^(metro|salamarket|sala market)\b\s*[:\-–—]?\s*$/,
  /^(article|produit|designation|libelle|quantite|qte)s?\b\s*[:|;\t]/,
  /^(article|produit|designation|libelle|quantite|qte)s?\s*$/,
  /^((article|produit|designation|libelle|quantite|qte|prix|p\.?u\.?|total|montant|ref|reference|ean|unite|conditionnement|magasin)s?\b[\s|;:/]*){2,}$/,
  /^(nombre d'articles|nb articles|\d+ articles?)\b/,
  /^(date|le \d|commande n|n° de commande|facture|ticket|client|caisse|magasin)\b/,
  /^(merci|bonjour|hello|salut)\b/,
  /^(page \d|imprime)/,
];

function stripBullet(line: string): string {
  return line
    .replace(/^[\s\-–—*•·▪▫►▶‣◦●○■□✓✔✗☐☑️>+]+/u, '')
    .replace(/^\[\s?[xX ]?\s?\]\s*/, '') // cases à cocher markdown « [ ] » / « [x] »
    .replace(/^(?:n°\s*)?\d{1,3}\s*[.)]\s+(?=\S)/, '') // numérotation « 1. » « 2) »
    .replace(/^#\d{1,3}\s+/, '');
}

function stripPrices(line: string): string {
  return line
    .replace(/(?<!\d[ ]?)(?:€|eur\b)[ ]?\d+(?:[.,]\d{1,2})?/gi, ' ')
    .replace(/\d+(?:[.,]\d{1,2})?\s*(?:€|eur(?:os?)?\b)(?:\s*(?:h\.?t\.?|t\.?t\.?c\.?))?(?:\s*\/\s*\p{L}+)?/giu, ' ')
    .replace(/\b(?:prix|pu|p\.u\.)\s*:?\s*\d+(?:[.,]\d{1,2})?/gi, ' ')
    // Nombre à 2 décimales sans unité = prix sans symbole (« Huile 10L 25,99 »).
    .replace(new RegExp(String.raw`(^|\s)\d+[.,]\d{2}(?!\s*${UNIT}\b)(?=\s|$)`, 'gi'), '$1')
    .replace(/[ ]+/g, ' ')
    .replace(/[\s\-–—:|,;]+$/, '')
    .trim();
}

function toQty(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_QTY) return null;
  return n;
}

interface Extracted {
  name: string;
  qty: number | null;
}

/** Cherche une quantité explicite et la retire du nom. L'ordre des règles compte. */
function extractQty(text: string): Extracted {
  const rules: RegExp[] = [
    // « Qté : 3 », « quantité 3 »
    /(?:^|\s)(?:qt[ée]s?|quantit[ée]s?)\s*[:=]?\s*(\d{1,4})\b/i,
    // « 2 x Huile », « 2x Huile », « 2 × Huile », « 2* Huile », « 2xHuile »
    /^(\d{1,4})\s*[x×*]\s*(?=\p{L})/iu,
    // « x2 Huile »
    /^[x×]\s*(\d{1,4})\s+/i,
    // « Huile 10L x2 », « Huile x 2 », « (x2) », « × 2 »
    /\s\(?\s*[x×*]\s*(\d{1,4})\s*\)?\s*$/i,
    // « Huile 10L 2x »
    /\s(\d{1,4})\s*[x×]\s*$/i,
    // « Frites 2,5kg - 8 », « Frites : 8 », « Frites | 8 »
    /\s[-–—:|=]\s*(\d{1,4})\s*$/,
    // « Frites (8) »
    /\s\(\s*(\d{1,4})\s*\)\s*$/,
    // « Frites 8 pcs / colis / cartons / unités »
    /\s(\d{1,4})\s*(?:pcs?|pi[eè]ces?|colis|cartons?|unit[ée]s?|u|lots?|paquets?|packs?|sacs?|bo[iî]tes?|bidons?|seaux?)\.?\s*$/i,
    // Copie de tableau : « Huile 10L<TAB>2 », « Huile 10L   2 », « Huile;2 »
    /(?:\t|\s{2,}|;)\s*(\d{1,4})\s*$/,
  ];
  for (const re of rules) {
    const m = re.exec(text);
    if (!m) continue;
    const qty = toQty(m[1]);
    if (qty === null) continue;
    const name = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).trim();
    if (/\p{L}/u.test(name)) return { name, qty };
  }
  // « 4 Coca-Cola 33cl » : nombre en tête suivi d'un mot qui n'est pas une unité.
  const lead = new RegExp(String.raw`^(\d{1,4})\s+(?!${UNIT}\b)(?=\p{L})`, 'iu').exec(text);
  if (lead) {
    const qty = toQty(lead[1]);
    if (qty !== null) return { name: text.slice(lead[0].length), qty };
  }
  return { name: text, qty: null };
}

function cleanName(name: string): string {
  const cleaned = name
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:,;|.]+/, '')
    .replace(/[\s\-–—:,;|]+$/, '')
    .trim();
  return cleaned.charAt(0).toLocaleUpperCase('fr-FR') + cleaned.slice(1);
}

function shouldSkip(line: string): boolean {
  const n = normalize(line);
  if (!n) return true;
  if (!/\p{L}/u.test(n)) return true; // que des chiffres / symboles (prix, totaux, séparateurs)
  if (/^[=\-_*~.]{3,}/.test(n)) return true; // séparateurs « ----- »
  if (/:\s*$/.test(n) && n.split(' ').length <= 4) return true; // titre de section « Boissons : »
  return SKIP_PATTERNS.some((re) => re.test(n));
}

/** Analyse une seule ligne. Renvoie null si la ligne doit être ignorée. */
export function parseLine(raw: string): ParsedLine | null {
  let line = raw.replace(/ /g, ' ').replace(/\r/g, '');
  line = stripBullet(line.trim());
  if (shouldSkip(line)) return null;
  // Les tabulations servent de séparateur de colonnes : on les garde pour l'extraction.
  line = stripPrices(line.replace(/ {2,}/g, '\t').replace(/[ ]+/g, ' ')).replace(/ ?\t ?/g, '\t');
  // Une copie de tableau « Produit<TAB>Prix<TAB>Qté » : les colonnes vides disparaissent.
  line = line.replace(/\t+/g, '\t').replace(/\t$/, '');
  if (shouldSkip(line)) return null;

  const { name, qty } = extractQty(line);
  const finalName = cleanName(name.replace(/\t/g, ' '));
  if (!finalName || !/\p{L}/u.test(finalName)) return null;
  return { name: finalName, qty: qty ?? 1 };
}

const QTY_ONLY = /^(?:qt[e]s?|quantites?)\s*[:=]?\s*(\d{1,4})$|^[x×]\s*(\d{1,4})$/;

/**
 * Transforme une liste collée (Métro, Salamarket, notes…) en articles.
 * Une ligne = un produit. Les doublons (même nom) sont fusionnés en additionnant les quantités.
 */
export function parseList(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  const index = new Map<string, number>();
  for (const raw of text.split(/\n/)) {
    // « Quantité : 2 » ou « x2 » seul sur sa ligne (copie d'appli sur plusieurs lignes) :
    // s'applique au produit précédent.
    const qtyOnly = QTY_ONLY.exec(normalize(stripBullet(raw.trim())));
    if (qtyOnly) {
      const qty = toQty(qtyOnly[1] ?? qtyOnly[2]);
      if (qty !== null && out.length > 0) out[out.length - 1] = { ...out[out.length - 1], qty };
      continue;
    }
    const parsed = parseLine(raw);
    if (!parsed) continue;
    const key = normalize(parsed.name);
    const at = index.get(key);
    if (at !== undefined) {
      out[at] = { ...out[at], qty: Math.min(MAX_QTY, out[at].qty + parsed.qty) };
    } else {
      index.set(key, out.length);
      out.push(parsed);
    }
  }
  return out;
}
