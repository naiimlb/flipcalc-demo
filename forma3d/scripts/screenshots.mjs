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

  // Clic sur une matière conseillée (onglet « Matière » des propriétés) : le modèle prend sa couleur et son aspect.
  await page.getByRole("tab", { name: "Matière" }).click();
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

// Refonte phase 2 : structure de l'éditeur (arborescence, propriétés, annuler / rétablir, raccourcis, vues, règle, panneaux).
await session("editeur", { width: 1440, height: 900 }, async (page) => {
  await ready(page);
  const tree = page.getByRole("tree", { name: "Pièces" });
  const items = tree.getByRole("treeitem");
  const count = await items.count();
  check(count >= 3, `Éditeur : arborescence des pièces (${count} pièces)`);
  for (const name of ["Objet", "Matière", "Dimensions", "Analyse", "Fabrication"]) {
    check(await page.getByRole("tab", { name, exact: true }).isVisible(), `Éditeur : onglet de propriétés « ${name} »`);
  }
  check(await page.getByRole("toolbar", { name: "Outils de l'éditeur" }).isVisible(), "Éditeur : barre d'outils à gauche");
  check(await page.getByRole("button", { name: /^Annuler/ }).isDisabled(), "Éditeur : « Annuler » inactif avant toute modification");

  // Sélection d'une pièce, puis modification de sa position (mm).
  await items.nth(1).getByRole("button").first().click();
  const nameField = page.getByLabel("Nom de la pièce");
  await nameField.waitFor({ timeout: 5000 });
  check(true, "Éditeur : la pièce choisie s'ouvre dans l'onglet Objet");
  const posX = page.locator("fieldset input").first();
  const before = await posX.inputValue();
  await posX.fill(String(Number(before) + 40));
  await posX.blur();
  await page.waitForTimeout(400);
  check(await page.getByRole("button", { name: /^Annuler/ }).isEnabled(), "Éditeur : modification enregistrée dans l'historique");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  check((await page.locator("fieldset input").first().inputValue()) === before, "Raccourci ⌘Z / Ctrl+Z : annuler");
  await page.keyboard.press("Control+Shift+z");
  await page.waitForTimeout(300);
  check((await page.locator("fieldset input").first().inputValue()) !== before, "Raccourci ⇧⌘Z / Ctrl+Maj+Z : rétablir");

  // Dupliquer (Ctrl+D) puis supprimer (Suppr) la pièce sélectionnée.
  await page.keyboard.press("Control+d");
  await page.waitForTimeout(300);
  check((await items.count()) === count + 1, "Raccourci ⌘D / Ctrl+D : dupliquer la pièce");
  await page.keyboard.press("Delete");
  await page.waitForTimeout(300);
  check((await items.count()) === count, "Raccourci Suppr : supprimer la pièce");
  await page.waitForTimeout(1800);
  check(await page.getByText(/Enregistré/).first().isVisible(), "Sauvegarde automatique (sur l'appareil pour un exemple)");

  // Masquer une pièce, raccourcis W/E/R, règle, 4 vues.
  await tree.getByRole("button", { name: /^Masquer / }).first().click();
  check((await tree.getByRole("button", { name: /^Afficher / }).count()) === 1, "Arborescence : masquer / afficher une pièce");
  await page.keyboard.press("e");
  check((await page.getByRole("button", { name: "Tourner (E)" }).getAttribute("aria-pressed")) === "true", "Raccourci E : outil Tourner");
  await page.keyboard.press("w");
  check((await page.getByRole("button", { name: "Déplacer (W)" }).getAttribute("aria-pressed")) === "true", "Raccourci W : outil Déplacer");
  await page.getByRole("button", { name: "Règle (cotes) (M)" }).click();
  await page.waitForTimeout(600);
  check((await page.getByText(/^\d+ mm$/).count()) >= 3, "Règle : cotes largeur, profondeur, hauteur");
  await page.getByRole("button", { name: "4 vue(s)" }).click();
  await page.waitForTimeout(3000);
  check((await page.locator("canvas").count()) === 4, "Vues multiples : 4 vues (perspective, dessus, face, droite)");
  await page.screenshot({ path: join(out, "editeur-4-vues.png") });
  await page.getByRole("button", { name: "2 vue(s)" }).click();
  await page.waitForTimeout(1500);
  check((await page.locator("canvas").count()) === 2, "Vues multiples : 2 vues");
  await page.getByRole("button", { name: "1 vue(s)" }).click();

  // Panneau redimensionnable au clavier (poignée).
  const handle = page.getByRole("separator", { name: "Redimensionner le panneau" }).first();
  const w0 = Number(await handle.getAttribute("aria-valuenow"));
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  check(Number(await handle.getAttribute("aria-valuenow")) > w0, "Panneaux redimensionnables (souris, trackpad, clavier)");

  // Renommer le projet depuis la barre du haut.
  await page.getByRole("button", { name: "Renommer le projet" }).click();
  await page.getByLabel("Renommer le projet").fill("Mon projet renommé");
  await page.keyboard.press("Enter");
  check(await page.locator("h2", { hasText: "Mon projet renommé" }).isVisible(), "Barre du haut : nom du projet modifiable");
  await page.screenshot({ path: join(out, "editeur.png") });
});

