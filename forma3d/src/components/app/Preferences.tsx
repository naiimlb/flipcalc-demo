"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LazyMotion, MotionConfig } from "framer-motion";
import { LANG_COOKIE, dirOf, translator, type Locale, type Translator } from "@/lib/i18n";
import { THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

const loadMotionFeatures = () => import("./motionFeatures").then((mod) => mod.default);

interface PreferencesValue {
  locale: Locale;
  t: Translator;
  setLocale(locale: Locale): void;
  theme: ThemeChoice;
  /** Mode sombre effectivement appliqué (le choix « auto » suit le système). */
  dark: boolean;
  setTheme(theme: ThemeChoice): void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Enregistre la préférence dans le compte (sans effet si l'on n'est pas connecté ou si le script SQL n'est pas appliqué). */
async function saveToAccount(patch: Record<string, string>) {
  // Chargé à la demande : le client Supabase n'alourdit pas le premier affichage des pages.
  const { getBrowserSupabase } = await import("@/lib/supabase/client");
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("profiles").update(patch).eq("id", data.user.id);
}

/**
 * Langue et thème de l'interface. Respecte « réduire les animations » du système (MotionConfig).
 * Le choix est gardé dans un cookie (lu par le serveur, pas de clignotement) et dans le compte.
 */
export function PreferencesProvider({
  initialLocale,
  initialTheme,
  children,
}: {
  initialLocale: Locale;
  initialTheme: ThemeChoice;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [theme, setThemeState] = useState<ThemeChoice>(initialTheme);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const dark = theme === "dark" || (theme === "auto" && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    writeCookie(THEME_COOKIE, next);
    void saveToAccount({ theme: next }).catch(() => {});
  }, []);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      writeCookie(LANG_COOKIE, next);
      document.documentElement.lang = next;
      document.documentElement.dir = dirOf(next);
      void saveToAccount({ language: next }).catch(() => {});
      router.refresh(); // textes rendus côté serveur
    },
    [router],
  );

  const value = useMemo<PreferencesValue>(
    () => ({ locale, t: translator(locale), setLocale, theme, dark, setTheme }),
    [locale, setLocale, theme, dark, setTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {/* Animations : version allégée (composants « m »), dont les fonctions complètes arrivent après le premier affichage. */}
      <LazyMotion features={loadMotionFeatures}>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </LazyMotion>
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (value) return value;
  // Hors du fournisseur (tests, pages isolées) : français, thème clair.
  return { locale: "fr", t: translator("fr"), setLocale: () => {}, theme: "dark", dark: true, setTheme: () => {} };
}

export function useT(): Translator {
  return usePreferences().t;
}
