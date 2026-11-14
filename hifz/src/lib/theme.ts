export type ThemePreference = "system" | "light" | "dark";

/** Copie locale du choix de thème, lue de façon synchrone avant le premier rendu. */
export const THEME_STORAGE_KEY = "hifz-theme";

export function resolveTheme(pref: ThemePreference, systemDark: boolean): "light" | "dark" {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/** Applique le thème au document et mémorise le choix (côté navigateur uniquement). */
export function applyTheme(pref: ThemePreference): void {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(pref, systemDark);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Stockage indisponible (navigation privée) : le thème reste appliqué pour la session.
  }
}
