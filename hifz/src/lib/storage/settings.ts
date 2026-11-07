import { z } from "zod";
import { defaultReciterId } from "@/lib/quran/catalog";

export const ARABIC_SIZE = { min: 22, max: 48, step: 2 } as const;
export const DAILY_NEW = { min: 0, max: 20 } as const;
export const REPEAT = { min: 1, max: 10 } as const;
export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;

export const settingsSchema = z.object({
  reciter: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  arabicFont: z.enum(["amiri", "scheherazade"]),
  arabicSize: z.number().int().min(ARABIC_SIZE.min).max(ARABIC_SIZE.max),
  dailyNewLimit: z.number().int().min(DAILY_NEW.min).max(DAILY_NEW.max),
  repeatCount: z.number().int().min(REPEAT.min).max(REPEAT.max),
  playbackRate: z.number().min(0.5).max(1.5),
  showTranslation: z.boolean(),
  theme: z.enum(["system", "light", "dark"]),
  cacheAudio: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  reciter: defaultReciterId,
  arabicFont: "amiri",
  arabicSize: 30,
  dailyNewLimit: 3,
  repeatCount: 3,
  playbackRate: 1,
  showTranslation: true,
  theme: "system",
  cacheAudio: true,
};

/** Complète des réglages partiels ou anciens avec les valeurs par défaut, en écartant les valeurs invalides. */
export function normalizeSettings(input: unknown): Settings {
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  if (input && typeof input === "object") {
    for (const [key, value] of Object.entries(input)) {
      if (!(key in DEFAULT_SETTINGS)) continue;
      const field = settingsSchema.shape[key as keyof Settings];
      if (field.safeParse(value).success) merged[key] = value;
    }
  }
  return settingsSchema.parse(merged);
}
