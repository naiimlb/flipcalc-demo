import { describe, expect, it } from "vitest";
import { SURAHS } from "../src/lib/quran/data";
import { alignWords, letterDiff, similarity } from "../src/lib/tajweed/align";
import {
  analyzeRecitation,
  buildPassage,
  compareAttempts,
  masteryOf,
  parsePassageKey,
  passageKey,
  passageWords,
  proposeSegments,
  validateRef,
  type PassageRef,
} from "../src/lib/tajweed/analyze";
import { errorEvolution, streakDays, summarizePassages, weakRules, type SessionRow } from "../src/lib/tajweed/history";
import { RULES, type RuleId } from "../src/lib/tajweed/rules";
import { normalizeArabic } from "../src/lib/quran/normalize";
import { rng, toPlainArabic } from "./helpers/noise";

const words = (ref: PassageRef) => passageWords(SURAHS, ref);
/** Mot du passage dont le squelette (lettres sans signes) est celui de `word`. */
function wordOf(ref: PassageRef, word: string) {
  const w = words(ref).find((x) => normalizeArabic(x.text) === normalizeArabic(word));
  if (!w) throw new Error(`mot introuvable : ${word}`);
  return w;
}
const rulesOf = (ref: PassageRef, word: string): RuleId[] => wordOf(ref, word).rules;
const v = (surah: number, a: number, b = a): PassageRef => ({ surah, verseStart: a, verseEnd: b });
/** Transcription « parfaite » simulée (écriture courante, sans voyelles). */
const plain = (ref: PassageRef) => words(ref).map((w) => toPlainArabic(w.text)).join(" ");

describe("détecteur de règles de tajweed", () => {
  it("Al-Fatiha : nom d'Allah, lam solaire/lunaire, madd lazim et madd 'arid", () => {
    expect(rulesOf(v(1, 1), "ٱللَّهِ")).toContain("lafdh_jalala");
    expect(rulesOf(v(1, 1), "ٱلرَّحۡمَٰنِ")).toContain("lam_shamsiyya");
    expect(rulesOf(v(1, 1), "ٱلرَّحِيمِ")).toContain("madd_arid");
    expect(rulesOf(v(1, 2), "ٱلۡحَمۡدُ")).toContain("lam_qamariyya");
    expect(rulesOf(v(1, 7), "ٱلضَّآلِّينَ")).toEqual(expect.arrayContaining(["madd_lazim", "lam_shamsiyya", "tafkhim"]));
  });

  it("Al-Ikhlas : qalqala à l'arrêt, idgham sans ghunna, idhhar du tanwin", () => {
    expect(rulesOf(v(112, 1), "أَحَدٌ")).toContain("qalqala");
    expect(rulesOf(v(112, 4), "يَكُن")).toContain("idgham_sans_ghunna");
    expect(rulesOf(v(112, 4), "كُفُوًا")).toContain("idhhar");
  });

  it("noun sakin et tanwin : ikhfa, idgham avec ghunna, iqlab", () => {
    expect(rulesOf(v(2, 255), "مَن")).toContain("ikhfa");
    expect(rulesOf(v(2, 8), "مَن")).toContain("idgham_ghunna");
    expect(rulesOf(v(2, 5), "هدى")).toContain("idgham_ghunna");
    expect(rulesOf(v(2, 2), "هدى")).toContain("idgham_sans_ghunna");
    expect(rulesOf(v(2, 255), "بشيء")).toContain("idgham_ghunna");
    expect(rulesOf(v(2, 10), "أَلِيمُۢ")).toContain("iqlab");
  });

  it("mim sakin : ikhfa et idgham shafawi ; ghunna sur mim doublé", () => {
    expect(rulesOf(v(105, 4), "تَرۡمِيهِم")).toContain("ikhfa_shafawi");
    expect(rulesOf(v(2, 10), "قُلُوبِهِم")).toContain("idgham_shafawi");
    expect(rulesOf(v(2, 10), "مَّرَضٞ")).toContain("ghunna");
  });

  it("hamza + alif (آ) n'est pas un madd lazim", () => {
    expect(rulesOf(v(2, 8), "الآخر")).not.toContain("madd_lazim");
  });

  it("madd muttasil et munfasil", () => {
    expect(rulesOf(v(2, 4), "بِمَآ")).toContain("madd_munfasil");
    expect(rulesOf(v(2, 22), "وَٱلسَّمَآءَ")).toContain("madd_muttasil");
  });

  it("signes de pause", () => {
    const w = wordOf(v(2, 255), "القيوم");
    expect(w.rules).toContain("waqf");
    expect(w.waqf).toBe("arrêt permis (ج)");
  });

  it("chaque règle a un nom arabe, un nom français, une leçon et un conseil", () => {
    for (const r of Object.values(RULES)) {
      expect(r.nameAr.length).toBeGreaterThan(0);
      expect(r.lesson.length).toBeGreaterThan(20);
      expect(r.tip.length).toBeGreaterThan(10);
    }
  });

  it("ne modifie jamais le texte : les mots recollés redonnent le verset exact", () => {
    for (const ref of [v(1, 1), v(2, 255), v(36, 1, 3), v(112, 1, 4)]) {
      const text = SURAHS[ref.surah - 1].verses
        .filter((x) => x.id >= ref.verseStart && x.id <= ref.verseEnd)
        .map((x) => x.text)
        .join(" ");
      expect(words(ref).map((w) => w.text).join(" ")).toBe(text.split(/\s+/).join(" "));
    }
  });
});

