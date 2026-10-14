import { describe, expect, it } from "vitest";
import raw from "quran-json/dist/quran_fr.json";
import { createMatcher, type SourceSurah } from "../src/lib/quran/matcher";
import { normalizeArabic, prepareQuery } from "../src/lib/quran/normalize";
import { present } from "../src/lib/quran/present";
import { SURAHS } from "../src/lib/quran/data";
import { evaluate, formatEvaluation } from "./helpers/evaluate";
import { rng } from "./helpers/noise";

const matcher = createMatcher(SURAHS as SourceSurah[]);

describe("données", () => {
  it("contient les 114 sourates et 6 236 versets", () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((n, s) => n + s.verses.length, 0)).toBe(6236);
  });

  it("le texte affiché est identique au paquet quran-json (jamais modifié)", () => {
    const source = raw as unknown as SourceSurah[];
    const r = present(matcher.match("الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم"), SURAHS);
    expect(r.verses[0].text).toBe(source[1].verses[254].text);
    expect(r.verses[0].translation).toBe(source[1].verses[254].translation);
  });
});

describe("normalisation", () => {
  it("rapproche l'orthographe uthmanie de l'écriture courante", () => {
    expect(normalizeArabic("ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ")).toBe(
      normalizeArabic("الحمد لله رب العالمين"),
    );
    expect(normalizeArabic("ٱلصَّلَوٰةَ")).toBe(normalizeArabic("الصلاة"));
    expect(normalizeArabic("يَٰٓأَيُّهَا")).toBe(normalizeArabic("يا أيها"));
    expect(normalizeArabic("عَلَىٰ")).toBe(normalizeArabic("على"));
  });

  it("retire isti'adha et basmala d'ouverture", () => {
    const q = prepareQuery("أعوذ بالله من الشيطان الرجيم بسم الله الرحمن الرحيم تبارك الذي بيده الملك");
    expect(q.normalized).toBe(normalizeArabic("تبارك الذي بيده الملك"));
    expect(prepareQuery("بسم الله الرحمن الرحيم").basmalaOnly).toBe(true);
  });
});

describe("cas connus", () => {
  it("Al-Fatiha (sourate courte : sourate seule)", () => {
    const res = present(
      matcher.match("بسم الله الرحمن الرحيم الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين"),
      SURAHS,
    );
    expect(res.surah?.number).toBe(1);
    expect(res.confidence).toBe("high");
    expect(res.showVerse).toBe(false);
    expect(res.verses).toEqual([]);
  });

  it("Al-Ikhlas", () => {
    const res = matcher.match("قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد");
    expect(res.best?.surah).toBe(112);
    expect(res.confidence).toBe("high");
    expect(res.isLongSurah).toBe(false);
  });

  it("Ayat al-Kursi (2:255, sourate longue : verset affiché)", () => {
    const res = present(
      matcher.match("الله لا إله إلا هو الحي القيوم لا تأخذه سنة ولا نوم له ما في السماوات وما في الأرض"),
      SURAHS,
    );
    expect(res.surah?.number).toBe(2);
    expect(res.confidence).toBe("high");
    expect(res.showVerse).toBe(true);
    expect(res.verseStart).toBe(255);
    expect(res.verses[0].number).toBe(255);
  });

  it("Ar-Rahman : verset répété → plusieurs versets possibles", () => {
    const res = present(matcher.match("فبأي آلاء ربكما تكذبان"), SURAHS);
    expect(res.surah?.number).toBe(55);
    expect(res.confidence).not.toBe("low");
    expect(res.otherVerses.length).toBe(30);
    expect([res.verseStart, ...res.otherVerses]).toContain(13);
    expect([res.verseStart, ...res.otherVerses]).toContain(77);
  });

  it("Ar-Rahman : passage précis (55:22)", () => {
    const res = matcher.match("يخرج منهما اللؤلؤ والمرجان فبأي آلاء ربكما تكذبان");
    expect(res.best?.surah).toBe(55);
    expect(res.best!.verseStart).toBeLessThanOrEqual(22);
    expect(res.best!.verseEnd).toBeGreaterThanOrEqual(22);
  });

  it("la basmala seule reste en confiance faible", () => {
    const res = matcher.match("بسم الله الرحمن الرحيم");
    expect(res.confidence).toBe("low");
    expect(res.lowReason).toBe("basmala");
  });

  it("un texte non coranique n'obtient jamais une confiance haute", () => {
    for (const text of [
      "ترجمة نانسي قنقر",
      "اشتركوا في القناة ولا تنسوا تفعيل زر الجرس",
      "ذهب الولد إلى المدرسة صباحا مع أصدقائه وكان الجو جميلا جدا اليوم",
      "أعلنت الحكومة اليوم عن خطة جديدة لتحسين الاقتصاد الوطني وزيادة فرص العمل للشباب",
      "",
      "hello world",
    ]) {
      expect(matcher.match(text).confidence).toBe("low");
    }
  });

  it("des suites de lettres aléatoires ne donnent pas de résultat confiant", () => {
    const random = rng(3);
    const letters = [..."ابتثجحخدذرزسشصضطظعغفقكلمنهوي"];
    for (let i = 0; i < 200; i++) {
      const words = Array.from({ length: 12 }, () =>
        Array.from({ length: 2 + Math.floor(random() * 5) }, () =>
          letters[Math.floor(random() * letters.length)],
        ).join(""),
      );
      expect(matcher.match(words.join(" ")).confidence).toBe("low");
    }
  });
});

describe("précision sur extraits bruités", () => {
  it("1 200 extraits, bruit standard (10 % de mots manquants, 5 % de lettres fausses)", () => {
    const e = evaluate(matcher, 1200, 42);
    console.log(formatEvaluation("Bruit standard", e));
    expect(e.surahAccuracy).toBeGreaterThanOrEqual(0.95);
    expect(e.verseAccuracy).toBeGreaterThanOrEqual(0.95);
    expect(e.highPrecision).toBeGreaterThanOrEqual(0.99);
    expect(e.mediumPrecision).toBeGreaterThanOrEqual(0.95);
  });

  it("400 extraits, bruit fort (20 % de mots manquants, 10 % de lettres fausses)", () => {
    const e = evaluate(matcher, 400, 7, {
      minWords: 5,
      maxWords: 15,
      dropWord: 0.2,
      wrongLetter: 0.1,
    });
    console.log(formatEvaluation("Bruit fort", e));
    expect(e.surahAccuracy).toBeGreaterThanOrEqual(0.85);
    expect(e.highPrecision).toBeGreaterThanOrEqual(0.98);
  });

  it("le seuil sourate courte / longue est configurable", () => {
    const strict = createMatcher(SURAHS as SourceSurah[], { longSurahThreshold: 5 });
    const res = strict.match("قل هو الله أحد الله الصمد لم يلد ولم يولد");
    expect(res.isLongSurah).toBe(false);
    const res2 = strict.match("إنا أعطيناك الكوثر فصل لربك وانحر إن شانئك هو الأبتر");
    expect(res2.isLongSurah).toBe(false);
    const res3 = strict.match("الحمد لله رب العالمين الرحمن الرحيم مالك يوم الدين");
    expect(res3.isLongSurah).toBe(true);
  });
});
