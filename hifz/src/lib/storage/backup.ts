import { z } from "zod";
import { isValidRange, parseVerseKey } from "@/lib/quran/catalog";
import { isDayKey, toDayKey } from "@/lib/srs/dates";
import type { HifzDB, Program, ReviewLog } from "./db";
import { normalizeSettings, type Settings } from "./settings";
import type { SrsCard } from "@/lib/srs";

export const BACKUP_FORMAT = 1;

const dayKey = z.string().refine(isDayKey, "jour invalide");
const grade = z.enum(["good", "hard", "again"]);

const cardSchema = z
  .object({
    key: z.string(),
    surah: z.number().int(),
    ayah: z.number().int(),
    rank: z.number().int().nonnegative(),
    state: z.enum(["new", "learning", "mastered"]),
    ease: z.number().min(1).max(5),
    interval: z.number().int().min(0).max(36500),
    reps: z.number().int().nonnegative(),
    lapses: z.number().int().nonnegative(),
    due: dayKey.nullable(),
    lastReview: dayKey.nullable(),
    lastGrade: grade.nullable(),
    introduced: dayKey.nullable(),
  })
  .refine((c) => {
    const parsed = parseVerseKey(c.key);
    return parsed !== null && parsed.surah === c.surah && parsed.ayah === c.ayah;
  }, "verset inexistant ou clé incohérente")
  .refine((c) => (c.state === "new") === (c.due === null), "date de révision incohérente avec l'état");

const programSchema = z
  .object({
    id: z.string().min(1),
    surah: z.number().int(),
    from: z.number().int(),
    to: z.number().int(),
    seq: z.number().int().positive(),
    createdAt: z.iso.datetime(),
  })
  .refine((p) => isValidRange(p.surah, p.from, p.to), "plage de versets inexistante");

const reviewSchema = z.object({
  key: z.string().refine((k) => parseVerseKey(k) !== null, "verset inexistant"),
  day: dayKey,
  grade,
  at: z.iso.datetime(),
});

export const backupSchema = z.object({
  app: z.literal("hifz"),
  format: z.literal(BACKUP_FORMAT),
  exportedAt: z.iso.datetime(),
  data: z.object({
    settings: z.record(z.string(), z.unknown()),
    programs: z.array(programSchema),
    cards: z.array(cardSchema),
    reviews: z.array(reviewSchema),
  }),
});

export interface Backup {
  app: "hifz";
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  data: { settings: Settings; programs: Program[]; cards: SrsCard[]; reviews: Omit<ReviewLog, "id">[] };
}

export async function exportBackup(db: HifzDB, now: Date = new Date()): Promise<Backup> {
  return db.transaction("r", [db.settings, db.programs, db.cards, db.reviews], async () => {
    const row = await db.settings.get("app");
    return {
      app: "hifz",
      format: BACKUP_FORMAT,
      exportedAt: now.toISOString(),
      data: {
        settings: normalizeSettings(row ?? {}),
        programs: await db.programs.orderBy("seq").toArray(),
        cards: await db.cards.orderBy("rank").toArray(),
        reviews: (await db.reviews.toArray()).map(({ key, day, grade, at }) => ({ key, day, grade, at })),
      },
    };
  });
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Lit et valide un fichier de sauvegarde (texte JSON). Ne modifie rien. */
export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce fichier n'est pas un JSON valide." };
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return { ok: false, error: `Sauvegarde Hifz invalide${where} : ${issue?.message ?? "format inconnu"}.` };
  }
  const { data } = result.data;
  const keys = new Set<string>();
  for (const c of data.cards) {
    if (keys.has(c.key)) return { ok: false, error: `Sauvegarde invalide : le verset ${c.key} apparaît deux fois.` };
    keys.add(c.key);
  }
  return {
    ok: true,
    backup: { ...result.data, data: { ...data, settings: normalizeSettings(data.settings) } } as Backup,
  };
}

/** Remplace toutes les données de progression par celles de la sauvegarde (cache des sourates conservé). */
export async function importBackup(db: HifzDB, backup: Backup): Promise<void> {
  await db.transaction("rw", [db.settings, db.programs, db.cards, db.reviews], async () => {
    await Promise.all([db.programs.clear(), db.cards.clear(), db.reviews.clear(), db.settings.clear()]);
    await db.settings.put({ id: "app", ...backup.data.settings });
    await db.programs.bulkAdd(backup.data.programs);
    await db.cards.bulkAdd(backup.data.cards);
    await db.reviews.bulkAdd(backup.data.reviews);
  });
}

export function backupFileName(now: Date = new Date()): string {
  return `hifz-sauvegarde-${toDayKey(now)}.json`;
}
