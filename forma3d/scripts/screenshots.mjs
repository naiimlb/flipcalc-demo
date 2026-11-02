// Captures d'écran en mode démo (CI) + erreurs de console + vérifications fonctionnelles.
// Usage : node scripts/screenshots.mjs <url> <dossier>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
mkdirSync(out, { recursive: true });

const errors = [];
const checks = [];
const check = (ok, label) => checks.push(`${ok ? "✓" : "✗"} ${label}`);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function session(name, viewport, run) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 900 ? 2 : 1 });
  const page = await context.newPage();
  page.on("console", (msg) => msg.type() === "error" && errors.push(`[${name}] console : ${msg.text()}`));
  page.on("pageerror", (err) => errors.push(`[${name}] page : ${err.message}`));
  try {
    await run(page, context);
  } catch (err) {
    errors.push(`[${name}] script : ${err.message}`);
    await page.screenshot({ path: join(out, `${name}-echec.png`) }).catch(() => {});
  }
  await context.close();
}

async function ready(page) {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(3000);
}

/** La zone de travail (barre de demande + visionneuse) tient dans le premier écran. */
async function aboveFold(page, label) {
  const vh = page.viewportSize().height;
  const prompt = await page.locator("#prompt").boundingBox();
  const canvas = await page.locator("canvas").first().boundingBox();
  check(prompt && prompt.y + prompt.height <= vh, `${label} : barre de demande visible sans défiler`);
  check(canvas && canvas.y < vh - 120, `${label} : visionneuse 3D visible sans défiler`);
}

await session("desktop", { width: 1440, height: 900 }, async (page) => {
  await ready(page);
  await aboveFold(page, "Bureau 1440×900");
  await page.screenshot({ path: join(out, "desktop.png") });

  // Clic sur une matière conseillée : le modèle prend sa couleur et son aspect.
  const materials = page.getByTitle("Appliquer cette matière au modèle 3D");
  check((await materials.count()) >= 3, "Bureau : au moins 3 matières conseillées");
  check(await page.getByText("Recommandé", { exact: true }).first().isVisible(), "Bureau : badge « Recommandé »");
  await materials.nth(1).click();
  await page.waitForTimeout(1500);
  check((await materials.nth(1).getAttribute("aria-pressed")) === "true", "Bureau : matière appliquée au modèle");
  await page.screenshot({ path: join(out, "desktop-matiere.png") });

  await page.locator("#prompt").fill("Une solution pour ranger mes câbles de charge");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, "desktop-generation.png") });
  await page.locator("h2", { hasText: "Peigne range-câbles lesté" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  check(true, "Bureau : demande → modèle 3D affiché");
  await page.screenshot({ path: join(out, "desktop-resultat.png") });

  await page.getByRole("button", { name: "Historique" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, "desktop-historique.png") });
});

// Assistant de questions : demande floue → boutons de réponse → conception ; « Modifier ma demande » remet le texte.
await session("assistant", { width: 1280, height: 800 }, async (page) => {
  await ready(page);
  await page.locator("#prompt").fill("un support");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 15000 });
  check((await dialog.getByRole("button", { name: "Passer" }).count()) >= 2, "Assistant : une option « Passer » par question");
  await page.screenshot({ path: join(out, "assistant-questions.png") });
  await dialog.getByRole("button", { name: "Modifier ma demande" }).click();
  await dialog.waitFor({ state: "detached", timeout: 5000 });
  await page.waitForTimeout(400);
  check((await page.locator("#prompt").inputValue()) === "un support", "Assistant : « Modifier ma demande » remet le texte dans la barre");

  await page.keyboard.press("Enter");
  await dialog.waitFor({ timeout: 15000 });
  const first = dialog.locator("fieldset").first();
  await first.getByRole("button").first().click();
  check((await first.getByRole("button").first().getAttribute("aria-pressed")) === "true", "Assistant : une réponse se choisit d'un clic");
  await dialog.getByRole("button", { name: /^Concevoir/ }).click();
  await page.getByText(/Conception prête/).waitFor({ timeout: 30000 });
  check(true, "Assistant : après les réponses, la conception est générée");
  await page.screenshot({ path: join(out, "assistant-resultat.png") });
});

// Bouton « Mettre à jour » : on simule un nouveau déploiement en changeant la version renvoyée.
await session("mise-a-jour", { width: 1280, height: 800 }, async (page) => {
  let calls = 0;
  await page.route("**/api/version", (route) => {
    calls += 1;
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ version: calls === 1 ? "v1" : "v2" }) });
  });
  await ready(page);
  await page.locator("#prompt").fill("Mon brouillon à garder");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const button = page.getByRole("button", { name: "Mettre à jour" });
  await button.waitFor({ timeout: 10000 });
  check(true, "Mise à jour : bouton affiché après un nouveau déploiement");
  await page.screenshot({ path: join(out, "mise-a-jour.png") });
  await Promise.all([page.waitForNavigation(), button.click()]);
  await page.waitForSelector("#prompt");
  await page.waitForTimeout(800);
  check((await page.locator("#prompt").inputValue()) === "Mon brouillon à garder", "Mise à jour : la demande en cours est conservée");
});

await session("ipad-portrait", { width: 820, height: 1180 }, async (page) => {
  await ready(page);
  await aboveFold(page, "iPad portrait");
  await page.screenshot({ path: join(out, "ipad-portrait.png") });
});

await session("ipad-paysage", { width: 1180, height: 820 }, async (page) => {
  await ready(page);
  await aboveFold(page, "iPad paysage");
  await page.screenshot({ path: join(out, "ipad-paysage.png") });
});

await session("mobile", { width: 390, height: 844 }, async (page) => {
  await ready(page);
  await aboveFold(page, "Mobile 390×844");
  await page.screenshot({ path: join(out, "mobile.png") });
  await page.screenshot({ path: join(out, "mobile-page-entiere.png"), fullPage: true });
});

await browser.close();
writeFileSync(join(out, "verifications.txt"), checks.join("\n") + "\n");
writeFileSync(join(out, "erreurs-console.txt"), errors.length ? errors.join("\n") : "Aucune erreur.\n");
console.log(checks.join("\n"));
console.log(errors.length ? errors.join("\n") : "Aucune erreur de console.");
