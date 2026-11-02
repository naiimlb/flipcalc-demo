// Parcours complet contre le vrai projet Supabase (CI) :
// essai invité → connexion → import de l'essai → génération sauvegardée → modèle 3D dans Storage
// → Mon espace (dossier, renommage, duplication, favoris, matières, paramètres) → export → autre appareil
// → suppression du compte.
// Usage : E2E_EMAIL=… E2E_PASSWORD=… node scripts/e2e-account.mjs <url> <dossier>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "e2e-screens";
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
mkdirSync(out, { recursive: true });

const checks = [];
const errors = [];
const check = (ok, label) => {
  checks.push(`${ok ? "✓" : "✗"} ${label}`);
  console.log(`${ok ? "✓" : "✗"} ${label}`);
};
const shot = (page, name) => page.screenshot({ path: join(out, `${name}.png`) }).catch(() => {});

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function newPage(name) {
  // Chaque exécution a sa propre adresse (serveur local : aucun en-tête réel), sinon le quota d'essais invités
  // (2 par jour et par adresse) est partagé entre toutes les exécutions de la CI.
  const octet = (max) => 1 + Math.floor(Math.random() * max);
  const fakeIp = `198.${octet(250)}.${octet(250)}.${octet(250)}`;
  const context = await browser.newContext({
    locale: "fr-FR",
    viewport: { width: 1366, height: 900 },
    acceptDownloads: true,
    extraHTTPHeaders: { "x-forwarded-for": fakeIp },
  });

  const page = await context.newPage();
  page.on("pageerror", (err) => errors.push(`[${name}] page : ${err.message}`));
  page.on("console", (msg) => msg.type() === "error" && errors.push(`[${name}] console : ${msg.text()}`));
  return { context, page };
}

async function login(page) {
  await page.goto(`${base}/connexion`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 20000 }), page.getByRole("button", { name: "Se connecter" }).click()]);
}

