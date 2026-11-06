import { CATEGORY_IDS, type CategoryId, type KeywordDict } from './categories';
import { normalize, productKey, productLabel } from './normalize';

/** Classement mémorisé pour un produit (choisi par l'utilisateur, prioritaire sur les mots-clés). */
export interface LearnedRule {
  category: CategoryId;
  /** Nom lisible, pour l'affichage dans les Réglages. */
  name: string;
  /** Date du dernier choix (ms). */
  at: number;
}

/** Clé = productKey(nom). */
export type LearnedRules = Record<string, LearnedRule>;

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
  const rule = key ? learned[key] : undefined;
  if (rule && CATEGORY_IDS.includes(rule.category)) return { category: rule.category, reason: 'appris' };

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
export function learn(learned: LearnedRules, name: string, category: CategoryId, now = Date.now()): LearnedRules {
  const key = productKey(name);
  if (!key) return learned;
  return { ...learned, [key]: { category, name: productLabel(name), at: now } };
}

/** Oublie le classement mémorisé d'un produit (par clé). */
export function forget(learned: LearnedRules, key: string): LearnedRules {
  if (!(key in learned)) return learned;
  const next = { ...learned };
  delete next[key];
  return next;
}

/**
 * Relit des règles stockées (ancien format « clé → catégorie » ou nouveau), les valide
 * et recalcule les clés avec productKey (idempotent) : les anciennes données restent valables.
 */
export function normalizeLearned(raw: unknown): LearnedRules {
  const out: LearnedRules = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = productKey(k);
    if (!key) continue;
    const obj: Partial<Record<keyof LearnedRule, unknown>> | null =
      typeof v === 'string' ? { category: v } : v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    const category = obj?.category as CategoryId | undefined;
    if (!category || !CATEGORY_IDS.includes(category)) continue;
    const at = typeof obj?.at === 'number' && Number.isFinite(obj.at) ? obj.at : 0;
    const name = typeof obj?.name === 'string' && obj.name.trim() ? obj.name.trim() : productLabel(k);
    if (!out[key] || at >= out[key].at) out[key] = { category, name, at };
  }
  return out;
}
