// Exploration « comme un utilisateur » (mode démonstration) : chaque idée de l'accueil jusqu'au résultat,
// demandes variées dans l'éditeur, et tous les liens internes des pages publiques (aucune page cassée).
// Usage : node scripts/explore.mjs <url de base>
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3100";
let failed = 0;
const check = (ok, message) => {
  console.log(`${ok ? "✓" : "✗"} ${message}`);
  if (!ok) failed++;
};
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

// 1. Chaque idée de l'accueil mène à un résultat téléchargeable.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "fr-FR" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Voir des idées" }).click();
  const labels = await page.locator("ul li button").allInnerTexts();
  for (const label of labels) {
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Voir des idées" }).click();
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("button", { name: "Créer ma pièce" }).click();
    const outcome = await Promise.race([
      page.getByText(/Question 1 sur/).waitFor({ timeout: 20000 }).then(() => "questions"),
      page.getByRole("button", { name: "Télécharger pour imprimer" }).first().waitFor({ timeout: 20000 }).then(() => "result"),
    ]).catch(() => "rien");
    if (outcome === "questions") await page.getByRole("button", { name: "Passer, générer directement" }).click();
    const ok = await page.getByRole("button", { name: "Télécharger pour imprimer" }).first().waitFor({ timeout: 30000 }).then(() => true, () => false);
    const notUnderstood = await page.getByText(/Je n'ai pas compris/).count();
    check(ok && !notUnderstood, `Idée « ${label} » : résultat téléchargeable`);
  }
  check(errors.length === 0, `Idées : aucune erreur JavaScript (${errors.join(" | ").slice(0, 200)})`);
  await context.close();
}

// 2. Éditeur (mode avancé) : demandes variées.
{
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "fr-FR" });
  const page = await context.newPage();
  for (const prompt of [
    "Je voudrais un support pour poser ma tablette sur la table de la cuisine pendant que je lis des recettes, assez stable",
    "Une boîte avec couvercle pour ranger des vis et des écrous de différentes tailles sur mon établi, avec des compartiments",
    "Un crochet à visser au mur de l'entrée pour suspendre deux sacs lourds et un parapluie, solide et discret",
  ]) {
    await page.goto(`${base}/studio`, { waitUntil: "networkidle" });
    await page.locator("#prompt").fill(prompt);
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    if (await dialog.waitFor({ timeout: 6000 }).then(() => true, () => false)) {
      const skip = dialog.getByRole("button", { name: /^Concevoir|Passer tout|Générer/ }).first();
      if (await skip.count()) await skip.click();
    }
    const ready = await page.getByText(/Conception prête/).waitFor({ timeout: 30000 }).then(() => true, () => false);
    check(ready, `Éditeur : « ${prompt.slice(0, 50)}… » → conception prête`);
  }
  await context.close();
}

// 3. Tous les liens internes des pages publiques répondent (pas de 404 ni d'erreur serveur).
{
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  const seen = new Set();
  const broken = [];
  for (const start of ["/", "/decouvrir", "/studio", "/galerie", "/connexion", "/mentions-legales", "/confidentialite", "/cgu"]) {
    await page.goto(`${base}${start}`, { waitUntil: "networkidle" });
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const href of hrefs) {
      if (!href || !href.startsWith("/") || href.startsWith("//") || seen.has(href)) continue;
      seen.add(href);
      const res = await page.request.get(`${base}${href}`, { maxRedirects: 5 });
      if (res.status() >= 400) broken.push(`${href} (${res.status()}, vu sur ${start})`);
    }
  }
  check(broken.length === 0, `Liens internes : ${seen.size} vérifiés${broken.length ? ", cassés : " + broken.join(", ") : ""}`);
  await context.close();
}

await browser.close();
if (failed) {
  console.error(`${failed} anomalie(s).`);
  process.exit(1);
}
console.log("Exploration : aucune anomalie.");
