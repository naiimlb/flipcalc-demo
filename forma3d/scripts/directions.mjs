// Captures des deux directions visuelles (lot 1.1) : accueil et résultat, aux 5 tailles cibles, avec mesures.
// Usage : node scripts/directions.mjs <url> <dossier>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "directions";
mkdirSync(out, { recursive: true });

const SIZES = [
  { id: "iphone-390", width: 390, height: 844, touch: true },
  { id: "ipad-portrait-820", width: 820, height: 1180, touch: true },
  { id: "ipad-paysage-1180", width: 1180, height: 820, touch: true },
  { id: "macbook-air-1280", width: 1280, height: 800, touch: false },
  { id: "macbook-pro-1512", width: 1512, height: 982, touch: false },
];
const INTERACTIVE = 'a[href], button, input:not([type="hidden"]):not(.hidden), select, textarea, summary';

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const rows = [];
for (const direction of ["neutre", "colore"]) {
  for (const ecran of ["accueil", "resultat"]) {
    for (const size of SIZES) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch && size.width < 900, locale: "fr-FR", deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${base}/apercu-refonte?direction=${direction}&ecran=${ecran}`, { waitUntil: "networkidle" });
      if (ecran === "resultat") await page.waitForSelector("canvas", { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(ecran === "resultat" ? 2500 : 500);
      await page.screenshot({ path: join(out, `${direction}-${ecran}-${size.id}.png`) });
      const m = await page.evaluate((sel) => {
        const vw = innerWidth, vh = innerHeight;
        const els = [...document.querySelectorAll(sel)].filter((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
        });
        const first = els.filter((el) => { const r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0; });
        const small = els.filter((el) => { const r = el.getBoundingClientRect(); return (r.width < 44 || r.height < 44) && el.tagName !== "TEXTAREA"; }).map((el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30));
        const doc = document.scrollingElement;
        return { first: first.length, total: els.length, small, overflow: Math.max(0, doc.scrollWidth - vw), body: getComputedStyle(document.querySelector("main, section") ?? document.body).fontSize };
      }, INTERACTIVE);
      rows.push({ direction, ecran, size: size.id, ...m, errors: errors.length });
      await context.close();
    }
  }
}
await browser.close();
const lines = rows.map((r) => `${r.direction} | ${r.ecran} | ${r.size} | interactifs 1er écran ${r.first} / ${r.total} | < 44 px : ${r.small.length}${r.small.length ? " (" + r.small.join(", ") + ")" : ""} | débordement ${r.overflow} px | erreurs ${r.errors}`);
writeFileSync(join(out, "directions.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
