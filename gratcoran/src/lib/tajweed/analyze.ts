import type { SourceSurah } from "../quran/matcher";
import { normalizeArabic } from "../quran/normalize";
import { alignWords, letterDiff, similarity, type AlignPair } from "./align";
import { annotate, confusionTip, RULES, rulesInPassage, tokenizeVerse, type RuleId, type WordToken } from "./rules";

// --- Réglages ------------------------------------------------------------------

export const MAX_VERSES = 3;
export const MAX_RECORDING_MS = 30_000;
/** Au-delà de ce nombre de mots, on propose de découper le passage en segments. */
export const SEGMENT_THRESHOLD = 20;
const SEGMENT_MAX = 14;
const SEGMENT_MIN = 5;
/** Seuils de maîtrise (meilleur score de mots justes, 0..1). */
export const MASTERY = { mastered: 0.9, progress: 0.6 } as const;
/** Similarité minimale d'un mot pour qu'il soit « approximatif » plutôt que faux. */
const APPROX_SIM = 0.7;

// --- Passage ---------------------------------------------------------------------

export type PassageRef = {
  surah: number;
  verseStart: number;
  verseEnd: number;
  /** Segment éventuel : indices de mots dans le passage (inclus). */
  wordStart?: number | null;
  wordEnd?: number | null;
};

export type PassageWord = WordToken & { index: number };

export type Segment = { start: number; end: number; preview: string };

export type Passage = {
  ref: PassageRef;
  /** Mots récités (tout le passage ou le segment choisi), avec leurs règles. */
  words: PassageWord[];
  /** Nombre total de mots du passage complet. */
  passageLength: number;
  rules: RuleId[];
};

export function validateRef(surahs: readonly SourceSurah[], ref: PassageRef): string | null {
  const s = surahs[ref.surah - 1];
  if (!s || !Number.isInteger(ref.surah)) return "Sourate inconnue.";
  const { verseStart: a, verseEnd: b } = ref;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b > s.verses.length) {
    return "Versets invalides.";
  }
  if (b - a + 1 > MAX_VERSES) return `Choisis au plus ${MAX_VERSES} versets à la fois.`;
  return null;
}

/** Tous les mots annotés du passage (sans découpage). */
export function passageWords(surahs: readonly SourceSurah[], ref: PassageRef): PassageWord[] {
  const s = surahs[ref.surah - 1];
  const tokens: WordToken[] = [];
  const verseEnds = new Set<number>();
  for (const v of s.verses) {
    if (v.id < ref.verseStart || v.id > ref.verseEnd) continue;
    tokens.push(...tokenizeVerse(v.text, v.id));
    verseEnds.add(tokens.length - 1);
  }
  return annotate(tokens, verseEnds).map((w, index) => ({ ...w, index }));
}

export function buildPassage(surahs: readonly SourceSurah[], ref: PassageRef): Passage {
  const all = passageWords(surahs, ref);
  const hasSegment = ref.wordStart != null && ref.wordEnd != null;
  const start = hasSegment ? Math.max(0, ref.wordStart!) : 0;
  const end = hasSegment ? Math.min(all.length - 1, ref.wordEnd!) : all.length - 1;
  const words = all.slice(start, end + 1);
  return {
    ref: hasSegment ? { ...ref, wordStart: start, wordEnd: end } : { ...ref, wordStart: null, wordEnd: null },
    words,
    passageLength: all.length,
    rules: rulesInPassage(words),
  };
}

/** Découpe un long passage en segments, de préférence aux signes de pause et fins de versets. */
export function proposeSegments(words: PassageWord[]): Segment[] {
  if (words.length <= SEGMENT_THRESHOLD) return [];
  const segments: Segment[] = [];
  let start = 0;
  while (start < words.length) {
    let end = Math.min(words.length - 1, start + SEGMENT_MAX - 1);
    if (end < words.length - 1) {
      // Recule jusqu'à une pause naturelle si possible.
      for (let k = end; k >= start + SEGMENT_MIN - 1; k--) {
        const w = words[k];
        const verseEnd = words[k + 1] && words[k + 1].verse !== w.verse;
        if (w.waqf || verseEnd) {
          end = k;
          break;
        }
      }
      // Évite un dernier segment minuscule.
      if (words.length - 1 - end < SEGMENT_MIN) end = words.length - 1;
    }
    segments.push({
      start,
      end,
      preview: words
        .slice(start, Math.min(end + 1, start + 4))
        .map((w) => w.text)
        .join(" "),
    });
    start = end + 1;
  }
  return segments;
}

