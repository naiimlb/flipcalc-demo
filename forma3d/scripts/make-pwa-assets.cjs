// Génère les icônes et écrans de lancement de l'application installable (PWA).
// Usage : node scripts/make-pwa-assets.cjs   (nécessite Playwright + Chromium ; les PNG sont versionnés dans public/)
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("playwright");

const root = join(__dirname, "..", "public");
mkdirSync(join(root, "icons"), { recursive: true });
mkdirSync(join(root, "splash"), { recursive: true });

const FROM = "#5b6ee1";
const TO = "#7b5ce6";
// Même hexagone que public/icon.svg, en blanc sur le dégradé de la marque.
const logo = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <path d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25Z" fill="#fff"/>
  <path d="M16 2.5 28 9.25 16 16 4 9.25Z" fill="#fff" fill-opacity=".55"/>
  <path d="M16 16v13.5L4 22.75V9.25Z" fill="#5b6ee1" fill-opacity=".22"/>
</svg>`;

// Les écrans de lancement sont en aplat (un dégradé pèserait des Mo en PNG pour ces grandes tailles).
const page = (w, h, body, flat = false) => `<!doctype html><html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;
  background:${flat ? "#6263e3" : `linear-gradient(135deg,${FROM},${TO})`};display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#fff">${body}</body></html>`;

const icons = [
  { file: "icons/icon-192.png", size: 192, scale: 0.62 },
  { file: "icons/icon-512.png", size: 512, scale: 0.62 },
  // « maskable » : le logo reste dans la zone sûre (≈ 55 % du carré), le système rogne le reste.
  { file: "icons/icon-maskable-512.png", size: 512, scale: 0.5 },
  { file: "icons/apple-touch-icon.png", size: 180, scale: 0.62 },
];

// [largeur px, hauteur px, ratio] — les écrans de lancement iOS doivent avoir la taille exacte de l'appareil.
const iphones = [
  [1290, 2796, 3], [1179, 2556, 3], [1284, 2778, 3], [1170, 2532, 3], [1125, 2436, 3], [828, 1792, 2], [750, 1334, 2],
];
const ipads = [
  [2048, 2732, 2], [1668, 2388, 2], [1640, 2360, 2], [1668, 2224, 2], [1536, 2048, 2], [1488, 2266, 2], [1620, 2160, 2],
];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  for (const { file, size, scale } of icons) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(page(size, size, logo(Math.round(size * scale))));
    await p.screenshot({ path: join(root, file) });
  }
  const splash = async (w, h) => {
    await p.setViewportSize({ width: w, height: h });
    const unit = Math.min(w, h);
    await p.setContent(
      page(w, h, `${logo(Math.round(unit * 0.22))}<div style="margin-top:${Math.round(unit * 0.04)}px;font-size:${Math.round(unit * 0.06)}px;font-weight:800;letter-spacing:-.02em">Forma3D</div>`, true),
    );
    await p.screenshot({ path: join(root, "splash", `${w}x${h}.png`) });
  };
  for (const [w, h] of iphones) await splash(w, h);
  for (const [w, h] of ipads) {
    await splash(w, h);
    await splash(h, w); // paysage
  }
  await browser.close();
})();
