import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Parcours de bout en bout contre le déploiement.
 * Compte de test fourni par E2E_EMAIL / E2E_PASSWORD (jamais écrit dans les journaux).
 */
const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const SHOTS = process.env.E2E_SCREENSHOTS ?? "screenshots";
mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700); // fin des animations
  const project = test.info().project.name;
  const scheme = await page.evaluate(() =>
    matchMedia("(prefers-color-scheme: dark)").matches ? "sombre" : "clair",
  );
  await page.screenshot({ path: `${SHOTS}/${project}-${name}-${scheme}.png` });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Touche pour écouter" })).toBeVisible({ timeout: 20_000 });
}

/** Onglet de la barre du bas (évite les liens homonymes de l'accueil). */
const tab = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Navigation principale" }).getByRole("link", { name, exact: true });

test.describe.configure({ mode: "serial" });

test("sans session, toute page redirige vers /login", async ({ page }) => {
  for (const path of ["/", "/historique", "/compte"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  await expect(page.getByRole("heading", { name: "Grat'Coran" })).toBeVisible();
  await expect(page.getByAltText("Logo Grat'Coran")).toBeVisible();
  await shot(page, "01-connexion");
});

test("API protégée : 401 sans session", async ({ request }) => {
  const res = await request.post("/api/recognize", { multipart: { audio: { name: "a.webm", mimeType: "audio/webm", buffer: Buffer.alloc(2048) } } });
  expect(res.status()).toBe(401);
  expect((await res.json()).error).toContain("reconnecte-toi");
});

test("PWA iOS : manifest, icônes et balises", async ({ page, request }) => {
  await page.goto("/login");
  const head = page.locator("head");
  await expect(head.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(head.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveCount(1);
  await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
  await expect(head.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(head.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);

  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}:${i.purpose ?? "any"}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192:any", "512x512:any", "192x192:maskable", "512x512:maskable"]));
  for (const src of ["/apple-touch-icon.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/favicon-32.png", "/logo.svg"]) {
    const r = await request.get(src);
    expect(r.status(), src).toBe(200);
  }

  // Champs ≥ 16 px : pas de zoom automatique sur iOS.
  const size = await page.getByLabel("Email").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
});

test("erreurs d'authentification en français", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Mot de passe", { exact: true }).fill("mauvais-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("Email ou mot de passe incorrect.");

  await page.getByRole("tab", { name: "Inscription" }).click();
  await page.getByLabel("Email").fill("quelquun@example.com");
  await page.getByLabel(/Mot de passe/).fill("court");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("Le mot de passe doit contenir au moins 8 caractères.");

  await page.getByRole("tab", { name: "Connexion" }).click();
  await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
  await expect(page.getByRole("heading", { name: "Mot de passe oublié" })).toBeVisible();
});

test("connexion, session persistante, onglets, historique, déconnexion", async ({ page, browser }, info) => {
  await login(page);
  await shot(page, "02-accueil");
  await page.emulateMedia({ colorScheme: "dark" });
  await shot(page, "02-accueil");
  await page.emulateMedia({ colorScheme: "light" });

  // Cookies de session posés par le serveur pour ~400 jours.
  const cookies = (await page.context().cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(cookies.length).toBeGreaterThan(0);
  const days = (Math.min(...cookies.map((c) => c.expires)) * 1000 - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(300);

  // « Fermeture puis réouverture » : nouveau contexte avec le même stockage.
  const state = await page.context().storageState();
  const reopened = await browser.newContext({ ...info.project.use, storageState: state });
  const page2 = await reopened.newPage();
  await page2.goto("/");
  await expect(page2).toHaveURL(/\/$/);
  await expect(page2.getByRole("heading", { name: "Touche pour écouter" })).toBeVisible();
  await reopened.close();

  // Historique (une entrée Ayat al-Kursi préparée pour le compte de test).
  await tab(page, "Historique").click();
  await expect(page).toHaveURL(/\/historique$/);
  const row = page.getByRole("button", { name: /Al-Baqarah/ }).first();
  await expect(row.or(page.getByText("Aucune reconnaissance"))).toBeVisible({ timeout: 15_000 });
  if (await row.isVisible()) {
    await expect(page.getByText("Aujourd'hui")).toBeVisible();
    await shot(page, "03-historique");
    await row.click();
    const dialog = page.getByRole("dialog", { name: "Détail de la reconnaissance" });
    await expect(dialog.getByText("Verset 255").first()).toBeVisible();
    await expect(dialog.locator('blockquote[lang="ar"]')).toContainText("ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ");
    await shot(page, "04-detail");
    const deleted = page.waitForResponse(
      (r) => r.request().method() === "POST" && r.url().includes("/historique"),
    );
    await dialog.getByRole("button", { name: "Supprimer de l'historique" }).click();
    await expect(page.getByText("Aucune reconnaissance")).toBeVisible();
    expect((await deleted).ok()).toBe(true);
    await page.reload();
    await expect(page.getByText("Aucune reconnaissance")).toBeVisible();
  } else {
    await expect(page.getByText("Aucune reconnaissance")).toBeVisible();
  }
  await shot(page, "05-historique-vide");

  await tab(page, "Compte").click();
  await expect(page.getByText(EMAIL)).toBeVisible();
  await shot(page, "06-compte");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
  // Nouvel onglet, mêmes cookies : la session est bien fermée.
  // (WebKit Linux de Playwright plante en renaviguant dans le même onglet ici.)
  const after = await page.context().newPage();
  await after.goto("/historique");
  await expect(after).toHaveURL(/\/login$/);
  await after.close();
});

test("Tajweed : avertissement au premier accès, puis plus jamais", async ({ page }, info) => {
  await login(page);
  await tab(page, "Tajweed").click();
  const gate = page.getByRole("heading", { name: "Avant de commencer" });
  if (info.project.name === "webkit-iphone") {
    // Premier projet exécuté : le compte de test n'a jamais accepté l'avertissement.
    await expect(gate).toBeVisible();
    await expect(page.getByText("rien ne remplace un enseignant qualifié", { exact: false })).toBeVisible();
    const cont = page.getByRole("button", { name: "Continuer" });
    await expect(cont).toBeDisabled();
    await shot(page, "09-avertissement");
    await page.getByLabel("J'ai compris").check();
    await expect(cont).toBeEnabled();
    await cont.click();
  }
  await expect(page.getByRole("heading", { name: "Tajweed", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Outil d'entraînement indicatif")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tajweed", exact: true })).toBeVisible();
  await expect(gate).toHaveCount(0);
  await shot(page, "10-tajweed");

  // Le bandeau rouvre le même texte.
  await page.getByText("Outil d'entraînement indicatif").click();
  await expect(page.getByRole("dialog", { name: "Avertissement Tajweed" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Recherche d'une sourate puis préparation du passage.
  await page.getByLabel("Rechercher une sourate").fill("ikhlas");
  await page.getByRole("option", { name: /Al-Ikhlas/ }).click();
  await page.getByRole("button", { name: "Commencer" }).click();
  await expect(page).toHaveURL(/\/tajweed\/pratique\?s=112&from=1&to=3/);
  await expect(page.getByRole("heading", { name: "Règles de tajweed dans ce passage" })).toBeVisible();
  await page.getByRole("button", { name: /Qalqala/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Mini-leçon de tajweed" })).toContainText("rebond");
  await shot(page, "11-lecon");
  await page.keyboard.press("Escape");
  await shot(page, "12-prepare");

  // Lien depuis le Compte.
  await tab(page, "Compte").click();
  await page.getByRole("link", { name: "Relire l'avertissement Tajweed" }).click();
  await expect(page.getByRole("heading", { name: "Avant de commencer" })).toBeVisible();
});

test("Tajweed : parcours dédié, progression et suppression", async ({ page }) => {
  await login(page);
  await page.goto("/tajweed/parcours");
  await expect(page.getByRole("heading", { name: "Mon parcours" })).toBeVisible();
  const card = page.getByRole("link", { name: /Al-Fatihah/ }).first();
  await expect(card.or(page.getByText("Aucun essai pour l'instant"))).toBeVisible({ timeout: 15_000 });
  if (!(await card.isVisible())) return;
  await expect(page.getByText("Tes points faibles")).toBeVisible();
  await expect(page.getByRole("img", { name: /Évolution du score/ }).first()).toBeVisible();
  await shot(page, "13-parcours");
  await card.click();
  await expect(page.getByRole("link", { name: "Retravailler ce passage" })).toBeVisible();
  await expect(page.getByText("Erreurs corrigées")).toBeVisible();
  await shot(page, "14-detail-passage");
  await page.getByRole("button", { name: "Supprimer l'essai 1" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirmer la suppression" });
  await expect(dialog.getByText("Supprimer cet essai ?")).toBeVisible();
  await dialog.getByRole("button", { name: "Supprimer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Supprimer l'essai 1" })).toHaveCount(0, { timeout: 15_000 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Supprimer l'essai 1" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Supprimer l'essai 2" })).toBeVisible();
});

test("enregistrement : écoute, arrêt, analyse", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mic", "micro simulé disponible uniquement sous Chromium");
  await login(page);
  await page.getByRole("button", { name: "Lancer l'écoute" }).click();
  await expect(page.getByRole("heading", { name: "J'écoute…" })).toBeVisible();
  await shot(page, "07-ecoute");

  // Arrêt avant 3 s : différé jusqu'au minimum.
  await page.getByRole("button", { name: "Arrêter l'écoute" }).click();
  await expect(page.getByRole("heading", { name: "Encore un instant…" })).toBeVisible();

  const response = page.waitForResponse((r) => r.url().endsWith("/api/recognize"), { timeout: 40_000 });
  const res = await response;
  const body = await res.json();
  console.log(`/api/recognize → ${res.status()} ${body.code ?? body.recognition?.confidence ?? ""}`);
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Réessayer|Nouvelle écoute|OK/ })).toBeVisible();
  await shot(page, "08-resultat");
  // Le bip du micro simulé n'est pas une récitation : jamais de confiance haute.
  if (res.ok()) expect(body.recognition.confidence).toBe("low");
  else expect(body.error).toBeTruthy();
});

test("Tajweed : enregistrement et analyse d'un passage", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-mic", "micro simulé disponible uniquement sous Chromium");
  await login(page);
  await page.goto("/tajweed/pratique?s=112&from=1&to=3");
  await page.getByRole("button", { name: "Lancer l'écoute" }).click();
  await expect(page.getByText("Récite le passage, puis touche pour arrêter.")).toBeVisible();
  await page.waitForTimeout(3500);
  const response = page.waitForResponse((r) => r.url().endsWith("/api/tajweed"), { timeout: 45_000 });
  await page.getByRole("button", { name: "Arrêter l'écoute" }).click();
  const res = await response;
  const body = await res.json();
  console.log(`/api/tajweed → ${res.status()} ${body.analysis?.status ?? body.code ?? ""}`);
  expect(res.status()).toBe(200);
  // Un bip de micro simulé n'est pas une récitation : jamais de note, essai non compté.
  expect(["unclear", "mismatch"]).toContain(body.analysis.status);
  expect(body.saved).toBe(false);
  await expect(page.getByRole("heading", { name: /Je n'ai pas bien entendu|Ce n'est pas le bon passage/ })).toBeVisible();
  await shot(page, "15-tajweed-incompris");
});
