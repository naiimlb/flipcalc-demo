export type ThemeChoice = "auto" | "light" | "dark";
export const THEME_COOKIE = "forma3d-theme";
/** Thème appliqué tant que la personne n'a rien choisi. */
export const DEFAULT_THEME: ThemeChoice = "dark";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "auto" || value === "light" || value === "dark";
}

/**
 * Script exécuté avant l'affichage : applique le mode sombre sans clignotement
 * (choix enregistré dans un cookie ; « auto » suit le réglage du système).
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(auto|light|dark)/);var t=m?m[1]:(document.documentElement.getAttribute("data-theme")||"dark");var d=t==="dark"||(t==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
