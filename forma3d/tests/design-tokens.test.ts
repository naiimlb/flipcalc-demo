import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COLOR_TOKENS, contrast, tint, token, type Rgb } from "@/lib/design/tokens";

const css = readFileSync(join(__dirname, "../src/app/globals.css"), "utf8");
function block(selector: RegExp): Record<string, Rgb> {
  const start = css.search(selector);
  const body = css.slice(start, css.indexOf("}", start));
  const out: Record<string, Rgb> = {};
  for (const m of body.matchAll(/--([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  return out;
}
const light = block(/:root,\s*\n\.theme-light\s*\{/);
const dark = block(/\n\.dark\s*\{/);

describe("système de design : couleurs", () => {
  it("la documentation (tokens.ts) reprend exactement les variables de globals.css", () => {
    for (const t of COLOR_TOKENS) {
      expect(light[t.name], `${t.name} (clair)`).toEqual(t.light);
      expect(dark[t.name], `${t.name} (sombre)`).toEqual(t.dark);
    }
  });

  it("contraste WCAG AA (≥ 4,5:1) du texte sur chaque fond, dans les deux thèmes", () => {
    for (const theme of ["light", "dark"] as const) {
      const c = (name: string) => token(name)[theme];
      for (const fg of ["ink", "ink-soft", "ink-mute", "accent", "success", "warning", "danger"]) {
        for (const bg of ["surface", "canvas", "paper"]) {
          expect(contrast(c(fg), c(bg)), `${fg} sur ${bg} (${theme})`).toBeGreaterThanOrEqual(4.5);
        }
      }
      // Bouton principal : texte blanc sur l'accent fort.
      expect(contrast([255, 255, 255], c("accent-strong")), `bouton principal (${theme})`).toBeGreaterThanOrEqual(4.5);
      // Étiquettes et sélection : texte coloré sur son propre fond teinté (10 à 15 %).
      for (const fg of ["accent", "success", "warning", "danger"]) {
        const bg = tint(c(fg), c("surface"), 0.15);
        expect(contrast(c(fg), bg), `${fg} sur ${fg}/15 (${theme})`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
