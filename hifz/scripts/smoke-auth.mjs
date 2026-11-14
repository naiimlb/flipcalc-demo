#!/usr/bin/env node
/**
 * Test de bout en bout des comptes (Chromium, gabarit iPhone) contre un faux serveur Supabase
 * émulé dans le navigateur : aucun appel réseau réel.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://fake.supabase.test NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fake npm run build
 *   npm start -- -p 3101 &
 *   node scripts/smoke-auth.mjs http://localhost:3101 [dossier-captures]
 *
 * Parcours : accès protégé, mauvais mot de passe, inscription, connexion, synchronisation vers le
 * serveur, second appareil, modification hors ligne puis rattrapage, déconnexion, isolation entre
 * deux comptes, reprise des données d'avant les comptes.
 */
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFakeSupabase, GOOD_PASSWORD } from "./lib/fake-supabase.mjs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:3101";
const OUT = process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), "..", ".smoke-auth");
await mkdir(OUT, { recursive: true });

const iphone = { ...devices["iPhone 13"] };
delete iphone.defaultBrowserType;
const browser = await chromium.launch();
const fake = createFakeSupabase();
const errors = [];

function check(condition, message) {
  if (!condition) throw new Error(`Échec : ${message}`);
  console.log(`  ✓ ${message}`);
}

async function newDevice(name) {
  const context = await browser.newContext({ ...iphone, locale: "fr-FR", colorScheme: "light" });
  await context.route("https://everyayah.com/**", (r) => r.abort());
  await fake.install(context);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    const text = m.text();
    if (m.type() === "error" && !/everyayah|ERR_FAILED|ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR|status of 400/.test(text)) {
      errors.push(`[${name}] console: ${text}`);
    }
  });
  let shots = 0;
  const shot = (label) => page.screenshot({ path: join(OUT, `${name}-${String(++shots).padStart(2, "0")}-${label}.png`) });
  return { context, page, shot };
}