describe("alignement", () => {
  it("similarité et différences lettre à lettre", () => {
    expect(similarity("رحمن", "رحمن")).toBe(1);
    expect(letterDiff("حمد", "همد")).toEqual([
      { op: "sub", expected: "ح", heard: "ه" },
      { op: "same", expected: "م" },
      { op: "same", expected: "د" },
    ]);
  });

  it("gère les mots collés et les mots manquants", () => {
    const steps = alignWords(["قل", "هو", "لله", "حد"], ["قلهو", "لله"]);
    expect(steps.map((s) => s.kind)).toEqual(["merge", "pair", "missing"]);
  });
});

describe("analyse d'une récitation", () => {
  it("récitation juste : tous les mots en vert", () => {
    const p = buildPassage(SURAHS, v(112, 1, 4));
    const a = analyzeRecitation(p.words, plain(v(112, 1, 4)));
    expect(a.status).toBe("ok");
    if (a.status !== "ok") return;
    expect(a.correct).toBe(a.total);
    expect(a.errors).toEqual([]);
    expect(a.message).toContain("Magnifique");
  });

  it("isti'adha et basmala d'ouverture ne comptent pas comme mots ajoutés", () => {
    const p = buildPassage(SURAHS, v(112, 1, 2));
    const a = analyzeRecitation(p.words, `أعوذ بالله من الشيطان الرجيم بسم الله الرحمن الرحيم ${plain(v(112, 1, 2))}`);
    expect(a.status === "ok" && a.errors).toEqual([]);
  });

  it("lettre confondue (ح → ه) : erreur liée aux makharij avec conseil précis", () => {
    const p = buildPassage(SURAHS, v(1, 2));
    const a = analyzeRecitation(p.words, "الهمد لله رب العالمين");
    expect(a.status).toBe("ok");
    if (a.status !== "ok") return;
    const e = a.errors[0];
    expect(e.index).toBe(0);
    expect(e.type).toBe("letter");
    expect(e.rule).toBe("makharij");
    expect(e.letters).toEqual([{ expected: "ح", heard: "ه" }]);
    expect(e.tip).toContain("gorge");
    expect(a.words[0].status).toBe("approx");
  });

  it("mot oublié et mot ajouté", () => {
    const p = buildPassage(SURAHS, v(112, 1));
    const missing = analyzeRecitation(p.words, "قل هو الله");
    expect(missing.status === "ok" && missing.errors.map((e) => e.type)).toEqual(["missing"]);
    const extra = analyzeRecitation(p.words, "قل هو الله الله أحد");
    expect(extra.status === "ok" && extra.errors.map((e) => e.type)).toEqual(["added"]);
  });

  it("mots inversés", () => {
    const p = buildPassage(SURAHS, v(1, 2));
    const a = analyzeRecitation(p.words, "الحمد رب لله العالمين");
    expect(a.status === "ok" && a.errors.map((e) => e.type)).toEqual(["inverted", "inverted"]);
  });

  it("audio vide ou incompris : pas de note, essai non compté", () => {
    const p = buildPassage(SURAHS, v(2, 255));
    expect(analyzeRecitation(p.words, "").status).toBe("unclear");
    expect(analyzeRecitation(p.words, "الله", { noSpeech: true }).status).toBe("unclear");
  });

  it("autre passage récité : signalé, sans note", () => {
    const p = buildPassage(SURAHS, v(112, 1, 4));
    expect(analyzeRecitation(p.words, plain(v(114, 1, 4))).status).toBe("mismatch");
  });

  it("les règles subtiles sont des points d'attention, pas des fautes", () => {
    const p = buildPassage(SURAHS, v(1, 7));
    const a = analyzeRecitation(p.words, plain(v(1, 7)));
    expect(a.status).toBe("ok");
    if (a.status !== "ok") return;
    expect(a.errors).toEqual([]);
    expect(a.attention.map((x) => x.rule)).toContain("madd_lazim");
  });
});

