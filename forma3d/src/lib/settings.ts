import { z } from "zod";
import { DEFAULT_SYSTEM_PROMPT } from "./design/prompt";

/* Réglages modifiables depuis /admin, stockés dans la table app_settings (une ligne par clé). */

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = z.string().regex(HEX, "Couleur hexadécimale attendue (#rrggbb).");
const LOGO_PREFIX = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

export const SiteSettingsSchema = z.object({
  siteName: z.string().trim().min(1).max(40),
  heroPill: z.string().trim().max(24),
  heroTitle: z.string().trim().max(60),
  heroTitleLine2: z.string().trim().max(60),
  heroSubtitle: z.string().trim().max(260),
  colorFrom: hex,
  colorTo: hex,
  accent: hex,
  logoDataUrl: z
    .string()
    .max(200_000, "Logo trop lourd (150 Ko maximum).")
    .regex(LOGO_PREFIX, "Logo : PNG, JPEG, WebP ou SVG.")
    .nullable(),
  footerText: z.string().trim().max(160),
});
export type SiteSettings = z.infer<typeof SiteSettingsSchema>;

export const DEFAULT_SITE: SiteSettings = {
  siteName: "Forma3D",
  heroPill: "Décrivez",
  heroTitle: "un problème,",
  heroTitleLine2: "obtenez sa solution 3D",
  heroSubtitle:
    "Forma3D analyse votre besoin, conçoit une solution fabricable et la modélise en 3D interactive, prête à imprimer ou à fabriquer.",
  colorFrom: "#5b6ee1",
  colorTo: "#7b5ce6",
  accent: "#5b6ee1",
  logoDataUrl: null,
  footerText: "Forma3D — prototype de conception assistée par IA.",
};

export const FeatureFlagsSchema = z.object({
  exportGlb: z.boolean(),
  exportStl: z.boolean(),
  exportPng: z.boolean(),
  imageUpload: z.boolean(),
  newRequests: z.boolean(),
  signupsOpen: z.boolean(),
  demoFallback: z.boolean(),
  devMode: z.boolean(),
  hourlyLimit: z.number().int().min(0).max(1000),
  dailyLimit: z.number().int().min(0).max(10000),
  guestTrial: z.boolean(),
  guestDailyLimit: z.number().int().min(0).max(100),
  guestGlobalDailyLimit: z.number().int().min(0).max(100000),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

export const DEFAULT_FEATURES: FeatureFlags = {
  exportGlb: true,
  exportStl: true,
  exportPng: true,
  imageUpload: true,
  newRequests: true,
  signupsOpen: true,
  demoFallback: true,
  devMode: false,
  hourlyLimit: 10,
  dailyLimit: 30,
  guestTrial: true,
  guestDailyLimit: 2,
  guestGlobalDailyLimit: 200,
};

export const CLAUDE_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (recommandé)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (plus rapide)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (économique)" },
  { id: "claude-fable-5-1", label: "Claude Fable 5.1 (le plus capable)" },
] as const;
export const EFFORTS = ["low", "medium", "high"] as const;
export const PROVIDERS_3D = ["primitives", "meshy"] as const;

export const AiSettingsSchema = z.object({
  systemPrompt: z.string().trim().min(50, "Prompt trop court.").max(20_000),
  model: z.enum(CLAUDE_MODELS.map((m) => m.id) as [string, ...string[]]),
  effort: z.enum(EFFORTS),
  maxTokens: z.number().int().min(4000).max(64000),
  provider3d: z.enum(PROVIDERS_3D),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

export const DEFAULT_AI: AiSettings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  model: "claude-opus-5-5",
  effort: "medium",
  maxTokens: 32000,
  provider3d: "primitives",
};

/** Fusionne une valeur stockée avec les valeurs par défaut, champ par champ (les champs invalides sont ignorés). */
export function mergeWithDefaults<T extends Record<string, unknown>>(
  schema: z.AnyZodObject,
  defaults: T,
  stored: unknown,
): T {
  const result: Record<string, unknown> = { ...defaults };
  if (stored && typeof stored === "object") {
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
      const field = schema.shape[key];
      if (!field) continue;
      const parsed = field.safeParse(value);
      if (parsed.success) result[key] = parsed.data;
    }
  }
  return result as T;
}

/** Convertit #rrggbb en « r g b » pour les variables CSS utilisées par Tailwind. */
export function hexToRgbTriplet(hexColor: string): string {
  const n = parseInt(hexColor.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
