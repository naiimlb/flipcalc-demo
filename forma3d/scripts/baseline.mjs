// Mesures de référence (état des lieux de la refonte) : captures aux 5 tailles cibles, éléments interactifs,
// cibles tactiles, débordement horizontal, accessibilité (axe) et poids de page.
// Usage : node scripts/baseline.mjs <url> <dossier>   (nécessite playwright et @axe-core/playwright)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "baseline";
mkdirSync(out, { recursive: true });

const SIZES = [
  { id: "iphone-390", width: 390, height: 844, touch: true },
  { id: "ipad-portrait-820", width: 820, height: 1180, touch: true },
  { id: "ipad-paysage-1180", width: 1180, height: 820, touch: true },
  { id: "macbook-air-1280", width: 1280, height: 800, touch: false },
  { id: "macbook-pro-1512", width: 1512, height: 982, touch: false },
];

// « Résultat » : l'éditeur tel qu'il s'ouvre sur une conception d'exemple ; « éditeur » : une pièce sélectionnée.
const SCREENS = [
  { id: "accueil", path: "/", prepare: async () => {} },
  {
    id: "resultat",
    path: "/studio",
    prepare: async (page) => {
      await page.waitForSelector("canvas", { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
    },
  },
  {
    id: "editeur",
    path: "/studio",
    prepare: async (page) => {
      await page.waitForSelector("canvas", { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const item = page.getByRole("tree", { name: "Pièces" }).getByRole("treeitem").first();
      if (await item.isVisible().catch(() => false)) await item.getByRole("button").first().click().catch(() => {});
      await page.waitForTimeout(800);
    },
  },
];

const INTERACTIVE =
  'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], [role="slider"], [role="radio"], [role="checkbox"], [role="treeitem"], [tabindex]:not([tabindex="-1"])';

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const results = [];

for (const screen of SCREENS) {
  for (const size of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
      hasTouch: size.touch,
      isMobile: size.touch && size.width < 900,
      locale: "fr-FR",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const row = { screen: screen.id, size: size.id };
    try {
      await page.goto(`${base}${screen.path}`, { waitUntil: "networkidle", timeout: 45000 });
      await screen.prepare(page);
      await page.screenshot({ path: join(out, `${screen.id}-${size.id}.png`) });
      Object.assign(
        row,
        await page.evaluate((selector) => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const visible = [...document.querySelectorAll(selector)].filter((el) => {
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !el.closest("[aria-hidden='true']");
          });
          const inFirstScreen = visible.filter((el) => {
            const r = el.getBoundingClientRect();
            return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
          });
          const small = visible.filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width < 44 || r.height < 44;
          });
          const doc = document.scrollingElement ?? document.documentElement;
          const bodyText = getComputedStyle(document.body).fontSize;
          const resources = performance.getEntriesByType("resource");
          const nav = performance.getEntriesByType("navigation")[0];
          const bytes = resources.reduce((n, r) => n + (r.transferSize || 0), nav?.transferSize ?? 0);
          const jsBytes = resources.filter((r) => r.initiatorType === "script" || r.name.endsWith(".js")).reduce((n, r) => n + (r.transferSize || 0), 0);
          return {
            interactiveVisible: visible.length,
            interactiveFirstScreen: inFirstScreen.length,
            targetsUnder44: small.length,
            horizontalOverflowPx: Math.max(0, doc.scrollWidth - vw),
            bodyFontSize: bodyText,
            transferKB: Math.round(bytes / 1024),
            jsKB: Math.round(jsBytes / 1024),
          };
        }, INTERACTIVE),
      );
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      row.axeSeriousRules = serious.map((v) => `${v.id}×${v.nodes.length}`);
      row.axeSeriousNodes = serious.reduce((n, v) => n + v.nodes.length, 0);
    } catch (err) {
      row.error = err.message.split("\n")[0];
    }
    row.pageErrors = errors.length;
    results.push(row);
    console.log(JSON.stringify(row));
    await context.close();
  }
}
await browser.close();

writeFileSync(join(out, "baseline.json"), JSON.stringify(results, null, 2) + "\n");
const lines = ["écran | taille | interactifs (1er écran / total) | cibles < 44 px | débordement | axe sérieux | transfert (JS) | corps"];
for (const r of results) {
  lines.push(
    r.error
      ? `${r.screen} | ${r.size} | ERREUR ${r.error}`
      : `${r.screen} | ${r.size} | ${r.interactiveFirstScreen} / ${r.interactiveVisible} | ${r.targetsUnder44} | ${r.horizontalOverflowPx} px | ${r.axeSeriousNodes} (${r.axeSeriousRules.join(", ") || "—"}) | ${r.transferKB} Ko (${r.jsKB} Ko) | ${r.bodyFontSize}`,
  );
}
writeFileSync(join(out, "baseline.txt"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
