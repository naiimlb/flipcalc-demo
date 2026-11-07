#!/usr/bin/env node
/**
 * Test de fumée de bout en bout (Chromium, gabarit iPhone) contre un serveur lancé :
 *
 *   npm run build && npm start -- -p 3100 &
 *   node scripts/smoke.mjs http://localhost:3100 [dossier-captures]
 *
 * Parcours : programme → session (Je sais / Hésitant / À revoir + reprise) → suivi →
 * réglages (thème, export, import) → hors ligne (service worker + IndexedDB).
 * L'audio EveryAyah est bloqué : le test ne dépend d'aucun service extérieur.
 */
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:3100";
const OUT = process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), "..", ".smoke");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fatiha = JSON.parse(readFileSync(join(ROOT, "public", "quran", "surah", "001.json"), "utf8"));

await mkdir(OUT, { recursive: true });

const iphone = { ...devices["iPhone 13"] };
delete iphone.defaultBrowserType;
const browser = await chromium.launch();
const context = await browser.newContext({ ...iphone, locale: "fr-FR", colorScheme: "light", acceptDownloads: true });
await context.route("https://everyayah.com/**", (route) => route.abort());

const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/everyayah|ERR_FAILED|ERR_INTERNET_DISCONNECTED|Failed to fetch RSC payload/.test(m.text() + (m.location().url ?? ""))) {
    errors.push(`console: ${m.text()}`);
  }
});

let step = 0;
async function shot(name) {
  step++;
  await page.screenshot({ path: join(OUT, `${String(step).padStart(2, "0")}-${name}.png`), fullPage: false });
}
function check(condition, message) {
  if (!condition) throw new Error(`Échec : ${message}`);
  console.log(`  ✓ ${message}`);
}
const text = (selector) => page.locator(selector).first().innerText();
const button = (name) => page.getByRole("button", { name, exact: true });

console.log(`Test de fumée sur ${BASE}`);

// 1. Accueil vide
await page.goto(BASE);
await page.getByText("Bienvenue").waitFor();
check(true, "accueil sans programme");
await shot("accueil-vide");

// 2. Choix d'un programme : Al-Fatiha entière
await page.getByRole("link", { name: "Choisir un programme" }).click();
await page.getByRole("link", { name: "Choisir une sourate" }).click();
await page.getByPlaceholder(/Nom ou numéro/).fill("fatiha");
await shot("recherche-sourate");
await page.getByRole("button", { name: /Al-Faatiha/ }).click();
await page.getByText("Sourate entière à mémoriser").waitFor();
await shot("plage-versets");
await button("Ajouter au programme").click();
await page.waitForURL(/\/hifz\/programme$/);
await page.getByText("Al-Faatiha").waitFor();
check((await page.getByText("Sourate entière").count()) === 1, "programme Al-Fatiha créé");
await shot("programme");

// 3. Session du jour : 3 nouveaux versets (limite par défaut)
await page.getByRole("link", { name: "Aujourd'hui" }).click();
await page.getByText("Session du jour").waitFor();
const nouveaux = await page.locator("dt:has-text('Nouveaux') + dd").innerText();
check(nouveaux === "3", "3 nouveaux versets proposés");
await shot("aujourdhui");

await page.getByRole("link", { name: "Commencer" }).click();
await page.getByText("Nouveau verset").waitFor();
await button("Je suis prêt à réciter").and(page.locator(":enabled")).waitFor();
const shown = await text(".quran-text");
check(shown === fatiha.ayahs[0].ar, "verset 1:1 affiché à l'identique des données");
check(await page.getByText(fatiha.ayahs[0].fr).isVisible(), "traduction Hamidullah affichée");
await shot("decouverte");

async function reciteAndGrade(grade, { discover }) {
  if (discover) await button("Je suis prêt à réciter").click();
  await page.getByText(/Récitez le verset \d+ de mémoire/).waitFor();
  check((await page.locator(".quran-text").count()) <= 1, "verset masqué pendant la récitation");
  await button("Révéler").click();
  await page.getByRole("group", { name: "Comment s'est passée la récitation ?" }).waitFor();
  await page.getByRole("button", { name: new RegExp(`^${grade}`) }).click();
}

await button("Je suis prêt à réciter").click();
await page.getByText("Récitez le verset 1 de mémoire").waitFor();
await button("Indice").click();
await shot("recitation-indice");
await button("Révéler").click();
await page.getByRole("group", { name: "Comment s'est passée la récitation ?" }).waitFor();
check((await text(".quran-text")) === fatiha.ayahs[0].ar, "verset révélé");
await shot("revele");
await page.getByRole("button", { name: /^Je sais/ }).click();

