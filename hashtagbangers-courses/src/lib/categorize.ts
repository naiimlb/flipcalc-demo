import { CATEGORY_IDS, type CategoryId, type KeywordDict } from './categories';
import { normalize, productKey } from './normalize';

export type LearnedRules = Record<string, CategoryId>;

interface CompiledKeyword {
  category: CategoryId;
  keyword: string;
  re: RegExp;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Un mot-clé reconnaît le mot entier et son pluriel (s, x, es). Espaces et tirets interchangeables. */
function keywordRegExp(keyword: string): RegExp {
  const body = keyword
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${escapeRegExp(part)}(?:s|x|es)?`)
    .join("[\\s'-]+");
  return new RegExp(`(?:^|[^a-z0-9])(${body})(?=$|[^a-z0-9])`);
}

const cache = new WeakMap<KeywordDict, CompiledKeyword[]>();

function compile(dict: KeywordDict): CompiledKeyword[] {
  const hit = cache.get(dict);
  if (hit) return hit;
  const out: CompiledKeyword[] = [];
  for (const category of CATEGORY_IDS) {
    for (const raw of dict[category] ?? []) {
      const keyword = normalize(raw);
      if (!keyword) continue;
      out.push({ category, keyword, re: keywordRegExp(keyword) });
    }
  }
  cache.set(dict, out);
  return out;
}

export interface CategoryMatch {
  category: CategoryId;
  /** Mot-clé qui a décidé, ou « appris » si le classement vient d'un déplacement manuel. */
  reason: string;
}

/**
 * Trouve la catégorie d'un produit.
 * 1. Classement appris (l'utilisateur a déjà déplacé ce produit) : prioritaire.
 * 2. Mot-clé le plus spécifique : le plus long gagne, avec un bonus s'il ouvre le nom
 *    (« Pot de sauce » est un emballage, « Sauce algérienne » une sauce).
 * 3. Sinon « Autres ».
 */
export function categorize(name: string, dict: KeywordDict, learned: LearnedRules = {}): CategoryMatch {
  const key = productKey(name);
  const learnedCat = learned[key];
  if (learnedCat && CATEGORY_IDS.includes(learnedCat)) return { category: learnedCat, reason: 'appris' };

  const text = normalize(name);
  let best: { score: number; m: CompiledKeyword } | null = null;
  for (const kw of compile(dict)) {
    const match = kw.re.exec(text);
    if (!match) continue;
    const start = match.index + (match[0].length - match[1].length);
    const score = match[1].length + (start === 0 ? 3 : 0);
    if (!best || score > best.score) best = { score, m: kw };
  }
  if (best) return { category: best.m.category, reason: best.m.keyword };
  return { category: 'autres', reason: '' };
}

/** Mémorise qu'un produit appartient à une catégorie (déplacement manuel). */
export function learn(learned: LearnedRules, name: string, category: CategoryId): LearnedRules {
  const key = productKey(name);
  if (!key) return learned;
  return { ...learned, [key]: category };
}
