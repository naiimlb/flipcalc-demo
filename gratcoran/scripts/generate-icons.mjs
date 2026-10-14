// Génère les PNG de l'app à partir des SVG du logo (outil de développement).
// Prérequis : Playwright + Chromium. Usage : python3 scripts/logo.py … puis `npm run icons`.
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");

const targets = [
  // Logo arrondi (transparent autour) : favicon et écran de connexion.
  { svg: "public/logo.svg", out: "public/favicon-32.png", size: 32 },
  { svg: "public/logo.svg", out: "public/icons/icon-192.png", size: 192 },
  { svg: "public/logo.svg", out: "public/icons/icon-512.png", size: 512 },
  // iOS arrondit lui-même : icône carrée pleine, sans transparence.
  { svg: "scripts/icon-square.svg", out: "public/apple-touch-icon.png", size: 180 },
  // Maskable : motif dans la zone de sécurité (80 %), fond plein.
  { svg: "scripts/icon-maskable.svg", out: "public/icons/maskable-192.png", size: 192 },
  { svg: "scripts/icon-maskable.svg", out: "public/icons/maskable-512.png", size: 512 },
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
for (const { svg, out, size } of targets) {
  const markup = await readFile(join(root, svg), "utf8");
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${markup.replace(
      /width="512" height="512"/,
      `width="${size}" height="${size}"`,
    )}</body></html>`,
  );
  const png = await page.locator("svg").screenshot({ omitBackground: true });
  await writeFile(join(root, out), png);
  console.log(`${out} (${size}×${size})`);
}
await browser.close();
