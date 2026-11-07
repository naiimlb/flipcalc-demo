import { z } from "zod";

export const ayahSchema = z.object({
  n: z.number().int().positive(),
  g: z.number().int().min(1).max(6236),
  ar: z.string().min(1),
  fr: z.string().min(1),
  juz: z.number().int().min(1).max(30),
  page: z.number().int().min(1).max(604),
  sajda: z.boolean().optional(),
});

export const surahDataSchema = z.object({
  number: z.number().int().min(1).max(114),
  basmala: z.boolean(),
  ayahs: z.array(ayahSchema).min(1),
});

export const reciterSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  name: z.string().min(1),
  style: z.enum(["murattal", "enseignement"]),
  bitrate: z.string(),
});

export const quranIndexSchema = z.object({
  schema: z.literal(1),
  fetchedAt: z.iso.datetime(),
  sources: z.object({
    text: z.object({ provider: z.string(), edition: z.string(), url: z.url(), origin: z.string() }),
    translation: z.object({ provider: z.string(), edition: z.string(), url: z.url(), author: z.string() }),
    audio: z.object({ provider: z.string(), url: z.url() }),
  }),
  totals: z.object({ surahs: z.literal(114), ayahs: z.literal(6236) }),
  basmala: z.string().min(1),
  defaultReciter: z.string(),
  reciters: z.array(reciterSchema).min(1),
  surahs: z
    .array(
      z.object({
        number: z.number().int(),
        nameAr: z.string().min(1),
        transliteration: z.string().min(1),
        revelation: z.enum(["meccan", "medinan"]),
        ayahCount: z.number().int().positive(),
        firstAyah: z.number().int().positive(),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        bytes: z.number().int().positive(),
      }),
    )
    .length(114),
});