// --- Analyse d'une récitation ----------------------------------------------------

export type WordStatus = "correct" | "approx" | "error" | "missing";

export type ErrorType =
  /** Lettre(s) confondue(s) dans le mot. */
  | "letter"
  /** Lettres en trop ou oubliées. */
  | "partial"
  /** Mot très différent. */
  | "wrong"
  | "missing"
  | "added"
  /** Deux mots inversés. */
  | "inverted";

export type TajweedError = {
  /** Indice du mot attendu (dans `passage.words`) ; pour un mot ajouté, mot après lequel il a été entendu (-1 au début). */
  index: number;
  /** Mot attendu tel qu'écrit dans le mushaf (vide pour un mot ajouté). */
  word: string;
  /** Ce qui a été entendu (transcription brute). */
  heard: string;
  type: ErrorType;
  rule: RuleId | null;
  /** Lettres confondues : attendue → entendue. */
  letters?: { expected: string; heard: string }[];
  tip?: string;
};

export type WordResult = {
  index: number;
  text: string;
  status: WordStatus;
  heard?: string;
  rules: RuleId[];
};

export type AttentionPoint = { rule: RuleId; words: number[] };

export type Analysis =
  | {
      status: "ok";
      words: WordResult[];
      errors: TajweedError[];
      correct: number;
      approx: number;
      total: number;
      attention: AttentionPoint[];
      message: string;
    }
  | { status: "unclear" | "mismatch"; message: string; tips: string[] };

const UNCLEAR_TIPS = [
  "Rapproche le téléphone de ta bouche (20 à 30 cm).",
  "Choisis un endroit calme, sans musique ni conversation.",
  "Récite à voix haute et posée, du début à la fin du passage.",
];

const ISTIADHA = normalizeArabic("أعوذ بالله من الشيطان الرجيم");
const BASMALA = normalizeArabic("بسم الله الرحمن الرحيم");

type Heard = { raw: string; skel: string };

function splitHeard(transcript: string): Heard[] {
  return transcript
    .split(/[\s،,.؟?!:؛]+/)
    .map((raw) => ({ raw, skel: normalizeArabic(raw) }))
    .filter((h) => h.skel.length > 0);
}

/** Retire l'isti'adha et la basmala d'ouverture si elles ne font pas partie du passage. */
function stripOpening(heard: Heard[], expectedSkel: string[]): Heard[] {
  let out = heard;
  for (const formula of [ISTIADHA, BASMALA]) {
    const expectedStart = expectedSkel.slice(0, 4).join("");
    if (similarity(expectedStart.slice(0, formula.length), formula) >= 0.85) continue;
    for (let k = 1; k <= Math.min(6, out.length); k++) {
      const joined = out.slice(0, k).map((h) => h.skel).join("");
      if (joined.length >= formula.length - 2 && similarity(joined, formula) >= 0.8) {
        out = out.slice(k);
        break;
      }
      if (joined.length > formula.length + 3) break;
    }
  }
  return out;
}

function encouragement(ratio: number): string {
  if (ratio >= 1) return "Magnifique, tous les mots sont justes !";
  if (ratio >= 0.8) return "Très bien ! Il ne reste que quelques détails.";
  if (ratio >= 0.5) return "Bon travail, tu es sur la bonne voie.";
  return "Chaque essai te fait progresser : reprends tranquillement, mot après mot.";
}

function classify(sim: number): WordStatus {
  if (sim === 1) return "correct";
  return sim >= APPROX_SIM ? "approx" : "error";
}

