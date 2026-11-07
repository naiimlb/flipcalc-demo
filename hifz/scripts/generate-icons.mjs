#!/usr/bin/env node
// Génère l'icône SVG et les PNG de la PWA (outil de développement, Playwright + Chromium).
//   node scripts/generate-icons.mjs
// Motif : rosace à huit branches (deux carrés croisés), crème sur vert profond.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const GREEN = "#166552";
const CREAM = "#faf8f3";

/** @param {{ rounded: boolean }} o */
function svg({ rounded }) {
  const bg = rounded
    ? `<rect width="512" height="512" rx="116" fill="${GREEN}"/>`
    : `<rect width="512" height="512" fill="${GREEN}"/>`;
  const square = `x="126" y="126" width="260" height="260" rx="10"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${bg}
  <g fill="${CREAM}">
    <rect ${square}/>
    <rect ${square} transform="rotate(45 256 256)"/>
  </g>
  <circle cx="256" cy="256" r="86" fill="${GREEN}"/>
  <circle cx="256" cy="256" r="58" fill="none" stroke="${CREAM}" stroke-width="14"/>
</svg>
`;
}

const targets = [
  { out: "public/icons/icon-192.png", size: 192, rounded: true },
  { out: "public/icons/icon-512.png", size: 512, rounded: true },
  // Maskable : fond plein, motif dans la zone de sécurité (cercle de 80 %).
  { out: "public/icons/maskable-512.png", size: 512, rounded: false },
  // iOS arrondit lui-même : icône carrée pleine, sans transparence.
  { out: "public/icons/apple-touch-icon.png", size: 180, rounded: false },
  { out: "public/icons/favicon-32.png", size: 32, rounded: true },
];

await mkdir(join(root, "public", "icons"), { recursive: true });
await writeFile(join(root, "public", "icons", "icon.svg"), svg({ rounded: true }));

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { out, size, rounded } of targets) {
  await page.setViewportSize({ width: size, height: size });
  const markup = svg({ rounded }).replace('width="512" height="512">', `width="${size}" height="${size}">`);
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await writeFile(join(root, out), await page.locator("svg").screenshot({ omitBackground: true }));
  console.log(`${out} (${size}×${size})`);
}
await browser.close();
