// Captures d'écran en mode démo (CI) + erreurs de console du navigateur.
// Usage : node scripts/screenshots.mjs <url> <dossier>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
mkdirSync(out, { recursive: true });

const errors = [];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function session(name, viewport, run) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 600 ? 2 : 1 });
  const page = await context.newPage();
  page.on("console", (msg) => msg.type() === "error" && errors.push(`[${name}] console : ${msg.text()}`));
  page.on("pageerror", (err) => errors.push(`[${name}] page : ${err.message}`));
  try {
    await run(page);
  } catch (err) {
    errors.push(`[${name}] script : ${err.message}`);
    await page.screenshot({ path: join(out, `${name}-echec.png`) }).catch(() => {});
  }
  await context.close();
}

await session("desktop", { width: 1440, height: 1000 }, async (page) => {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(out, "desktop.png"), fullPage: true });

  await page.getByRole("button", { name: "Réaliste" }).click();
  await page.getByRole("button", { name: "Éclaté" }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(out, "desktop-realiste-eclate.png") });

  await page.getByRole("button", { name: "Fabrication" }).click();
  await page.getByRole("button", { name: "Coût estimé" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, "desktop-panneaux.png") });

  await page.getByRole("button", { name: "Nouvelle demande" }).first().click();
  await page.getByLabel("Votre demande").fill("Une solution pour ranger mes câbles de charge");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, "desktop-dialogue.png") });
  await page.getByRole("button", { name: "Générer" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, "desktop-generation.png") });
  // Le titre de la nouvelle conception remplace celui de l'exemple dans la fiche.
  await page.locator("h2", { hasText: "Peigne range-câbles lesté" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(out, "desktop-resultat.png") });

  await page.getByRole("button", { name: "Historique" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, "desktop-historique.png") });
});

await session("xl-1280", { width: 1280, height: 900 }, async (page) => {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(out, "xl-1280.png"), fullPage: true });
});

await session("mobile", { width: 390, height: 844 }, async (page) => {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(out, "mobile.png"), fullPage: true });
});

await session("setup", { width: 1280, height: 900 }, async (page) => {
  await page.goto(`${base}/setup`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, "setup.png") });
});

await browser.close();
writeFileSync(join(out, "erreurs-console.txt"), errors.length ? errors.join("\n") : "Aucune erreur.\n");
console.log(errors.length ? errors.join("\n") : "Aucune erreur de console.");
