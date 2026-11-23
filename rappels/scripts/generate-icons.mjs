#!/usr/bin/env node
// Génère l'icône SVG et les PNG de la PWA (placeholder « #HB » rose, remplaçable par le vrai logo).
//   node scripts/generate-icons.mjs   (nécessite Playwright + Chromium, outil de dev uniquement)
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = createRequire(import.meta.url)("playwright");
const PINK = "#ff1f6e";

function svg({ rounded, scale }) {
  const bg = rounded ? `<rect width="512" height="512" rx="116" fill="${PINK}"/>` : `<rect width="512" height="512" fill="${PINK}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${bg}
  <text x="256" y="256" text-anchor="middle" dominant-baseline="central" fill="#fff"
    font-family="Poppins, 'Arial Black', Impact, sans-serif" font-weight="900" font-size="${200 * scale}" letter-spacing="-8">#HB</text>
</svg>`;
}

const targets = [
  { out: "icons/icon-192.png", size: 192, rounded: true, scale: 1 },
  { out: "icons/icon-512.png", size: 512, rounded: true, scale: 1 },
  // Maskable : fond plein, texte dans la zone de sécurité.
  { out: "icons/maskable-512.png", size: 512, rounded: false, scale: 0.8 },
  // iOS arrondit lui-même : carré plein.
  { out: "icons/apple-touch-icon.png", size: 180, rounded: false, scale: 0.9 },
  { out: "icons/favicon-32.png", size: 32, rounded: true, scale: 1 },
];

await mkdir(join(root, "public", "icons"), { recursive: true });
await writeFile(join(root, "public", "icons", "icon.svg"), svg({ rounded: true, scale: 1 }));

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { out, size, rounded, scale } of targets) {
  await page.setViewportSize({ width: size, height: size });
  const markup = svg({ rounded, scale }).replace('width="512" height="512">', `width="${size}" height="${size}">`);
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await writeFile(join(root, "public", out), await page.locator("svg").screenshot({ omitBackground: true }));
  console.log(`public/${out} (${size}×${size})`);
}
await browser.close();