export function analyzeRecitation(
  words: PassageWord[],
  transcript: string,
  signals: { noSpeech?: boolean } = {},
): Analysis {
  const expectedSkel = words.map((w) => normalizeArabic(w.text));
  const heard = stripOpening(splitHeard(transcript), expectedSkel);
  const expectedLetters = expectedSkel.join("").length;
  const heardLetters = heard.reduce((n, h) => n + h.skel.length, 0);

  if (signals.noSpeech || heard.length === 0 || heardLetters < expectedLetters * 0.25) {
    return {
      status: "unclear",
      message: "Je n'ai pas bien entendu ta récitation. Cet essai n'est pas compté.",
      tips: UNCLEAR_TIPS,
    };
  }

  const steps = alignWords(
    expectedSkel,
    heard.map((h) => h.skel),
  );

  const results: WordResult[] = words.map((w) => ({ index: w.index, text: w.text, status: "missing", rules: w.rules }));
  const inverted = new Set<number>();
  const added: { after: number; heard: string }[] = [];
  let lastExpected = -1;

  for (const step of steps as AlignPair[]) {
    if (step.kind === "pair") {
      results[step.e].status = classify(step.sim);
      results[step.e].heard = heard[step.h].raw;
      lastExpected = step.e;
    } else if (step.kind === "merge") {
      for (const e of [step.e, step.e + 1]) {
        results[e].status = classify(step.sim);
        results[e].heard = heard[step.h].raw;
      }
      lastExpected = step.e + 1;
    } else if (step.kind === "split") {
      results[step.e].status = classify(step.sim);
      results[step.e].heard = `${heard[step.h].raw} ${heard[step.h + 1].raw}`;
      lastExpected = step.e;
    } else if (step.kind === "swap") {
      results[step.e].status = "error";
      results[step.e].heard = heard[step.h + 1].raw;
      results[step.e + 1].status = "error";
      results[step.e + 1].heard = heard[step.h].raw;
      inverted.add(step.e);
      inverted.add(step.e + 1);
      lastExpected = step.e + 1;
    } else if (step.kind === "missing") {
      results[step.e].status = "missing";
      lastExpected = step.e;
    } else {
      added.push({ after: lastExpected, heard: heard[step.h].raw });
    }
  }

  const errors: TajweedError[] = [];
  results.forEach((r, e) => {
    if (r.status === "correct") return;
    const w = words[e];
    const firstRule = w.rules.find((id) => !RULES[id].subtle) ?? null;
    if (inverted.has(e)) {
      errors.push({ index: w.index, word: w.text, heard: r.heard ?? "", type: "inverted", rule: null, tip: "Relis l'ordre des mots lentement avant de réciter." });
      return;
    }
    if (r.status === "missing") {
      errors.push({
        index: w.index,
        word: w.text,
        heard: "",
        type: "missing",
        rule: null,
        tip: "Ce mot n'a pas été entendu : reprends le passage plus lentement, sans sauter de mot.",
      });
      return;
    }
    const heardSkel = normalizeArabic(r.heard ?? "");
    const ops = letterDiff(expectedSkel[e], heardSkel);
    const subs = ops.flatMap((o) => (o.op === "sub" ? [{ expected: o.expected, heard: o.heard }] : []));
    const sim = similarity(expectedSkel[e], heardSkel);
    const type: ErrorType = subs.length && sim >= 0.4 ? "letter" : sim >= 0.4 ? "partial" : "wrong";
    const confusion = subs.map((s) => confusionTip(s.expected, s.heard)).find(Boolean);
    errors.push({
      index: w.index,
      word: w.text,
      heard: r.heard ?? "",
      type,
      rule: subs.length ? "makharij" : firstRule,
      letters: subs.length ? subs : undefined,
      tip:
        confusion ??
        (type === "partial"
          ? "Une partie du mot semble manquer ou être en trop : prononce chaque lettre jusqu'au bout."
          : type === "wrong"
            ? "Le mot entendu est différent : relis-le lentement, syllabe par syllabe."
            : undefined),
    });
  });
  for (const a of added) {
    errors.push({
      index: a.after >= 0 ? words[a.after].index : -1,
      word: "",
      heard: a.heard,
      type: "added",
      rule: null,
      tip: "Un mot en trop a été entendu : vérifie que tu ne répètes pas un mot ou que tu n'ajoutes rien.",
    });
  }
  errors.sort((a, b) => a.index - b.index);

  const correct = results.filter((r) => r.status === "correct").length;
  const approx = results.filter((r) => r.status === "approx").length;
  if ((correct + approx) / words.length < 0.25) {
    return {
      status: "mismatch",
      message:
        "Ta récitation ne semble pas correspondre au passage choisi. Vérifie la sourate et les versets. Cet essai n'est pas compté.",
      tips: ["Relis le texte affiché avant de lancer l'enregistrement.", ...UNCLEAR_TIPS.slice(0, 2)],
    };
  }

  // Points d'attention : règles subtiles du passage (jamais présentées comme des fautes).
  const attentionMap = new Map<RuleId, number[]>();
  for (const w of words) {
    for (const id of w.rules) {
      if (!RULES[id].subtle || id === "tafkhim" || id === "ra") continue;
      const list = attentionMap.get(id) ?? [];
      list.push(w.index);
      attentionMap.set(id, list);
    }
  }
  const attention = [...attentionMap.entries()].slice(0, 5).map(([rule, ws]) => ({ rule, words: ws }));

  return {
    status: "ok",
    words: results,
    errors,
    correct,
    approx,
    total: words.length,
    attention,
    message: encouragement(correct / words.length),
  };
}

