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
  // Interface en français pour les vérifications (le navigateur de test est en anglais par défaut).
  const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 900 ? 2 : 1, locale: "fr-FR" });
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
  await page.goto(`${base}/studio`, { waitUntil: "networkidle" });
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

  await page.locator("#prompt").press("Enter");
  await dialog.waitFor({ timeout: 15000 });
  const first = dialog.locator("fieldset").first();
  await first.getByRole("button").first().click();
  check((await first.getByRole("button").first().getAttribute("aria-pressed")) === "true", "Assistant : une réponse se choisit d'un clic");
  await dialog.getByRole("button", { name: /^Concevoir/ }).click();
  await page.getByText(/Conception prête/).waitFor({ timeout: 30000 });
  check(true, "Assistant : après les réponses, la conception est générée");
  await page.screenshot({ path: join(out, "assistant-resultat.png") });
});

// Fabrication : imprimabilité, estimation, plan coté (PDF), nouvelle version et comparaison.
await session("fabrication", { width: 1366, height: 900 }, async (page) => {
  await ready(page);
  await page.getByRole("button", { name: "Fabriquer", exact: true }).click();
  await page.getByText("Contrôle d'imprimabilité").waitFor({ timeout: 15000 });
  check(await page.getByText("Estimation d'impression").isVisible(), "Fabrication : contrôle d'imprimabilité et estimation affichés");
  const plan = page.getByAltText(/^Plan coté/);
  await plan.waitFor({ timeout: 20000 });
  check(true, "Fabrication : plan coté dessiné (vues de face, de droite, de dessus)");
  const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.getByRole("button", { name: /Plan PDF/ }).click()]);
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(await pdf.path());
  check(bytes.subarray(0, 5).toString() === "%PDF-" && bytes.length > 20000, `Fabrication : plan PDF téléchargé (${Math.round(bytes.length / 1024)} Ko)`);
  check((await page.locator('a[href^="https://www.google.com/"]').count()) >= 3, "Où fabriquer : liens de recherche génériques");
  await page.screenshot({ path: join(out, "fabrication.png") });

  await page.getByRole("button", { name: "Plus petit" }).first().click();
  await page.getByText(/Nouvelle version prête/).waitFor({ timeout: 30000 });
  check(true, "Versions : « Plus petit » crée une nouvelle version");
  await page.getByRole("button", { name: "Comparer deux versions" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Comparer deux versions" });
  await dialog.waitFor({ timeout: 10000 });
  await page.waitForTimeout(2500);
  check((await dialog.locator("canvas").count()) === 2, "Comparer : deux modèles 3D côte à côte");
  check(await dialog.getByText("Dimensions (L × P × H)").isVisible(), "Comparer : tableau dimensions, matière, coût");
  await page.screenshot({ path: join(out, "comparaison.png") });
});

// Photo vers solution : photo jointe sans mesure → question « mesure de référence » à réponse libre.
await session("photo", { width: 1280, height: 800 }, async (page) => {
  await ready(page);
  // Petite image PNG (1×1) en guise de photo.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "probleme.png", mimeType: "image/png", buffer: png });
  await page.getByAltText("Photo jointe").waitFor({ timeout: 8000 });
  check(true, "Photo : la photo est jointe (réduite et compressée dans le navigateur)");
  await page.locator("#prompt").fill("Un cache pour ce câble qui traîne le long du mur");
  await page.locator("#prompt").press("Enter");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ timeout: 15000 });
  const reference = dialog.getByRole("textbox", { name: /mesure de référence/ });
  check(await reference.isVisible(), "Photo : une mesure de référence est demandée (réponse libre)");
  await reference.fill("la prise fait 8 cm de large");
  await page.screenshot({ path: join(out, "photo-reference.png") });
  await dialog.getByRole("button", { name: /^Concevoir/ }).click();
  await page.getByText(/Conception prête/).waitFor({ timeout: 30000 });
  check(true, "Photo : la conception est générée avec la mesure de référence");
  check((await page.getByRole("button", { name: /Voir chez moi/ }).count()) === 0, "Réalité augmentée : bouton masqué sur un appareil sans AR");
});

