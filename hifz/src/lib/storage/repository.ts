import type { SurahCache } from "@/lib/quran/loader";
import { getSurahMeta, isValidRange } from "@/lib/quran/catalog";
import { createCard, schedule, toDayKey, type Grade, type SrsCard } from "@/lib/srs";
import type { HifzDB, Program, ReviewLog } from "./db";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "./settings";

export async function getSettings(db: HifzDB): Promise<Settings> {
  const row = await db.settings.get("app");
  return row ? normalizeSettings(row) : DEFAULT_SETTINGS;
}

export async function updateSettings(db: HifzDB, patch: Partial<Settings>): Promise<Settings> {
  return db.transaction("rw", db.settings, async () => {
    const next = normalizeSettings({ ...(await getSettings(db)), ...patch });
    await db.settings.put({ id: "app", ...next });
    return next;
  });
}

export class ProgramError extends Error {}

/** Ajoute une plage de versets ; les versets déjà suivis par un autre programme sont conservés tels quels. */
export async function addProgram(
  db: HifzDB,
  input: { surah: number; from: number; to: number },
  now: Date = new Date(),
): Promise<{ program: Program; added: number }> {
  const { surah, from, to } = input;
  if (!isValidRange(surah, from, to)) {
    const meta = getSurahMeta(surah);
    throw new ProgramError(
      meta ? `Plage invalide : la sourate ${meta.transliteration} compte ${meta.ayahCount} versets.` : "Sourate inconnue.",
    );
  }
  return db.transaction("rw", db.programs, db.cards, async () => {
    const last = await db.programs.orderBy("seq").last();
    const program: Program = {
      id: crypto.randomUUID(),
      surah,
      from,
      to,
      seq: (last?.seq ?? 0) + 1,
      createdAt: now.toISOString(),
    };
    await db.programs.add(program);
    const keys = Array.from({ length: to - from + 1 }, (_, i) => `${surah}:${from + i}`);
    const existing = new Set((await db.cards.bulkGet(keys)).filter(Boolean).map((c) => c!.key));
    const fresh = keys
      .filter((k) => !existing.has(k))
      .map((k) => {
        const ayah = Number(k.split(":")[1]);
        return createCard(surah, ayah, program.seq * 1000 + ayah);
      });
    await db.cards.bulkAdd(fresh);
    return { program, added: fresh.length };
  });
}

/**
 * Retire un programme. Les versets jamais commencés (et non couverts par un autre programme)
 * sont supprimés ; ceux déjà appris restent en révision pour ne pas être oubliés.
 */
export async function removeProgram(db: HifzDB, id: string): Promise<{ removedCards: number }> {
  return db.transaction("rw", db.programs, db.cards, async () => {
    const program = await db.programs.get(id);
    if (!program) return { removedCards: 0 };
    await db.programs.delete(id);
    const others = await db.programs.where("id").notEqual(id).toArray();
    const covered = (ayah: number) => others.some((p) => p.surah === program.surah && ayah >= p.from && ayah <= p.to);
    const keys: string[] = [];
    for (let a = program.from; a <= program.to; a++) if (!covered(a)) keys.push(`${program.surah}:${a}`);
    const toRemove = (await db.cards.bulkGet(keys)).filter((c): c is SrsCard => !!c && c.state === "new").map((c) => c.key);
    await db.cards.bulkDelete(toRemove);
    return { removedCards: toRemove.length };
  });
}

/** Enregistre une auto-évaluation : met à jour la fiche et ajoute une ligne au journal. */
export async function recordGrade(db: HifzDB, key: string, grade: Grade, now: Date = new Date()): Promise<SrsCard> {
  const today = toDayKey(now);
  return db.transaction("rw", db.cards, db.reviews, async () => {
    const card = await db.cards.get(key);
    if (!card) throw new Error(`Verset ${key} introuvable dans vos programmes.`);
    const next = schedule(card, grade, today);
    await db.cards.put(next);
    const log: ReviewLog = { key, day: today, grade, at: now.toISOString() };
    await db.reviews.add(log);
    return next;
  });
}

/** Adaptateur du cache de sourates pour lib/quran. */
export function surahCache(db: HifzDB): SurahCache {
  return {
    async get(number, sha256) {
      const row = await db.surahs.get(number);
      return row && row.sha256 === sha256 ? row.data : undefined;
    },
    async put(data, sha256) {
      await db.surahs.put({ number: data.number, sha256, data, savedAt: new Date().toISOString() });
    },
  };
}
