/**
 * Alignement mot à mot entre le texte attendu et la transcription (Needleman-Wunsch),
 * avec fusion et scission de mots (« يا أيها » ↔ « يٰٓأَيُّهَا »), puis comparaison lettre à lettre.
 */

export function levenshtein(a: string, b: string): number {
  const A = [...a];
  const B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, j) => j);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

/** Similarité 0..1 entre deux squelettes de mots. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const len = Math.max([...a].length, [...b].length);
  return len ? 1 - levenshtein(a, b) / len : 1;
}

export type LetterOp =
  | { op: "same"; expected: string }
  | { op: "sub"; expected: string; heard: string }
  | { op: "missing"; expected: string }
  | { op: "extra"; heard: string };

/** Différences lettre à lettre (chemin d'édition de Levenshtein). */
export function letterDiff(expected: string, heard: string): LetterOp[] {
  const A = [...expected];
  const B = [...heard];
  const d: number[][] = Array.from({ length: A.length + 1 }, (_, i) =>
    Array.from({ length: B.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    }
  }
  const ops: LetterOp[] = [];
  let i = A.length;
  let j = B.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1)) {
      ops.push(A[i - 1] === B[j - 1] ? { op: "same", expected: A[i - 1] } : { op: "sub", expected: A[i - 1], heard: B[j - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ op: "missing", expected: A[i - 1] });
      i--;
    } else {
      ops.push({ op: "extra", heard: B[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

export type AlignPair =
  /** Un mot attendu ↔ un mot entendu. */
  | { kind: "pair"; e: number; h: number; sim: number }
  /** Deux mots attendus ↔ un mot entendu (mots collés). */
  | { kind: "merge"; e: number; h: number; sim: number }
  /** Un mot attendu ↔ deux mots entendus (mot coupé). */
  | { kind: "split"; e: number; h: number; sim: number }
  /** Deux mots attendus récités dans l'ordre inverse. */
  | { kind: "swap"; e: number; h: number }
  | { kind: "missing"; e: number }
  | { kind: "added"; h: number };

const STEP_SIZE: Record<AlignPair["kind"], [number, number]> = {
  pair: [1, 1],
  merge: [2, 1],
  split: [1, 2],
  swap: [2, 2],
  missing: [1, 0],
  added: [0, 1],
};

const GAP = -0.45;
const JOIN_PENALTY = 0.15;
/** Similarité minimale pour accepter des mots collés, coupés ou inversés. */
const JOIN_SIM = 0.85;
const score = (sim: number) => 2 * sim - 1;

/** Alignement global maximisant la similarité totale. */
export function alignWords(expected: string[], heard: string[]): AlignPair[] {
  const n = expected.length;
  const m = heard.length;
  const S: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(-Infinity));
  const back: (AlignPair | null)[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  S[0][0] = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      const base = S[i][j];
      if (base === -Infinity) continue;
      const relax = (ni: number, nj: number, v: number, step: AlignPair) => {
        if (ni <= n && nj <= m && v > S[ni][nj]) {
          S[ni][nj] = v;
          back[ni][nj] = step;
        }
      };
      if (i < n && j < m) {
        const sim = similarity(expected[i], heard[j]);
        relax(i + 1, j + 1, base + score(sim), { kind: "pair", e: i, h: j, sim });
      }
      if (i + 1 < n && j < m) {
        const sim = similarity(expected[i] + expected[i + 1], heard[j]);
        if (sim >= JOIN_SIM) relax(i + 2, j + 1, base + 2 * score(sim) - JOIN_PENALTY, { kind: "merge", e: i, h: j, sim });
      }
      if (i < n && j + 1 < m) {
        const sim = similarity(expected[i], heard[j] + heard[j + 1]);
        if (sim >= JOIN_SIM) relax(i + 1, j + 2, base + score(sim) - JOIN_PENALTY, { kind: "split", e: i, h: j, sim });
      }
      if (i + 1 < n && j + 1 < m) {
        const s1 = similarity(expected[i], heard[j + 1]);
        const s2 = similarity(expected[i + 1], heard[j]);
        if (s1 >= JOIN_SIM && s2 >= JOIN_SIM && expected[i] !== expected[i + 1]) {
          relax(i + 2, j + 2, base + score(s1) + score(s2) - 2 * JOIN_PENALTY, { kind: "swap", e: i, h: j });
        }
      }
      if (i < n) relax(i + 1, j, base + GAP, { kind: "missing", e: i });
      if (j < m) relax(i, j + 1, base + GAP, { kind: "added", h: j });
    }
  }
  const out: AlignPair[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const step = back[i][j]!;
    out.push(step);
    const [di, dj] = STEP_SIZE[step.kind];
    i -= di;
    j -= dj;
  }
  return out.reverse();
}
