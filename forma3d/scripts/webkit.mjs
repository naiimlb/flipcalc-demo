// Vérifications dans WebKit (le moteur de Safari) : accueil, éditeur, gestes tactiles sur un iPad émulé, PWA.
// Usage : node scripts/webkit.mjs <url> <dossier>
// Limite connue : c'est WebKit sous Linux, pas un vrai Safari sur iPad ou Mac (pas d'Apple Pencil, de capteur d'inclinaison
// ni d'écran Retina). Il détecte les erreurs de moteur (JavaScript, CSS, WebGL) mais ne remplace pas un essai sur appareil.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { webkit, devices } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
mkdirSync(out, { recursive: true });

const errors = [];
const lines = [];
const check = (ok, label) => lines.push(`${ok ? "✓" : "✗"} ${label}`);
const note = (label) => lines.push(`• ${label}`);

const browser = await webkit.launch();

async function session(name, options, run) {
  const context = await browser.newContext({ locale: "fr-FR", ...options });
  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(`[${name}] page : ${err.message}`));
  page.on("console", (msg) => msg.type() === "error" && errors.push(`[${name}] console : ${msg.text()}`));
  try {
    await run(page);
  } catch (err) {
    errors.push(`[${name}] script : ${err.message}`);
    await page.screenshot({ path: join(out, `webkit-${name}-echec.png`) }).catch(() => {});
  }
  await context.close();
}

const hasWebGL = async (page) => page.evaluate(() => !!document.createElement("canvas").getContext("webgl2") || !!document.createElement("canvas").getContext("webgl"));

// 1. Accueil sur un MacBook.
await session("accueil", { viewport: { width: 1440, height: 900 } }, async (page) => {
  await page.goto(base, { waitUntil: "networkidle" });
  check(await page.locator("h1#hero-title").isVisible(), "Safari : accueil, grand titre visible");
  check((await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name: "Éditeur" }).count()) === 1, "Safari : navigation principale");
  const webgl = await hasWebGL(page);
  note(webgl ? "WebGL disponible dans ce WebKit" : "WebGL indisponible dans ce WebKit de test (les objets 3D ne peuvent pas être vérifiés ici)");
  await page.mouse.move(300, 300, { steps: 4 });
  await page.mouse.down();
  await page.mouse.up();
  if (webgl) {
    await page.waitForSelector("canvas", { timeout: 20000 }).then(() => check(true, "Safari : objets 3D du héros chargés à la première interaction"), () => check(false, "Safari : objets 3D du héros chargés à la première interaction"));
  }
  await page.screenshot({ path: join(out, "webkit-accueil.png") });
  const scrollOk = await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight / 2);
    return window.scrollY > 100;
  });
  check(scrollOk, "Safari : la page défile");
});

// 2. Éditeur sur un iPad Pro 11" (tactile, paysage).
// (defaultBrowserType n'est pas accepté par newContext : on le retire du profil d'appareil.)
const { defaultBrowserType: _ignored, ...ipad } = devices["iPad Pro 11 landscape"];
await session("ipad", ipad, async (page) => {
  await page.goto(`${base}/studio`, { waitUntil: "networkidle" });
  check(await page.locator("#prompt").isVisible(), "iPad Safari : barre de demande visible");
  check(await page.getByRole("toolbar", { name: "Outils de l'éditeur" }).isVisible(), "iPad Safari : barre d'outils à gauche");
  const webgl = await hasWebGL(page);
  if (webgl) {
    await page.waitForSelector("canvas", { timeout: 20000 }).then(() => check(true, "iPad Safari : vue 3D affichée"), () => check(false, "iPad Safari : vue 3D affichée"));
  }
  // Toucher (et non cliquer) : menu Ajouter, puis choix d'une forme.
  await page.getByRole("button", { name: "Ajouter", exact: true }).tap();
  const menu = page.getByRole("menu", { name: "Ajouter" });
  check(await menu.isVisible(), "iPad Safari : le menu Ajouter s'ouvre au toucher");
  await menu.getByRole("menuitem", { name: "Cylindre" }).tap();
  await page.waitForTimeout(600);
  // La liste des pièces est dans un tiroir sur iPad : on lit la pastille « N pièces » de la vue 3D (12 → 13).
  await page.getByText("13 pièces").first().waitFor({ timeout: 5000 }).then(() => check(true, "iPad Safari : une forme s'ajoute au toucher"), () => check(false, "iPad Safari : une forme s'ajoute au toucher"));
  // Cibles tactiles d'au moins 44 px sur les boutons de la barre d'outils.
  const small = await page.getByRole("toolbar", { name: "Outils de l'éditeur" }).getByRole("button").evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).length);
  check(small === 0, "iPad Safari : boutons de la barre d'outils d'au moins 44 px");
  await page.screenshot({ path: join(out, "webkit-ipad-studio.png") });
});

// 3. Application installable : manifeste lu par le navigateur.
await session("pwa", { viewport: { width: 1024, height: 768 } }, async (page) => {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  check(Boolean(href), "Safari : manifeste PWA référencé");
  const manifest = await (await page.request.get(new URL(href ?? "/manifest.webmanifest", base).toString())).json();
  check(manifest.display === "standalone" && manifest.start_url === "/studio", "PWA : plein écran, démarre sur l'éditeur");
  check(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 2, "PWA : raccourcis (Nouvelle conception, Galerie)");
  check(Boolean(await page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').count()), "PWA : application web iOS déclarée");
  check((await page.locator('link[rel="apple-touch-startup-image"]').count()) >= 10, "PWA : écrans de lancement iPad / iPhone");
  check(Boolean(await page.locator('link[rel="apple-touch-icon"]').count()), "PWA : icône d'écran d'accueil");
});

await browser.close();

writeFileSync(join(out, "webkit.txt"), lines.join("\n") + "\n");
writeFileSync(join(out, "webkit-erreurs.txt"), errors.length ? errors.join("\n") + "\n" : "Aucune erreur.\n");
console.log(lines.join("\n"));
console.log(errors.length ? errors.join("\n") : "Aucune erreur.");