async function until(fn, message, timeout = 20_000) {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > timeout) throw new Error(`Délai dépassé : ${message}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function login(page, email, password = GOOD_PASSWORD) {
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel(/^Mot de passe/).fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).last().click();
}

async function chooseIkhlas(page) {
  await page.getByRole("link", { name: "Choisir un programme" }).click();
  await page.getByRole("link", { name: "Choisir une sourate" }).click();
  await page.getByPlaceholder(/Nom ou numéro/).fill("112");
  await page.getByRole("button", { name: /Al-Ikhlaas/ }).click();
  await page.getByRole("button", { name: "Ajouter au programme", exact: true }).click();
  await page.waitForURL(/\/hifz\/programme$/);
}

async function gradeFirstVerse(page, grade) {
  await page.getByRole("link", { name: "Aujourd'hui" }).click();
  await page.getByRole("link", { name: "Commencer" }).click();
  await page.getByText("Nouveau verset").waitFor();
  await page.getByRole("button", { name: "Je suis prêt à réciter" }).and(page.locator(":enabled")).click();
  await page.getByRole("button", { name: "Révéler" }).click();
  await page.getByRole("button", { name: new RegExp(`^${grade}`) }).click();
  // La session masque la barre d'onglets : on la quitte pour revenir à l'app.
  const summary = page.getByRole("link", { name: "Terminer" });
  const quit = page.getByRole("link", { name: "Quitter la session" });
  await summary.or(quit).first().click();
  await page.getByRole("navigation", { name: "Navigation principale" }).waitFor();
}

const A = "alice@test.fr";
console.log(`Test des comptes sur ${BASE}`);

// 1. Accès protégé et mauvais mot de passe
const a = await newDevice("A");
await a.page.goto(BASE);
await a.page.waitForURL(/\/connexion$/);
check(true, "sans connexion, l'accueil redirige vers la connexion");
check((await a.page.getByRole("navigation", { name: "Navigation principale" }).count()) === 0, "pas de barre d'onglets avant la connexion");
await a.page.goto(`${BASE}/hifz/session`);
await a.page.waitForURL(/\/connexion$/);
check(true, "la session de récitation est protégée");
await a.shot("connexion");

await login(a.page, A, "mauvais");
await a.page.getByRole("alert").filter({ hasText: "E-mail ou mot de passe incorrect." }).waitFor();
check(true, "mauvais mot de passe : message en français");

await a.page.getByLabel("Adresse e-mail").fill("pas-un-email");
await a.page.getByRole("button", { name: "Se connecter", exact: true }).last().click();
await a.page.getByRole("alert").filter({ hasText: "adresse e-mail valide" }).waitFor();
check(true, "adresse invalide refusée avant tout envoi");

// 2. Inscription : mot de passe trop court, puis e-mail de confirmation
await a.page.getByRole("radio", { name: "Créer un compte" }).click();
await a.page.getByLabel("Adresse e-mail").fill("nouvelle@test.fr");
await a.page.getByLabel(/^Mot de passe/).fill("court");
await a.page.getByRole("button", { name: "Créer mon compte" }).click();
await a.page.getByRole("alert").filter({ hasText: "au moins 8 caractères" }).waitFor();
await a.page.getByLabel(/^Mot de passe/).fill(GOOD_PASSWORD);
await a.page.getByRole("button", { name: "Créer mon compte" }).click();
await a.page.getByRole("status").filter({ hasText: "e-mail de confirmation" }).waitFor();
check(fake.state.signups.includes("nouvelle@test.fr"), "inscription envoyée, confirmation demandée");
await a.shot("inscription");

// 3. Connexion, programme, première révision, envoi au serveur
await login(a.page, A);
await a.page.getByText("Bienvenue").waitFor();
check(true, "connexion réussie, accueil du compte (vide)");
check((await a.page.getByRole("navigation", { name: "Navigation principale" }).count()) === 1, "barre d'onglets après connexion");
await chooseIkhlas(a.page);
await gradeFirstVerse(a.page, "Je sais");
await until(() => fake.rowsOf(A, "hifz_cards").some((r) => r.key === "112:1" && r.data.lastGrade === "good"), "révision envoyée au serveur");
check(fake.rowsOf(A, "hifz_cards").length === 4, "les 4 versets du programme sont sur le serveur");
check(fake.rowsOf(A, "hifz_programs").length === 1, "le programme est sur le serveur");
check(fake.rowsOf(A, "hifz_reviews").length === 1, "la révision est dans le journal du serveur");
await a.shot("apres-revision");

// 4. Second appareil : retrouve tout après connexion
const b = await newDevice("B");
await b.page.goto(BASE);
await b.page.waitForURL(/\/connexion$/);
await login(b.page, A);
await b.page.getByText("Session du jour").waitFor();
await until(async () => (await b.page.locator("dt:has-text('Nouveaux') + dd").innerText()) === "2", "versets récupérés sur le second appareil");
// 3 nouveaux par jour au maximum, dont 1 déjà appris aujourd'hui sur le premier appareil : il en reste 2.
check(true, "second appareil : programme et progression retrouvés (la limite du jour tient compte de l'autre appareil)");
await b.page.getByRole("link", { name: "Suivi" }).click();
await b.page.getByText("sur 4 suivis").waitFor();
check((await b.page.locator("dt:has-text('En cours') + dd").first().innerText()) === "1", "second appareil : 1 verset en cours");
await b.shot("suivi");

// 5. Hors ligne sur B : modification, puis rattrapage
await b.page.getByRole("link", { name: "Réglages" }).click();
await b.page.getByText("Connecté en tant que").waitFor();
check(await b.page.getByText(A).isVisible(), "réglages : e-mail du compte affiché");
fake.state.down = true;
await gradeFirstVerse(b.page, "Hésitant");
await b.page.getByRole("link", { name: "Réglages" }).click();
await b.page.getByText(/modifications? à envoyer/).waitFor({ timeout: 15_000 });
check(true, "hors ligne : les modifications attendent d'être envoyées");
check(fake.rowsOf(A, "hifz_cards").find((r) => r.key === "112:2")?.data.lastGrade === null, "hors ligne : la note n'est pas partie au serveur");
await b.shot("hors-ligne");
fake.state.down = false;
await b.page.getByRole("button", { name: "Synchroniser", exact: true }).click();
await until(() => fake.rowsOf(A, "hifz_cards").some((r) => r.key === "112:2" && r.data.lastGrade === "hard"), "rattrapage après retour du réseau");
check(true, "retour du réseau : les modifications sont envoyées");
await b.page.getByText(/Synchronisé à/).waitFor();

// 6. Retour sur A : récupère la modification de B
await a.page.getByRole("link", { name: "Réglages" }).click();
await a.page.getByRole("button", { name: "Synchroniser", exact: true }).click();
await a.page.getByRole("link", { name: "Suivi" }).click();
await until(async () => (await a.page.locator("dt:has-text('En cours') + dd").first().innerText().catch(() => "")) === "2", "A reçoit la révision de B");
check(true, "premier appareil : reçoit la révision faite sur le second");

// 7. Déconnexion, protection, isolation entre comptes
await a.page.getByRole("link", { name: "Réglages" }).click();
a.page.once("dialog", (d) => d.accept());
await a.page.getByRole("button", { name: "Se déconnecter" }).click();
await a.page.waitForURL(/\/connexion$/);
check(true, "déconnexion : retour à la connexion");
await a.page.goto(BASE);
await a.page.waitForURL(/\/connexion$/);
check(true, "après déconnexion, l'accueil est de nouveau protégé");

await login(a.page, "bob@test.fr");
await a.page.getByText("Bienvenue").waitFor();
check(true, "un autre compte sur le même appareil démarre vide (aucun mélange)");
check(fake.rowsOf("bob@test.fr", "hifz_cards").length === 0, "rien n'est envoyé au compte d'un autre utilisateur");
await a.shot("autre-compte");

// 8. Reprise des données d'avant les comptes (base locale historique)
const c = await newDevice("C");
await c.page.goto(`${BASE}/sources`);
await c.page.evaluate(
  () =>
    new Promise((resolve, reject) => {
      // Base telle que l'ancienne version de l'app (Dexie v1) l'avait créée.
      const req = indexedDB.open("hifz", 10);
      req.onupgradeneeded = () => {
        const db = req.result;
        const cards = db.createObjectStore("cards", { keyPath: "key" });
        for (const i of ["state", "due", "surah", "rank", "introduced"]) cards.createIndex(i, i);
        const reviews = db.createObjectStore("reviews", { keyPath: "id", autoIncrement: true });
        for (const i of ["day", "key"]) reviews.createIndex(i, i);
        db.createObjectStore("programs", { keyPath: "id" }).createIndex("seq", "seq");
        db.createObjectStore("settings", { keyPath: "id" });
        db.createObjectStore("surahs", { keyPath: "number" });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(["cards", "reviews", "programs"], "readwrite");
        const card = (ayah, state, interval) => ({
          key: `112:${ayah}`, surah: 112, ayah, rank: 1000 + ayah, state, ease: 2.6, interval, reps: interval ? 1 : 0, lapses: 0,
          due: interval ? "2030-01-02" : null, lastReview: interval ? "2030-01-01" : null, lastGrade: interval ? "good" : null,
          introduced: interval ? "2030-01-01" : null,
        });
        tx.objectStore("cards").put(card(1, "learning", 1));
        tx.objectStore("cards").put(card(2, "new", 0));
        tx.objectStore("programs").put({ id: "legacy-1", surah: 112, from: 1, to: 2, seq: 1, createdAt: "2030-01-01T08:00:00.000Z" });
        tx.objectStore("reviews").put({ key: "112:1", day: "2030-01-01", grade: "good", at: "2030-01-01T08:00:00.000Z" });
        tx.oncomplete = () => (db.close(), resolve(true));
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    }),
);
await c.page.goto(`${BASE}/connexion`);
await login(c.page, "claire@test.fr");
await c.page.getByRole("dialog", { name: "Rattacher votre progression ?" }).waitFor({ timeout: 25_000 });
check(await c.page.getByText(/2 versets suivis dans 1 programme/).isVisible(), "reprise proposée avec le nombre de versets de l'appareil");
await c.shot("reprise");
await c.page.getByRole("button", { name: "Rattacher à mon compte" }).click();
await c.page.getByRole("dialog").waitFor({ state: "detached" });
await until(() => fake.rowsOf("claire@test.fr", "hifz_cards").length === 2, "progression de l'appareil envoyée au compte");
check(fake.rowsOf("claire@test.fr", "hifz_programs").length === 1 && fake.rowsOf("claire@test.fr", "hifz_reviews").length === 1, "programme et historique rattachés au compte");
await c.page.getByRole("link", { name: "Suivi" }).click();
await c.page.getByText("sur 2 suivis").waitFor();
check(true, "la progression de l'appareil est visible dans le compte");

// 9. Sans reprise : un compte déjà rempli ne reçoit pas de proposition
const d = await newDevice("D");
await d.page.goto(`${BASE}/connexion`);
await login(d.page, "claire@test.fr");
await d.page.getByText("Session du jour").waitFor();
await new Promise((r) => setTimeout(r, 2500));
check((await d.page.getByRole("dialog").count()) === 0, "un compte déjà rempli n'écrase rien (pas de proposition)");

await browser.close();

if (errors.length) {
  console.error(`✗ Erreurs dans la page :\n${errors.join("\n")}`);
  process.exit(1);
}
console.log(`✓ Parcours des comptes réussi (captures dans ${OUT}).`);
