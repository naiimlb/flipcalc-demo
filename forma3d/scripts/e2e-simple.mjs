// Parcours Simple complet, de bout en bout (mode démonstration) :
// demande → précisions → création → résultat → curseur → téléchargement du STL → mode avancé.
// Usage : node scripts/e2e-simple.mjs <url de base> [dossier de captures]
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3100";
const out = process.argv[3] ?? "e2e-simple";
mkdirSync(out, { recursive: true });
let failed = 0;
const check = (ok, message) => {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failed++;
};

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "fr-FR", acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// 1. Demande
await page.goto(base, { waitUntil: "networkidle" });
check(await page.getByRole("heading", { level: 1, name: /Quel problème voulez-vous résoudre/ }).isVisible(), "1. la question est affichée");
await page.getByRole("button", { name: "Voir des idées" }).click();
await page.getByRole("button", { name: "Support téléphone" }).click();
const field = page.getByRole("textbox");
check((await field.inputValue()).includes("téléphone"), "1. une idée remplit la demande");
// 1b. Premier lancement : l'astuce est visible, sans bouton supplémentaire (7 éléments au plus)
await field.fill("");
check(await page.getByText(/Astuce : décrivez votre besoin/).isVisible(), "1. astuce de premier lancement visible");
const homeButtons = await page.locator('a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0 && !e.closest("[hidden]")).length);
check(homeButtons <= 7, `1. accueil : ${homeButtons} éléments interactifs (7 au plus)`);

// 1c. Demande absurde : « Je n'ai pas compris ce besoin », texte conservé, exemples cliquables
const absurd = "fjqz xkcd plumeau galactique";
await field.fill(absurd);
await page.getByRole("button", { name: "Créer ma pièce" }).click();
if (await page.getByText(/Question 1 sur/).waitFor({ timeout: 15000 }).then(() => true, () => false)) {
  await page.getByRole("button", { name: "Passer, générer directement" }).click();
}
await page.getByText(/Je n'ai pas compris ce besoin/).waitFor({ timeout: 30000 });
check(true, "1c. demande absurde : « Je n'ai pas compris ce besoin »");
check((await page.getByRole("textbox").inputValue()) === absurd, "1c. le texte saisi est conservé");
check((await page.getByRole("list", { name: "Exemples de demandes" }).getByRole("button").count()) === 3, "1c. trois exemples cliquables proposés");
await page.screenshot({ path: join(out, "1c-pas-compris.png") });

// 1d. Erreur serveur : message humain, texte conservé ; puis « Annuler » pendant l'attente
const long = "Je voudrais un support pour mon téléphone à poser sur mon bureau, avec un passage pour le câble de charge, stable et facile à imprimer sur ma machine";
await page.route("**/api/generate", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Le service est occupé." }) }));
await page.getByRole("textbox").fill(long);
await page.getByRole("button", { name: "Créer ma pièce" }).click();
const errorNotice = page.getByText(/Le service est occupé\./);
await errorNotice.waitFor({ timeout: 30000 });
check(/conservé/.test(await errorNotice.innerText()), "1d. erreur : message humain, « votre texte est conservé »");
check((await page.getByRole("textbox").inputValue()) === long, "1d. erreur : le texte saisi est conservé");
await page.unroute("**/api/generate");
await page.route("**/api/generate", async (route) => {
  await new Promise((r) => setTimeout(r, 6000));
  await route.abort().catch(() => {});
});
await page.getByRole("button", { name: "Créer ma pièce" }).click();
await page.getByRole("button", { name: "Annuler" }).click();
await page.getByText(/Demande annulée/).waitFor({ timeout: 10000 });
check((await page.getByRole("textbox").inputValue()) === long, "1d. annulation : le texte saisi est conservé");
await page.unroute("**/api/generate");
await page.reload({ waitUntil: "networkidle" });
check((await page.getByRole("textbox").inputValue()) === long, "1d. après rechargement : le brouillon est restauré");

await field.fill("Un support pour mon téléphone");
await page.screenshot({ path: join(out, "1-demande.png") });
await page.getByRole("button", { name: "Créer ma pièce" }).click();

// 2. Précisions (demande courte → questions), puis « Passer »
const questions = page.getByText(/Question 1 sur/);
const gotQuestions = await questions.waitFor({ timeout: 15000 }).then(() => true, () => false);
check(gotQuestions, "2. des précisions sont proposées pour une demande floue");
if (gotQuestions) {
  await page.screenshot({ path: join(out, "2-precisions.png") });
  const buttons = await page.getByRole("button").count();
  check(buttons <= 7, `2. au plus 7 boutons à l'écran (${buttons})`);
  await page.getByRole("button", { name: "Passer, générer directement" }).click();
}

// 3. Création, puis 4. résultat
await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 15000 });
await page.screenshot({ path: join(out, "3-creation.png") }).catch(() => {});
await page.getByRole("button", { name: "Télécharger pour imprimer" }).first().waitFor({ timeout: 120000 });
await page.waitForSelector("canvas", { timeout: 20000 });
await page.waitForTimeout(2000);
check(true, "4. le résultat s'affiche avec « Télécharger pour imprimer »");
await page.screenshot({ path: join(out, "4-resultat.png") });

// 5. Curseur de dimensions : la cote change
const sliders = page.getByRole("slider");
check((await sliders.count()) === 3, "5. trois curseurs de dimensions");
const before = await sliders.first().inputValue();
await sliders.first().focus();
for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
const after = await sliders.first().inputValue();
check(Number(after) > Number(before), `5. le curseur Largeur modifie la cote (${before} → ${after} mm)`);
await page.screenshot({ path: join(out, "5-curseur.png") });

// 6. Téléchargement : un vrai STL, aux dimensions ajustées
const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.getByRole("button", { name: "Télécharger pour imprimer" }).first().click()]);
const path = await download.path();
const stl = readFileSync(path);
// STL binaire : 80 octets d'en-tête, nombre de triangles (uint32), puis 50 octets par triangle.
const triangles = stl.readUInt32LE(80);
let min = [Infinity, Infinity, Infinity];
let max = [-Infinity, -Infinity, -Infinity];
for (let t = 0; t < triangles; t++) {
  for (let v = 0; v < 3; v++) {
    for (let a = 0; a < 3; a++) {
      const value = stl.readFloatLE(84 + t * 50 + 12 + v * 12 + a * 4);
      min[a] = Math.min(min[a], value);
      max[a] = Math.max(max[a], value);
    }
  }
}
const extent = max.map((m, i) => Math.round((m - min[i]) * 10) / 10);
check(download.suggestedFilename().endsWith(".stl"), `6. fichier ${download.suggestedFilename()}`);
check(triangles > 0 && stl.length === 84 + 50 * triangles, `6. le fichier est un STL binaire valide (${triangles} triangles)`);
check(Math.abs(extent[0] - Number(after)) <= 1.5, `6. la largeur du fichier (${extent[0]} mm) suit le curseur (${after} mm)`);
check(await page.getByText(/Fichier prêt/).isVisible(), "6. confirmation « Fichier prêt »");

// 7. Mode avancé : l'éditeur s'ouvre avec la pièce
await page.getByRole("button", { name: "Mode avancé" }).click();
await page.waitForURL(/\/studio/, { timeout: 20000 });
await page.waitForSelector("canvas", { timeout: 20000 });
check(await page.getByText("Support de téléphone", { exact: false }).first().isVisible().catch(() => false), "7. le mode avancé ouvre l'éditeur sur la pièce");
await page.screenshot({ path: join(out, "7-mode-avance.png") });

check(errors.length === 0, `aucune erreur JavaScript (${errors.length})`);
await browser.close();
if (failed) {
  console.error(`${failed} vérification(s) en échec.`);
  process.exit(1);
}
console.log("Parcours Simple : réussi.");
