import { ar, en, fr, type MessageKey, type Messages } from "./messages";

export const LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LANG_COOKIE = "forma3d-lang";

export const LOCALE_NAMES: Record<Locale, string> = { fr: "Français", en: "English", ar: "العربية" };

const DICTIONARIES: Record<Locale, Messages> = { fr, en, ar };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Sens de lecture : droite à gauche pour l'arabe. */
export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Langue préférée d'après l'en-tête Accept-Language du navigateur (détection automatique). */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  const found = ranked.find((r) => isLocale(r.lang));
  return found ? (found.lang as Locale) : DEFAULT_LOCALE;
}

export type TranslateVars = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, vars?: TranslateVars): string {
  const template = DICTIONARIES[locale][key] ?? fr[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

export type Translator = (key: MessageKey, vars?: TranslateVars) => string;

export function translator(locale: Locale): Translator {
  return (key, vars) => translate(locale, key, vars);
}

/** Format des nombres et dates selon la langue. */
export function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar" : locale === "en" ? "en-GB" : "fr-FR";
}

export type { MessageKey };
