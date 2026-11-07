import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { quranIndex } from "@/lib/quran/catalog";
import { quranIndexSchema, surahDataSchema } from "@/lib/quran/schema";
import type { SurahData } from "@/lib/quran/types";

const dir = join(__dirname, "..", "public", "quran", "surah");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const raw = files.map((f) => readFileSync(join(dir, f), "utf8"));
const data: SurahData[] = raw.map((t) => surahDataSchema.parse(JSON.parse(t)));

describe("données coraniques générées", () => {
  it("l'index respecte son schéma", () => {
    expect(() => quranIndexSchema.parse(quranIndex)).not.toThrow();
  });

  it("contient 114 sourates et 6236 versets", () => {
    expect(files).toHaveLength(114);
    expect(data.reduce((n, s) => n + s.ayahs.length, 0)).toBe(6236);
  });

  it("chaque fichier correspond à son empreinte SHA-256 (aucune retouche manuelle)", () => {
    raw.forEach((text, i) => {
      const meta = quranIndex.surahs[i]!;
      expect(createHash("sha256").update(text).digest("hex")).toBe(meta.sha256);
      expect(Buffer.byteLength(text)).toBe(meta.bytes);
    });
  });

  it("numérote les versets dans l'ordre, localement et globalement", () => {
    let g = 0;
    data.forEach((s, i) => {
      expect(s.number).toBe(i + 1);
      expect(s.ayahs).toHaveLength(quranIndex.surahs[i]!.ayahCount);
      expect(s.ayahs[0]!.g).toBe(quranIndex.surahs[i]!.firstAyah);
      s.ayahs.forEach((a, j) => {
        g++;
        expect(a.n).toBe(j + 1);
        expect(a.g).toBe(g);
      });
    });
  });

  it("sépare la basmala partout sauf en 1 (verset 1) et en 9", () => {
    data.forEach((s) => expect(s.basmala).toBe(s.number !== 1 && s.number !== 9));
    expect(data[0]!.ayahs[0]!.ar).toBe(quranIndex.basmala);
    for (const s of data.slice(1)) expect(s.ayahs[0]!.ar.startsWith(quranIndex.basmala)).toBe(false);
  });

  it("ne contient ni BOM ni espaces en bord de verset", () => {
    for (const s of data)
      for (const a of s.ayahs) {
        expect(a.ar.includes("﻿")).toBe(false);
        expect(a.ar).toBe(a.ar.trim());
      }
  });

  it("propose le récitateur par défaut en premier", () => {
    expect(quranIndex.reciters[0]!.id).toBe(quranIndex.defaultReciter);
  });
});