let mainPage = null;
let stage = "début";
try {
  // 0. Sécurité : sans session, l'API Supabase ne renvoie aucune donnée privée.
  for (const table of ["design_requests", "profiles", "folders", "request_debug", "app_logs"]) {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=5`, { headers: { apikey: supabaseKey } });
    const body = await res.json().catch(() => null);
    check((Array.isArray(body) && body.length === 0) || res.status >= 400, `RLS : « ${table} » illisible sans compte`);
  }

  const { context, page } = await newPage("appareil-1");
  mainPage = page;

  // 1. Essai sans compte (le studio est sur /studio ; l'accueil présente le site aux visiteurs).
  await page.goto(`${base}/studio`, { waitUntil: "networkidle" });
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.locator("#prompt").fill("Je perds tout le temps mes clés en rentrant chez moi");
  await page.keyboard.press("Enter");
  await page.getByText("Résultat non sauvegardé").waitFor({ timeout: 40000 });
  check(true, "Invité : une demande donne un modèle 3D, marqué « non sauvegardé »");
  await page.getByRole("dialog").waitFor({ timeout: 8000 }).catch(() => {});
  check(await page.getByRole("dialog").isVisible(), "Invité : on lui propose de créer un compte");
  await shot(page, "01-invite");
  await page.getByRole("button", { name: "Fermer" }).click().catch(() => {});

  // 2. Connexion : l'essai est importé dans le compte.
  await login(page);
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.getByText(/ajouté à votre espace/).waitFor({ timeout: 20000 });
  check(true, "Connexion : l'essai invité est ajouté au compte");
  await shot(page, "02-connecte");

  stage = "génération";
  // 3. Génération sauvegardée + modèle 3D dans Storage.
  await page.locator("#prompt").fill("Une solution pour ranger mes câbles de charge");
  await page.keyboard.press("Enter");
  await page.locator("h2", { hasText: "Peigne range-câbles lesté" }).waitFor({ timeout: 60000 });
  await page.getByText("Modèle 3D sauvegardé dans votre espace").waitFor({ timeout: 40000 });
  check(true, "Demande enregistrée et modèle 3D (GLB) envoyé dans Supabase Storage");
  await page.getByRole("button", { name: "Ajouter aux favoris" }).first().click();
  const heart = page.getByRole("button", { name: /^Ajouter .* aux matières préférées$/ }).first();
  await heart.click();
  await page.waitForTimeout(1200);
  await shot(page, "03-generation");

  stage = "Mon espace";
  // 4. Mon espace.
  await page.goto(`${base}/espace`, { waitUntil: "networkidle" });
  const rows = page.locator("main li.panel");
  check((await rows.count()) >= 2, `Mon espace : ${await rows.count()} demandes (essai importé + nouvelle)`);
  await page.getByPlaceholder("Nouveau dossier").fill("Bureau");
  await page.getByRole("button", { name: "Créer le dossier" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Toutes les demandes/ }).click();
  await rows.first().getByLabel("Dossier").selectOption({ label: "Bureau" });
  await page.getByText("Demande classée.").waitFor({ timeout: 8000 });
  check(true, "Dossiers : création et classement");
  await rows.first().getByTitle("Renommer").click();
  await page.getByLabel("Nouveau titre").fill("Mon peigne à câbles");
  await page.keyboard.press("Enter");
  await page.getByText("Demande renommée.").waitFor({ timeout: 8000 });
  check(true, "Renommage");
  const before = await rows.count();
  await rows.first().getByRole("button", { name: "Dupliquer" }).click();
  await page.getByText("Demande dupliquée.").waitFor({ timeout: 8000 });
  check((await rows.count()) === before + 1, "Duplication");
  await shot(page, "04-espace");

  await page.getByRole("button", { name: "Mes modèles 3D" }).click();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }), page.getByRole("button", { name: "GLB" }).first().click()]);
  const glbPath = await download.path();
  const { statSync } = await import("node:fs");
  check(glbPath && statSync(glbPath).size > 1000, "Mes modèles 3D : téléchargement du GLB depuis Storage");
  await shot(page, "05-modeles");

  await page.getByRole("button", { name: "Favoris", exact: true }).click();
  check((await rows.count()) >= 1, "Favoris");
  await page.getByRole("button", { name: "Matières préférées" }).click();
  check((await page.locator("main").getByRole("button", { name: /^Retirer / }).count()) >= 1, "Matières préférées");
  await page.getByRole("button", { name: "Paramètres" }).click();
  await page.getByLabel("Nom affiché").fill("Testeur E2E");
  await page.getByLabel("Unités").selectOption("cm");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Paramètres enregistrés.").waitFor({ timeout: 8000 });
  check(true, "Paramètres : nom et unités");
  await shot(page, "06-parametres");

  stage = "export";
  // 5. Export de toutes les données.
  const exported = await (await page.request.get(`${base}/api/account/export`)).json();
  check(exported.requests?.length >= 3 && exported.folders?.length >= 1, `Export : ${exported.requests?.length} demandes, ${exported.folders?.length} dossier(s)`);
  check(exported.profile?.units === "cm" && exported.profile?.display_name === "Testeur E2E", "Export : profil à jour");
  check(exported.requests.some((r) => r.model_download_url), "Export : lien de téléchargement du modèle 3D");

  stage = "autre appareil";
  // 6. Autre appareil : mêmes données après connexion.
  const second = await newPage("appareil-2");
  await login(second.page);
  await second.page.goto(`${base}/espace`, { waitUntil: "networkidle" });
  const rows2 = await second.page.locator("main li.panel").count();
  check(rows2 === exported.requests.length, `Autre appareil : ${rows2} demandes retrouvées`);
  await second.context.close();

  stage = "suppression";
  // 7. Suppression du compte.
  await page.getByRole("button", { name: "Mes données" }).click();
  await page.getByLabel("Tapez SUPPRIMER pour confirmer").fill("SUPPRIMER");
  await Promise.all([page.waitForURL((u) => u.pathname === "/", { timeout: 20000 }), page.getByRole("button", { name: "Supprimer définitivement" }).click()]);
  check(true, "Suppression du compte");
  await page.goto(`${base}/connexion`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByText("Email ou mot de passe incorrect.").waitFor({ timeout: 15000 });
  check(true, "Après suppression : connexion impossible");
  await context.close();
} catch (err) {
  check(false, `Parcours interrompu à l'étape « ${stage} » : ${err.message.split("\n").slice(0, 4).join(" | ")}`);
  if (mainPage) await mainPage.screenshot({ path: join(out, "99-echec.png") }).catch(() => {});
}

await browser.close();
writeFileSync(join(out, "verifications.txt"), checks.join("\n") + "\n");
writeFileSync(join(out, "erreurs-console.txt"), errors.length ? errors.join("\n") : "Aucune erreur.\n");
process.exit(checks.some((c) => c.startsWith("✗")) ? 1 : 0);