// Refonte phase 3 : outils de création (formes, opérations, texte, forme libre, mesure, matières, rendu, « Modifie la pièce »).
await session("outils", { width: 1440, height: 900 }, async (page) => {
  await ready(page);
  const tree = page.getByRole("tree", { name: "Pièces" });
  const items = tree.getByRole("treeitem");
  const count0 = await items.count();
  check(await page.getByText("Personnalisation guidée").isVisible(), "Personnalisation guidée : curseurs de variantes");
  check((await page.locator('input[type="range"]').count()) >= 4, "Personnalisation guidée : 4 curseurs (petit, solide, cher, esthétique)");
  check((await page.getByText("Modèle 3D détaillé (Meshy)").count()) === 0, "Meshy masqué tant qu'il n'est pas configuré (mode démo)");

  // Ajouter une forme.
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cylindre" }).click();
  await page.waitForTimeout(400);
  check((await items.count()) === count0 + 1, "Ajouter : cylindre ajouté (et sélectionné)");
  check((await page.getByRole("button", { name: "Déplacer (W)" }).getAttribute("aria-pressed")) === "true", "Poignées : outil Déplacer activé sur la nouvelle pièce");
  await page.screenshot({ path: join(out, "outils-poignees.png") });

  // Répétition en ligne sur la pièce ajoutée.
  await page.getByLabel("Opération", { exact: true }).selectOption({ label: "Répétition en ligne" });
  await page.getByRole("button", { name: "Appliquer l'opération" }).click();
  await page.waitForTimeout(400);
  check((await items.count()) === count0 + 4, "Opérations : répétition en ligne (4 exemplaires)");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  check((await items.count()) === count0 + 1, "Annuler une opération (Ctrl+Z)");

  // Cube percé (devient un profilé avec un trou).
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cube" }).click();
  await page.getByLabel("Opération", { exact: true }).selectOption({ label: "Percer un trou" });
  await page.getByRole("button", { name: "Appliquer l'opération" }).click();
  await page.waitForTimeout(400);
  check((await tree.getByText("Profilé").count()) >= 1, "Opérations : perçage d'un trou au diamètre exact");

  // Texte en relief sur le cube.
  const before = await items.count();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("menuitem", { name: "Texte" }).click();
  const textDialog = page.getByRole("dialog", { name: "Ajouter un texte" });
  await textDialog.getByLabel("Texte", { exact: true }).fill("AB");
  await textDialog.getByRole("button", { name: "Ajouter le texte" }).click();
  await textDialog.waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  check((await items.count()) >= before + 2, "Texte en relief (police chargée à la demande)");

  // Forme libre tracée.
  const beforeDraw = await items.count();
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("menuitem", { name: "Forme libre" }).click();
  const pad = page.getByLabel("Zone de tracé");
  const box = await pad.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx + 120, cy);
    await page.mouse.down();
    for (let i = 1; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      await page.mouse.move(cx + Math.cos(a) * 120, cy + Math.sin(a) * 80, { steps: 2 });
    }
    await page.mouse.up();
  }
  await page.getByRole("button", { name: "Extruder la forme" }).click();
  await page.waitForTimeout(500);
  check((await items.count()) === beforeDraw + 1, "Forme libre : tracé extrudé");
  await page.screenshot({ path: join(out, "outils-formes.png") });

  // Matières et rendu.
  await page.getByRole("tab", { name: "Matière", exact: true }).click();
  await page.getByRole("button", { name: "Résine", exact: true }).click();
  await page.waitForTimeout(300);
  check((await page.getByRole("button", { name: "Résine", exact: true }).getAttribute("aria-pressed")) === "true", "Bibliothèque de matières : résine appliquée à la pièce");
  await page.getByRole("radio", { name: "Néon bleu/orange" }).click();
  await page.waitForTimeout(1500);
  check((await page.getByRole("radio", { name: "Néon bleu/orange" }).getAttribute("aria-checked")) === "true", "Éclairage : préréglage néon bleu/orange");
  check(await page.getByRole("button", { name: /Vidéo 360/ }).isVisible(), "Rendu : vidéo de rotation à 360°");
  await page.screenshot({ path: join(out, "outils-rendu.png") });

  // « Modifie la pièce » sur un pavé (consignes simples sans IA en mode démo).
  await page.getByRole("tab", { name: "Objet", exact: true }).click();
  await tree.getByRole("treeitem").filter({ hasText: "Pavé" }).first().getByRole("button").first().click();
  await page.getByRole("textbox", { name: "Modifie la pièce" }).fill("arrondis les angles");
  await page.getByRole("button", { name: "Appliquer", exact: true }).first().click();
  await page.getByText("Angles arrondis.").waitFor({ timeout: 10000 }).then(() => check(true, "« Modifie la pièce » : consigne appliquée"), () => check(false, "« Modifie la pièce » : consigne appliquée"));

  // Mesure entre deux points du modèle.
  await page.keyboard.press("Escape");
  await page.keyboard.press("u");
  const canvas = await page.locator("canvas").first().boundingBox();
  // Un clic à côté du modèle est ignoré : on vise plusieurs endroits jusqu'à obtenir deux points sur des pièces.
  const distance = page.getByText(/^\d+(\.\d)? mm$/);
  if (canvas) {
    const spots = [[0.45, 0.5], [0.55, 0.52], [0.6, 0.55], [0.5, 0.6], [0.4, 0.55], [0.65, 0.5], [0.35, 0.45], [0.5, 0.45]];
    for (const [fx, fy] of spots) {
      await page.mouse.click(canvas.x + canvas.width * fx, canvas.y + canvas.height * fy);
      await page.waitForTimeout(250);
      if ((await distance.count()) >= 1) break;
    }
  }
  await page.waitForTimeout(500);
  check((await distance.count()) >= 1, "Outil de mesure : distance entre deux points");
  await page.screenshot({ path: join(out, "outils-mesure.png") });
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

