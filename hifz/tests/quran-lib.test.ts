import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ayahAudioUrl } from "@/lib/quran/audio";
import { getReciter, isValidRange, parseVerseKey, searchSurahs, verseKey } from "@/lib/quran/catalog";
import { createSurahLoader, QuranDataError, type SurahCache } from "@/lib/quran/loader";
import type { SurahData } from "@/lib/quran/types";

const fatiha = readFileSync(join(__dirname, "..", "public", "quran", "surah", "001.json"), "utf8");

function memoryCache(): SurahCache & { store: Map<number, { data: SurahData; sha: string }> } {
  const store = new Map<number, { data: SurahData; sha: string }>();
  return {
    store,
    async get(n, sha) {
      const hit = store.get(n);
      return hit && hit.sha === sha ? hit.data : undefined;
    },
    async put(data, sha) {
      store.set(data.number, { data, sha });
    },
  };
}

describe("catalogue", () => {
  it("construit et lit les clés de verset", () => {
    expect(verseKey(2, 255)).toBe("2:255");
    expect(parseVerseKey("2:255")).toEqual({ surah: 2, ayah: 255 });
    expect(parseVerseKey("2:287")).toBeNull();
    expect(parseVerseKey("115:1")).toBeNull();
    expect(parseVerseKey("abc")).toBeNull();
  });

  it("valide les plages de versets", () => {
    expect(isValidRange(1, 1, 7)).toBe(true);
    expect(isValidRange(1, 1, 8)).toBe(false);
    expect(isValidRange(2, 10, 5)).toBe(false);
    expect(isValidRange(0, 1, 1)).toBe(false);
  });

  it("recherche par numéro, translittération ou nom arabe", () => {
    expect(searchSurahs("18")[0]?.number).toBe(18);
    expect(searchSurahs("baqara").map((s) => s.number)).toContain(2);
    expect(searchSurahs("كهف").map((s) => s.number)).toContain(18);
    expect(searchSurahs("")).toHaveLength(114);
  });

  it("retombe sur le récitateur par défaut si l'identifiant est inconnu", () => {
    expect(getReciter("inconnu").id).toBe("Alafasy_128kbps");
  });
});

describe("audio", () => {
  it("construit l'URL EveryAyah", () => {
    expect(ayahAudioUrl("Alafasy_128kbps", 2, 5)).toBe("https://everyayah.com/data/Alafasy_128kbps/002005.mp3");
  });
  it("refuse un identifiant qui sortirait du dossier", () => {
    expect(() => ayahAudioUrl("../x", 1, 1)).toThrow();
  });
});

describe("chargement des sourates", () => {
  it("télécharge, vérifie l'empreinte, met en cache puis sert hors ligne", async () => {
    const cache = memoryCache();
    const fetchMock = vi.fn(async () => new Response(fatiha));
    const loader = createSurahLoader({ cache, fetch: fetchMock });
    const s = await loader.load(1);
    expect(s.ayahs).toHaveLength(7);
    expect(fetchMock).toHaveBeenCalledWith("/quran/surah/001.json");

    const offline = createSurahLoader({
      cache,
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect((await offline.load(1)).ayahs).toHaveLength(7);
  });

  it("refuse des données altérées", async () => {
    const altered = JSON.parse(fatiha) as SurahData;
    altered.ayahs[1]!.ar = altered.ayahs[1]!.ar.slice(1); // une lettre en moins
    const loader = createSurahLoader({ cache: memoryCache(), fetch: async () => new Response(JSON.stringify(altered)) });
    await expect(loader.load(1)).rejects.toMatchObject({ kind: "integrity" });
  });

  it("signale clairement l'absence de réseau", async () => {
    const loader = createSurahLoader({
      cache: memoryCache(),
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const error = await loader.load(1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QuranDataError);
    expect((error as QuranDataError).kind).toBe("offline");
  });

  it("signale une erreur HTTP", async () => {
    const loader = createSurahLoader({ cache: memoryCache(), fetch: async () => new Response("", { status: 503 }) });
    await expect(loader.load(1)).rejects.toMatchObject({ kind: "http" });
  });

  it("mutualise les chargements simultanés", async () => {
    const fetchMock = vi.fn(async () => new Response(fatiha));
    const loader = createSurahLoader({ cache: memoryCache(), fetch: fetchMock });
    await Promise.all([loader.load(1), loader.load(1)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