// --- Comparaison entre essais ------------------------------------------------------

export type Comparison = {
  previousErrors: number;
  currentErrors: number;
  /** Mots qui étaient faux et sont maintenant justes. */
  corrected: number[];
  remaining: number[];
  newErrors: number[];
};

const errorIndices = (errors: Pick<TajweedError, "index" | "type">[]) =>
  new Set(errors.filter((e) => e.type !== "added").map((e) => e.index));

export function compareAttempts(
  previous: Pick<TajweedError, "index" | "type">[],
  current: Pick<TajweedError, "index" | "type">[],
): Comparison {
  const prev = errorIndices(previous);
  const cur = errorIndices(current);
  return {
    previousErrors: previous.length,
    currentErrors: current.length,
    corrected: [...prev].filter((i) => !cur.has(i)).sort((a, b) => a - b),
    remaining: [...prev].filter((i) => cur.has(i)).sort((a, b) => a - b),
    newErrors: [...cur].filter((i) => !prev.has(i)).sort((a, b) => a - b),
  };
}

// --- Maîtrise ------------------------------------------------------------------------

export type Mastery = "work" | "progress" | "mastered";

export const MASTERY_LABELS: Record<Mastery, string> = {
  work: "À travailler",
  progress: "En progrès",
  mastered: "Maîtrisé",
};

export function masteryOf(bestRatio: number): Mastery {
  if (bestRatio >= MASTERY.mastered) return "mastered";
  if (bestRatio >= MASTERY.progress) return "progress";
  return "work";
}

/** Clé stable d'un passage : « 2:255-255 » ou « 2:255-255:0-13 » pour un segment. */
export function passageKey(ref: PassageRef): string {
  const base = `${ref.surah}:${ref.verseStart}-${ref.verseEnd}`;
  return ref.wordStart != null && ref.wordEnd != null ? `${base}:${ref.wordStart}-${ref.wordEnd}` : base;
}

export function parsePassageKey(key: string): PassageRef | null {
  const m = /^(\d{1,3}):(\d{1,3})-(\d{1,3})(?::(\d{1,3})-(\d{1,3}))?$/.exec(key);
  if (!m) return null;
  return {
    surah: Number(m[1]),
    verseStart: Number(m[2]),
    verseEnd: Number(m[3]),
    wordStart: m[4] != null ? Number(m[4]) : null,
    wordEnd: m[5] != null ? Number(m[5]) : null,
  };
}