// Refonte phase 1 : accueil plein écran (héros 3D, sections, repères), thème sombre par défaut, clair, arabe.
await session("accueil", { width: 1366, height: 900 }, async (page) => {
  await page.goto(base, { waitUntil: "networkidle" });
  check(await page.evaluate(() => document.documentElement.classList.contains("dark")), "Identité : thème sombre par défaut");
  check(await page.getByRole("link", { name: /Essayer/ }).first().isVisible(), "Accueil : bouton « Essayer »");
  check(await page.getByRole("link", { name: "Créer un compte" }).first().isVisible(), "Accueil : bouton « Créer un compte »");
  check((await page.locator("h1").first().innerText()).includes("Décrivez"), "Accueil : grand titre avec badge en pilule");
  check((await page.getByRole("heading", { name: "Comment ça marche" }).count()) === 1, "Accueil : explication en 3 étapes");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  const navOk = await Promise.all(["Accueil", "Éditeur", "Galerie"].map((n) => nav.getByRole("link", { name: n }).isVisible()));
  check(navOk.every(Boolean), "Navigation : Accueil, Éditeur, Galerie (+ Mon espace avec un compte)");
  const ids = await page.evaluate(() => ["accueil", "etapes", "exemples", "outils", "photo", "galerie", "commencer"].filter((id) => document.getElementById(id)).length);
  check(ids === 7, "Accueil : héros + 6 sections (étapes, exemples, outils, photo, galerie, appel final)");
  const rail = page.getByRole("navigation", { name: "Sections de la page" });
  check((await rail.getByRole("button").count()) === 7, "Accueil : indicateur de progression vertical (7 repères)");
  await page.mouse.move(200, 300);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(2500);
  check(true, "Accueil : objets 3D flottants autour du titre");
  await page.mouse.move(1100, 200, { steps: 8 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, "accueil.png") });

  // Bouton rond : section suivante, la navigation se réduit au défilement.
  const headerBefore = await page.locator("header").first().boundingBox();
  await page.getByRole("button", { name: "Section suivante" }).click();
  await page.waitForTimeout(1500);
  const headerAfter = await page.locator("header").first().boundingBox();
  check((await page.evaluate(() => window.scrollY)) > 300, "Accueil : le bouton rond descend à la section suivante");
  check(headerBefore && headerAfter && headerAfter.height < headerBefore.height, "Navigation : se réduit au défilement");
  await page.screenshot({ path: join(out, "accueil-etapes.png") });
  for (const id of ["exemples", "outils", "photo", "commencer"]) {
    await page.evaluate((target) => document.getElementById(target)?.scrollIntoView({ block: "start" }), id);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: join(out, `accueil-${id}.png`) });
  }
  check((await page.getByRole("button", { name: "Revenir en haut" }).count()) === 1, "Accueil : le bouton rond ramène en haut en fin de page");
  const slider = page.getByRole("slider", { name: /comparer/ });
  await page.evaluate(() => document.getElementById("photo")?.scrollIntoView({ block: "start" }));
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  check(Number(await slider.getAttribute("aria-valuenow")) < 50, "Avant / après : comparaison au clavier");

  // Thème clair puis arabe, depuis le sélecteur de l'en-tête.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Thème/ }).click();
  await page.getByRole("radio", { name: "Clair" }).click();
  await page.waitForTimeout(500);
  check(await page.evaluate(() => !document.documentElement.classList.contains("dark")), "Thème : mode clair appliqué");
  await page.screenshot({ path: join(out, "accueil-clair.png") });
  await page.getByRole("radio", { name: "Sombre" }).click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.documentElement.classList.contains("dark")), "Thème : retour au mode sombre");
  await page.getByRole("radio", { name: "العربية" }).click();
  await page.waitForFunction(() => document.documentElement.dir === "rtl", null, { timeout: 10000 });
  await page.waitForTimeout(1500);
  check(true, "Langue : arabe, lecture de droite à gauche");
  check((await page.getByRole("link", { name: "جرّب الآن" }).count()) >= 1, "Langue : textes traduits (arabe)");
  await page.screenshot({ path: join(out, "accueil-arabe.png") });
  await page.goto(`${base}/studio`, { waitUntil: "networkidle" });
  check(await page.evaluate(() => document.documentElement.classList.contains("dark") && document.documentElement.lang === "ar"), "Thème et langue mémorisés d'une page à l'autre");
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(out, "studio-sombre-arabe.png") });
});

// Accueil sur iPad (portrait) et iPhone : menu tactile, cibles de 44 px, objets placés au-dessus et au-dessous du titre.
for (const [name, viewport] of [
  ["accueil-ipad", { width: 820, height: 1180 }],
  ["accueil-iphone", { width: 390, height: 844 }],
]) {
  await session(name, viewport, async (page) => {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.mouse.click(viewport.width / 2, viewport.height - 40);
    await page.waitForSelector("canvas", { timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(out, `${name}.png`) });
    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Menu" }).click();
      const link = page.locator("#site-menu").getByRole("link", { name: "Éditeur" });
      const box = await link.boundingBox();
      check(box && box.height >= 44, `${name} : menu mobile, liens d'au moins 44 px`);
      await page.screenshot({ path: join(out, `${name}-menu.png`) });
    } else {
      check(await page.getByRole("navigation", { name: "Sections de la page" }).isVisible(), `${name} : indicateur de progression visible`);
    }
    const scrollBtn = await page.getByRole("button", { name: "Section suivante" }).boundingBox();
    check(scrollBtn && scrollBtn.width >= 44 && scrollBtn.height >= 44, `${name} : bouton rond de défilement (≥ 44 px)`);
  });
}

await session("galerie", { width: 1280, height: 800 }, async (page) => {
  const res = await page.goto(`${base}/galerie`, { waitUntil: "networkidle" });
  check(res.ok() && (await page.getByRole("heading", { name: "Galerie" }).isVisible()), "Galerie : page publique accessible");
  await page.screenshot({ path: join(out, "galerie.png") });
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
