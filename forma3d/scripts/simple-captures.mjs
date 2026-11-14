// Captures et mesures du parcours Simple aux 5 tailles cibles : éléments interactifs du premier écran,
// cibles < 44 px, débordement horizontal, plus petite taille de texte visible et violations axe sérieuses.
// Usage : node scripts/simple-captures.mjs <url de base> <dossier de sortie> [chemin accueil] [chemin résultat]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "captures";
const SCREENS = [
  { id: "accueil", path: process.argv[4] ?? "/apercu-refonte" },
  { id: "resultat", path: process.argv[5] ?? "/apercu-refonte?ecran=resultat", wait: true },
];
const SIZES = [
  { id: "iphone-390", width: 390, height: 844, touch: true },
  { id: "ipad-portrait-820", width: 820, height: 1180, touch: true },
  { id: "ipad-paysage-1180", width: 1180, height: 820, touch: true },
  { id: "macbook-air-1280", width: 1280, height: 800, touch: false },
  { id: "macbook-pro-1512", width: 1512, height: 982, touch: false },
];
const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="slider"], [tabindex]:not([tabindex="-1"])';

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const rows = [];
for (const screen of SCREENS) {
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch && size.width < 900, locale: "fr-FR" });
    const page = await ctx.newPage();
    const row = { screen: screen.id, size: size.id };
    try {
      await page.goto(`${base}${screen.path}`, { waitUntil: "networkidle", timeout: 45000 });
      if (screen.wait) {
        await page.waitForSelector("canvas", { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(2500);
      }
      await page.screenshot({ path: join(out, `${screen.id}-${size.id}.png`) });
      Object.assign(
        row,
        await page.evaluate((sel) => {
          const vw = innerWidth, vh = innerHeight;
          const vis = (el) => {
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !el.closest("[hidden],[aria-hidden='true']");
          };
          const els = [...document.querySelectorAll(sel)].filter(vis);
          const first = els.filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw; });
          const small = els.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
          const sizes = new Set();
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let minPx = 99;
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement) || n.parentElement.closest("canvas,script,style")) continue;
            const px = parseFloat(getComputedStyle(n.parentElement).fontSize);
            sizes.add(px);
            minPx = Math.min(minPx, px);
          }
          const doc = document.scrollingElement;
          return { first: first.length, total: els.length, under44: small.length, overflow: Math.max(0, doc.scrollWidth - vw), minFontPx: minPx, fontSizes: [...sizes].sort((a, b) => a - b).join("/") };
        }, INTERACTIVE),
      );
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      row.axe = serious.reduce((n, v) => n + v.nodes.length, 0);
      row.axeRules = serious.map((v) => v.id).join(",") || "—";
    } catch (e) {
      row.error = e.message.split("\n")[0];
    }
    rows.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
}
await browser.close();
const lines = rows.map((r) => (r.error ? `${r.screen} | ${r.size} | ERREUR ${r.error}` : `${r.screen} | ${r.size} | interactifs 1er écran ${r.first} / ${r.total} | < 44 px : ${r.under44} | débordement ${r.overflow} px | texte min ${r.minFontPx} px (${r.fontSizes}) | axe sérieux : ${r.axe} (${r.axeRules})`));
writeFileSync(join(out, "mesures.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