await page.getByText("verset 2").waitFor();
check((await text(".quran-text")) === fatiha.ayahs[1].ar, "verset 1:2 affiché à l'identique");
await reciteAndGrade("Hésitant", { discover: true });
await page.getByText("verset 3").waitFor();
await reciteAndGrade("À revoir", { discover: true });
await page.getByText("À reprendre").waitFor();
check(true, "le verset « À revoir » est reproposé en fin de session");
await reciteAndGrade("Je sais", { discover: false });
await page.getByText("Session terminée").waitFor();
check(await page.getByText("3 versets révisés").isVisible(), "résumé de fin de session");
await shot("fin-session");

// 4. Accueil à jour + suivi
await page.getByRole("link", { name: "Terminer" }).click();
await page.getByText("Tout est à jour pour aujourd'hui.").waitFor();
check(await page.getByText("Prochaine révision demain.").isVisible(), "prochaine révision annoncée");
await shot("accueil-a-jour");

await page.getByRole("link", { name: "Suivi" }).click();
await page.getByText("Révisions par jour, 30 derniers jours").waitFor();
check((await page.locator("dt:has-text('Série') + dd").first().innerText()) === "1 jour", "série d'un jour");
check((await page.locator("dt:has-text('Versets acquis') ~ dd").nth(1).innerText()) === "sur 7 suivis", "7 versets suivis");
await shot("suivi");

// 5. Réglages : thème sombre, export puis import
await page.getByRole("link", { name: "Réglages" }).click();
await page.getByRole("radio", { name: "Sombre" }).click();
await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
check(true, "thème sombre appliqué");
await page.waitForTimeout(400); // fin des transitions de couleur
await shot("reglages-sombre");

const [download] = await Promise.all([page.waitForEvent("download"), button("Exporter").click()]);
const backup = JSON.parse(readFileSync(await download.path(), "utf8"));
check(backup.app === "hifz" && backup.data.cards.length === 7 && backup.data.reviews.length === 4, "export JSON complet");
check(/^hifz-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()), "nom du fichier daté");

await page.locator("input[type=file]").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("{}") });
await page.getByRole("alert").filter({ hasText: "Sauvegarde Hifz invalide" }).waitFor();
check(true, "import d'un fichier invalide refusé avec un message");

page.once("dialog", (d) => d.accept());
await page
  .locator("input[type=file]")
  .setInputFiles({ name: "ok.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
await page.getByText("Sauvegarde restaurée.").waitFor();
check(true, "import d'une sauvegarde valide");

// 6. Session sombre (verset de plus) pour la capture
await page.goto(`${BASE}/hifz/session?plus=1`);
await page.getByText("Nouveau verset").waitFor();
await shot("decouverte-sombre");

// 7. Hors ligne : rechargement sans réseau
const swReady = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 15000))]);
  return !!reg?.active;
});
check(swReady, "service worker actif");
// Laisser le service worker finir de mettre en cache les pages.
await page.waitForFunction(
  async () => (await caches.keys()).some((k) => k.startsWith("hifz-pages")) && (await (await caches.open((await caches.keys()).find((k) => k.startsWith("hifz-pages")))).keys()).length >= 5,
  null,
  { timeout: 20000 },
);
await context.setOffline(true);
await page.goto(BASE);
await page.getByText("Session du jour").waitFor();
check(true, "accueil disponible hors ligne");
await page.getByRole("link", { name: "Programme" }).click();
await page.getByRole("heading", { name: "Programme" }).waitFor();
check(true, "navigation par onglet hors ligne");
await page.goto(`${BASE}/hifz/session?plus=1`);
await page.getByText("Nouveau verset").waitFor();
check((await text(".quran-text")).length > 0, "verset déjà chargé lisible hors ligne");
await button("Je suis prêt à réciter").click();
await button("Révéler").click();
await page.getByRole("button", { name: "Écouter le verset" }).click();
await page.getByRole("alert").filter({ hasText: "Audio indisponible hors ligne" }).waitFor();
check(true, "message clair pour l'audio non téléchargé hors ligne");
await shot("hors-ligne");
await page.goto(`${BASE}/hifz/suivi`);
await page.getByText("Révisions par jour, 30 derniers jours").waitFor();
check(true, "suivi disponible hors ligne");
await context.setOffline(false);

await browser.close();

if (errors.length) {
  console.error(`✗ Erreurs dans la page :\n${errors.join("\n")}`);
  process.exit(1);
}
console.log(`✓ Parcours complet réussi (${step} captures dans ${OUT}).`);
