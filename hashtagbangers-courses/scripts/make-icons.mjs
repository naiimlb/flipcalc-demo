// Génère les icônes PWA / iOS et les écrans de démarrage dans public/ (variante COURSES du logo).
// Usage : node scripts/make-icons.mjs   (Playwright + Chromium requis)
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const wordmark = readFileSync(join(root, 'src/assets/hashtag-wordmark.svg'), 'utf8');
const font = (pkg, file) =>
  `data:font/woff2;base64,${readFileSync(join(root, 'node_modules', pkg, 'files', file)).toString('base64')}`;
const ANTON = font('@fontsource/anton', 'anton-latin-400-normal.woff2');
const MARKER = font('@fontsource/permanent-marker', 'permanent-marker-latin-400-normal.woff2');
const BRAND = '#ED1E79';

const CART = `<svg viewBox="0 0 64 56" style="width:var(--cart);transform:rotate(-8deg) translateY(1px);margin-left:.18em">
  <g fill="none" stroke="#0a0a0b" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 9.5c3.2-.8 6.4-1 9.6-.6l7 24.6c9.5.4 19.4-.3 29.2-1.6" stroke-width="5.2"/>
    <path d="M13.8 14.6c13.6-.9 27.6-1.4 43.4-.6-2.2 5.6-4.4 10.4-7 15.4" stroke-width="4.6"/>
    <path d="M22 22.2c8.8-.5 17.6-.6 26.8-.2" stroke-width="3.2" opacity=".9"/>
  </g><circle cx="25" cy="45" r="5" fill="#0a0a0b"/><circle cx="46.5" cy="44.2" r="5" fill="#0a0a0b"/></svg>`;

/** Logo COURSES de largeur w (px). */
const logo = (w) => `
  <div style="width:${w}px;display:flex;flex-direction:column;--cart:${w * 0.165}px">
    <div style="filter:drop-shadow(0 ${w * 0.008}px 0 rgba(120,0,50,.25))">${wordmark.replace('<svg ', '<svg style="display:block;width:100%;height:auto" ')}</div>
    <div style="display:flex;align-items:flex-end;justify-content:flex-end;margin-top:${-w * 0.052}px;padding-right:2%">
      <span style="font-family:Marker;font-size:${w * 0.16}px;line-height:1;color:#0a0a0b;transform:rotate(-4deg) translateY(${w * 0.008}px);letter-spacing:.02em">COURSES.</span>${CART}
    </div>
  </div>`;

const page = (w, h, logoW, opts = {}) => `<!doctype html><html><head><style>
  @font-face{font-family:Anton;src:url(${ANTON})}
  @font-face{font-family:Marker;src:url(${MARKER})}
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
  body{display:grid;place-items:center;background-color:${BRAND};
    background-image:radial-gradient(rgba(120,0,50,.2) ${opts.dot ?? w / 300}px, transparent ${(opts.dot ?? w / 300) * 1.4}px);
    background-size:${opts.grid ?? w / 44}px ${opts.grid ?? w / 44}px}
  .wrap{transform:translateY(${opts.dy ?? 0}px)}
</style></head><body><div class="wrap">${logo(logoW)}</div></body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const shot = async (html, w, h, out) => {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(async () => {
    await document.fonts.load('40px Marker');
    await document.fonts.ready;
  });
  await p.waitForTimeout(50);
  mkdirSync(dirname(out), { recursive: true });
  await p.screenshot({ path: out, omitBackground: false });
  await p.close();
  console.log('✓', out.replace(root + '/', ''));
};

// Icônes : le logo occupe ~80 % (iOS arrondit les coins, rien d'important n'est rogné).
for (const s of [180, 192, 512]) {
  const out = s === 180 ? join(pub, 'apple-touch-icon.png') : join(pub, 'icons', `icon-${s}.png`);
  await shot(page(s, s, s * 0.84, { dy: -s * 0.015 }), s, s, out);
}
await shot(page(180, 180, 151, { dy: -2.7 }), 180, 180, join(pub, 'icons', 'icon-180.png'));
// Maskable : zone de sécurité (cercle de 80 %) → logo réduit.
await shot(page(512, 512, 300, { dy: -8 }), 512, 512, join(pub, 'icons', 'icon-maskable-512.png'));
await shot(page(32, 32, 30, { dot: 0.4, grid: 4 }), 32, 32, join(pub, 'favicon-32.png'));

// Écrans de démarrage iOS (portrait).
for (const [w, h] of [
  [1320, 2868], [1290, 2796], [1206, 2622], [1179, 2556], [1284, 2778],
  [1170, 2532], [1125, 2436], [828, 1792], [750, 1334],
]) {
  await shot(page(w, h, w * 0.62, { dot: w / 330, grid: w / 56 }), w, h, join(pub, 'splash', `splash-${w}x${h}.png`));
}
await browser.close();

// Favicon vectoriel : carré rose arrondi + « # » et caddie.
writeFileSync(
  join(pub, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${BRAND}"/>
<g transform="translate(6 10) scale(.82)" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
<path d="M3 9.5c3.2-.8 6.4-1 9.6-.6l7 24.6c9.5.4 19.4-.3 29.2-1.6" stroke-width="6"/>
<path d="M13.8 14.6c13.6-.9 27.6-1.4 43.4-.6-2.2 5.6-4.4 10.4-7 15.4" stroke-width="5.4"/></g>
<circle cx="26.5" cy="47" r="4.6" fill="#0a0a0b"/><circle cx="44" cy="46.3" r="4.6" fill="#0a0a0b"/></svg>
`,
);
console.log('✓ public/favicon.svg');