describe("passages, segments et progression", () => {
  it("valide les bornes (1 à 3 versets)", () => {
    expect(validateRef(SURAHS, v(2, 1, 3))).toBeNull();
    expect(validateRef(SURAHS, v(2, 1, 4))).toContain("3 versets");
    expect(validateRef(SURAHS, v(1, 8))).toBe("Versets invalides.");
    expect(validateRef(SURAHS, v(115, 1))).toBe("Sourate inconnue.");
  });

  it("découpe Ayat al-Kursi en segments contigus de 14 mots au plus", () => {
    const all = words(v(2, 255));
    const segs = proposeSegments(all);
    expect(segs.length).toBeGreaterThan(2);
    expect(segs[0].start).toBe(0);
    expect(segs[segs.length - 1].end).toBe(all.length - 1);
    for (let i = 0; i < segs.length; i++) {
      expect(segs[i].end - segs[i].start + 1).toBeLessThanOrEqual(14);
      if (i) expect(segs[i].start).toBe(segs[i - 1].end + 1);
    }
    const seg = buildPassage(SURAHS, { ...v(2, 255), wordStart: segs[1].start, wordEnd: segs[1].end });
    expect(seg.words[0].index).toBe(segs[1].start);
    expect(proposeSegments(words(v(112, 1, 4)))).toEqual([]);
  });

  it("compare deux essais : mots corrigés, restants et nouvelles erreurs", () => {
    const c = compareAttempts(
      [{ index: 1, type: "letter" }, { index: 3, type: "missing" }, { index: 5, type: "wrong" }],
      [{ index: 3, type: "letter" }, { index: 6, type: "partial" }],
    );
    expect(c.corrected).toEqual([1, 5]);
    expect(c.remaining).toEqual([3]);
    expect(c.newErrors).toEqual([6]);
    expect([c.previousErrors, c.currentErrors]).toEqual([3, 2]);
  });

  it("niveaux de maîtrise et clés de passage", () => {
    expect([masteryOf(0.3), masteryOf(0.7), masteryOf(0.95)]).toEqual(["work", "progress", "mastered"]);
    const ref = { surah: 2, verseStart: 255, verseEnd: 255, wordStart: 0, wordEnd: 13 };
    expect(parsePassageKey(passageKey(ref))).toEqual(ref);
    expect(parsePassageKey("2:1-3")).toEqual({ surah: 2, verseStart: 1, verseEnd: 3, wordStart: null, wordEnd: null });
  });
});

