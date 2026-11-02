import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, isLocale, pickLocale, translator, type Locale } from "./index";

/** Langue de l'interface : choix mémorisé (cookie), sinon détection automatique (Accept-Language). */
export async function getLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(stored)) return stored;
  return pickLocale((await headers()).get("accept-language"));
}

export async function getTranslator() {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}