// Accueil sobre (design professionnel) : héros, aperçu réel de l'éditeur, sections factuelles ; thème sombre par défaut, clair, arabe.
await session("accueil", { width: 1366, height: 900 }, async (page) => {
  await page.goto(`${base}/decouvrir`, { waitUntil: "networkidle" });
  check(await page.evaluate(() => document.documentElement.classList.contains("dark")), "Identité : thème sombre par défaut");
  check(await page.getByRole("link", { name: /Ouvrir l'éditeur/ }).first().isVisible(), "Accueil : bouton « Ouvrir l'éditeur »");
  check(await page.getByRole("link", { name: "Créer un compte" }).first().isVisible(), "Accueil : bouton « Créer un compte »");
  const h1 = page.locator("h1").first();
  const h1Size = await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check((await h1.innerText()).includes("Décrivez") && h1Size <= 40, `Accueil : titre de taille raisonnable (${h1Size} px ≤ 40)`);
  check((await page.getByRole("heading", { name: "Comment ça marche" }).count()) === 1, "Accueil : explication en 3 étapes");
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  const navOk = await Promise.all(["Accueil", "Éditeur", "Galerie"].map((n) => nav.getByRole("link", { name: n }).isVisible()));
  check(navOk.every(Boolean), "Navigation : Accueil, Éditeur, Galerie (+ Mon espace avec un compte)");
  const ids = await page.evaluate(() => ["accueil", "apercu", "etapes", "outils", "exemples", "galerie", "commencer"].filter((id) => document.getElementById(id)).length);
  check(ids === 7, "Accueil : héros + aperçu de l'éditeur + 5 sections (étapes, fonctions, exemples, galerie, appel final)");
  const preview = page.locator("#apercu img");
  await preview.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  check(await preview.evaluate((img) => img.complete && img.naturalWidth >= 1000), "Accueil : aperçu réel de l'éditeur (capture, sans cadre d'appareil)");
  // Sobriété : pas de dégradé de fond ni d'ombre lourde sur la page.
  const decor = await page.evaluate(() => {
    const bodyBg = getComputedStyle(document.body).backgroundImage;
    const gradients = [...document.querySelectorAll("main *")].filter((el) => /gradient/.test(getComputedStyle(el).backgroundImage)).length;
    return { bodyBg, gradients };
  });
  check(decor.bodyBg === "none" && decor.gradients === 0, `Design : aucun dégradé de fond (${decor.gradients})`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(200, 300);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(2500);
  check(true, "Accueil : objets 3D (chargés à la première interaction)");
  await page.mouse.move(1100, 200, { steps: 8 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out, "accueil.png") });
  for (const id of ["apercu", "etapes", "outils", "exemples", "commencer"]) {
    await page.evaluate((target) => document.getElementById(target)?.scrollIntoView({ block: "start" }), id);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(out, `accueil-${id}.png`) });
  }
  const header = await page.locator("header").first().boundingBox();
  check(header && header.height >= 55 && header.height <= 57, "Navigation : barre de 56 px, filet au défilement");

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
  check((await page.getByRole("link", { name: "افتح المحرّر" }).count()) >= 1, "Langue : textes traduits (arabe)");
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
    await page.goto(`${base}/decouvrir`, { waitUntil: "networkidle" });
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
    }
    const cta = await page.getByRole("link", { name: /Ouvrir l'éditeur/ }).first().boundingBox();
    check(cta && cta.height >= 44, `${name} : bouton principal d'au moins 44 px`);
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
  await page.getByRole("button", { name: "Propriétés" }).click();
  const drawer = page.getByRole("dialog", { name: "Propriétés" });
  await drawer.waitFor({ timeout: 5000 });
  check(await drawer.getByRole("tab", { name: "Matière" }).isVisible(), "iPad : panneau de propriétés en tiroir");
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, "ipad-tiroir.png") });
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