describe("mesures sur 300 passages tirés au hasard", () => {
  const random = rng(2026);
  const LETTERS = [..."بتثجحخدذرزسشصضطظعغفقكلمنهوي"];
  const samples = Array.from({ length: 300 }, () => {
    const s = SURAHS[Math.floor(random() * SURAHS.length)];
    const a = 1 + Math.floor(random() * s.verses.length);
    return v(s.id, a);
  });

  it("récitation parfaite : moins de 1 % de mots signalés à tort", () => {
    let flagged = 0;
    let total = 0;
    for (const ref of samples) {
      const p = buildPassage(SURAHS, ref);
      const a = analyzeRecitation(p.words, plain(ref));
      expect(a.status).toBe("ok");
      if (a.status !== "ok") continue;
      flagged += a.total - a.correct;
      total += a.total;
    }
    console.log(`Fausses alertes sur récitation parfaite : ${flagged}/${total} mots (${((flagged / total) * 100).toFixed(2)} %)`);
    expect(flagged / total).toBeLessThan(0.01);
  });

  it("une lettre confondue ou un mot oublié est détecté au bon endroit", () => {
    let letterHits = 0;
    let missingHits = 0;
    let n = 0;
    for (const ref of samples) {
      const p = buildPassage(SURAHS, ref);
      const heard = p.words.map((w) => toPlainArabic(w.text));
      if (heard.length < 3) continue;
      n++;
      const k = Math.floor(random() * heard.length);
      // Lettre confondue : on remplace la première lettre comparable du mot k.
      const chars = [...heard[k]];
      const pos = chars.findIndex((c) => LETTERS.includes(c));
      if (pos >= 0) chars[pos] = chars[pos] === "ه" ? "ح" : "ه";
      const withLetter = [...heard.slice(0, k), chars.join(""), ...heard.slice(k + 1)].join(" ");
      const a1 = analyzeRecitation(p.words, withLetter);
      if (a1.status === "ok" && a1.errors.some((e) => e.index === p.words[k].index)) letterHits++;
      const withMissing = [...heard.slice(0, k), ...heard.slice(k + 1)].join(" ");
      const a2 = analyzeRecitation(p.words, withMissing);
      if (a2.status === "ok" && a2.errors.some((e) => e.type === "missing" && Math.abs(e.index - p.words[k].index) <= 1)) missingHits++;
    }
    console.log(`Lettre confondue détectée : ${letterHits}/${n} (${((letterHits / n) * 100).toFixed(1)} %)`);
    console.log(`Mot oublié détecté : ${missingHits}/${n} (${((missingHits / n) * 100).toFixed(1)} %)`);
    expect(letterHits / n).toBeGreaterThan(0.95);
    expect(missingHits / n).toBeGreaterThan(0.95);
  });
});

describe("historique Tajweed", () => {
  const row = (over: Partial<SessionRow>): SessionRow => ({
    id: Math.random().toString(36),
    surah: 112,
    verse_start: 1,
    verse_end: 2,
    word_start: null,
    word_end: null,
    attempt_number: 1,
    correct_words: 5,
    total_words: 10,
    errors: [],
    created_at: "2026-10-01T10:00:00Z",
    ...over,
  });

  it("regroupe par passage avec meilleur score, essais et maîtrise", () => {
    const rows = [
      row({ correct_words: 5, created_at: "2026-10-01T10:00:00Z" }),
      row({ correct_words: 9, created_at: "2026-10-02T10:00:00Z", attempt_number: 2 }),
      row({ surah: 1, verse_start: 1, verse_end: 1, correct_words: 4, total_words: 4, created_at: "2026-09-30T10:00:00Z" }),
    ];
    const [first, second] = summarizePassages(rows);
    expect(first.key).toBe("112:1-2");
    expect([first.attempts, first.best, first.last, first.mastery]).toEqual([2, 0.9, 0.9, "mastered"]);
    expect(first.scores).toEqual([0.5, 0.9]);
    expect(second.mastery).toBe("mastered");
  });

  it("points faibles et erreurs corrigées / récurrentes", () => {
    const rows = [
      row({ created_at: "2026-10-01T10:00:00Z", errors: [
        { index: 1, word: "", heard: "", type: "letter", rule: "makharij" },
        { index: 4, word: "", heard: "", type: "missing", rule: null },
      ] }),
      row({ created_at: "2026-10-02T10:00:00Z", errors: [{ index: 4, word: "", heard: "", type: "missing", rule: null }] }),
    ];
    expect(weakRules(rows)).toEqual([{ rule: "makharij", count: 1 }]);
    expect(errorEvolution(rows)).toEqual({ corrected: [1], recurring: [4] });
  });

  it("série de jours consécutifs", () => {
    const now = new Date(2026, 9, 19, 12);
    const d = (day: number) => new Date(2026, 9, day, 9);
    expect(streakDays([d(19), d(18), d(17), d(15)], now)).toBe(3);
    expect(streakDays([d(18), d(17)], now)).toBe(2);
    expect(streakDays([d(16)], now)).toBe(0);
    expect(streakDays([], now)).toBe(0);
  });
});
