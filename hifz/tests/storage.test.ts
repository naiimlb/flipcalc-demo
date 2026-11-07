import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSurahLoader } from "@/lib/quran/loader";
import { backupFileName, exportBackup, importBackup, parseBackup } from "@/lib/storage/backup";
import { createDb, type HifzDB } from "@/lib/storage/db";
import { addProgram, getSettings, ProgramError, recordGrade, removeProgram, surahCache, updateSettings } from "@/lib/storage/repository";
import { DEFAULT_SETTINGS, normalizeSettings } from "@/lib/storage/settings";

let n = 0;
const open: HifzDB[] = [];
function freshDb(): HifzDB {
  const db = createDb(`test-${n++}`);
  open.push(db);
  return db;
}
afterEach(async () => {
  await Promise.all(open.splice(0).map((db) => db.delete()));
});

const NOW = new Date("2026-06-01T09:00:00");

describe("réglages", () => {
  it("renvoie les valeurs par défaut puis enregistre les modifications", async () => {
    const db = freshDb();
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
    await updateSettings(db, { dailyNewLimit: 5, theme: "dark" });
    expect(await getSettings(db)).toMatchObject({ dailyNewLimit: 5, theme: "dark", reciter: "Alafasy_128kbps" });
  });

  it("écarte les valeurs invalides au lieu de tout rejeter", () => {
    expect(normalizeSettings({ dailyNewLimit: 999, arabicSize: 36, inconnu: true })).toMatchObject({
      dailyNewLimit: DEFAULT_SETTINGS.dailyNewLimit,
      arabicSize: 36,
    });
  });
});

describe("programmes", () => {
  it("crée une fiche par verset dans l'ordre du programme", async () => {
    const db = freshDb();
    const { added } = await addProgram(db, { surah: 1, from: 1, to: 7 }, NOW);
    expect(added).toBe(7);
    await addProgram(db, { surah: 112, from: 1, to: 4 }, NOW);
    const cards = await db.cards.orderBy("rank").toArray();
    expect(cards.map((c) => c.key).slice(0, 2)).toEqual(["1:1", "1:2"]);
    expect(cards.at(-1)?.key).toBe("112:4");
    expect(cards.every((c) => c.state === "new")).toBe(true);
  });

  it("refuse une plage inexistante", async () => {
    await expect(addProgram(freshDb(), { surah: 1, from: 1, to: 8 })).rejects.toBeInstanceOf(ProgramError);
    await expect(addProgram(freshDb(), { surah: 2, from: 5, to: 3 })).rejects.toBeInstanceOf(ProgramError);
  });

  it("ne duplique pas les versets déjà suivis", async () => {
    const db = freshDb();
    await addProgram(db, { surah: 2, from: 1, to: 5 });
    const { added } = await addProgram(db, { surah: 2, from: 4, to: 10 });
    expect(added).toBe(5);
    expect(await db.cards.count()).toBe(10);
  });

  it("à la suppression, garde les versets commencés et ceux d'un autre programme", async () => {
    const db = freshDb();
    const { program } = await addProgram(db, { surah: 2, from: 1, to: 5 });
    await addProgram(db, { surah: 2, from: 5, to: 6 });
    await recordGrade(db, "2:1", "good", NOW);
    const { removedCards } = await removeProgram(db, program.id);
    expect(removedCards).toBe(3); // 2:2, 2:3, 2:4
    expect((await db.cards.toArray()).map((c) => c.key).sort()).toEqual(["2:1", "2:5", "2:6"]);
  });
});

describe("évaluations", () => {
  it("met à jour la fiche et journalise la révision", async () => {
    const db = freshDb();
    await addProgram(db, { surah: 1, from: 1, to: 2 });
    const card = await recordGrade(db, "1:1", "good", NOW);
    expect(card).toMatchObject({ state: "learning", due: "2026-06-02", introduced: "2026-06-01" });
    expect(await db.reviews.toArray()).toMatchObject([{ key: "1:1", day: "2026-06-01", grade: "good" }]);
  });

  it("signale un verset absent", async () => {
    await expect(recordGrade(freshDb(), "1:1", "good")).rejects.toThrow(/introuvable/);
  });
});

describe("cache des sourates", () => {
  it("sert une sourate déjà téléchargée sans réseau, et l'invalide si l'empreinte change", async () => {
    const db = freshDb();
    const text = readFileSync(join(__dirname, "..", "public", "quran", "surah", "112.json"), "utf8");
    const online = createSurahLoader({ cache: surahCache(db), fetch: async () => new Response(text) });
    await online.load(112);
    const offline = createSurahLoader({
      cache: surahCache(db),
      fetch: async () => {
        throw new TypeError("offline");
      },
    });
    expect((await offline.load(112)).ayahs).toHaveLength(4);
    expect(await surahCache(db).get(112, "0".repeat(64))).toBeUndefined();
  });
});

describe("export et import", () => {
  it("restaure exactement les données exportées", async () => {
    const source = freshDb();
    await updateSettings(source, { reciter: "Husary_128kbps", showTranslation: true });
    await addProgram(source, { surah: 1, from: 1, to: 7 }, NOW);
    await recordGrade(source, "1:1", "good", NOW);
    await recordGrade(source, "1:2", "again", NOW);
    const backup = await exportBackup(source, NOW);

    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const target = freshDb();
    await addProgram(target, { surah: 2, from: 1, to: 3 }); // sera remplacé
    await importBackup(target, parsed.backup);
    expect(await exportBackup(target, NOW)).toEqual(backup);
  });

  it("refuse un fichier qui n'est pas du JSON", () => {
    expect(parseBackup("pas du json")).toEqual({ ok: false, error: "Ce fichier n'est pas un JSON valide." });
  });

  it("refuse une sauvegarde d'une autre app ou mal formée, avec un message précis", async () => {
    expect(parseBackup(JSON.stringify({ app: "autre" })).ok).toBe(false);
    const db = freshDb();
    await addProgram(db, { surah: 1, from: 1, to: 2 });
    const backup = await exportBackup(db, NOW);
    backup.data.cards[0]!.key = "1:99";
    const result = parseBackup(JSON.stringify(backup));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/data\.cards\.0/);
  });

  it("refuse les doublons de versets", async () => {
    const db = freshDb();
    await addProgram(db, { surah: 1, from: 1, to: 2 });
    const backup = await exportBackup(db, NOW);
    backup.data.cards.push(backup.data.cards[0]!);
    const result = parseBackup(JSON.stringify(backup));
    expect(result).toMatchObject({ ok: false });
  });

  it("nomme le fichier avec la date", () => {
    expect(backupFileName(NOW)).toBe("hifz-sauvegarde-2026-06-01.json");
  });
});
