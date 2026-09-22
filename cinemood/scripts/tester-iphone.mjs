/* =====================================================================
   tester-iphone.mjs — Parcours complet en conditions iPhone.
   ---------------------------------------------------------------------
   Pilote un vrai navigateur (Chromium, via le protocole CDP et le
   WebSocket natif de Node) sur la version statique de l'app, en
   390 × 844 à densité 3 — les dimensions d'un iPhone 14/15/16 — avec
   émulation tactile et user-agent Safari iOS.

   Il déroule le parcours entier : vitrine, choix des plateformes, les
   dix écrans du test, l'accueil, un changement d'humeur, le mode
   famille, la bande-annonce, Découvrir, Ma liste et Profil. À chaque
   étape il capture l'écran et vérifie l'absence de défilement
   horizontal ; à la fin il contrôle les polices des champs, les cibles
   tactiles et les erreurs JavaScript.

   Prérequis : un Chromium dans CHEMIN_CHROMIUM (ou la variable
   d'environnement CHROMIUM). Aucune dépendance npm.

   Lancer :  npm run tester:iphone
   ===================================================================== */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '..', '..', 'cinemood-demo');
const SORTIE = resolve(ICI, '..', '..', '.captures-iphone');
const PORT = Number(process.env.PORT_TEST ?? 8137);
const CHEMIN_CHROMIUM = process.env.CHROMIUM
  ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml' };

await mkdir(SORTIE, { recursive: true });

const serveur = createServer(async (req, res) => {
  try {
    let chemin = decodeURIComponent(req.url.split('?')[0]);
    if (chemin === '/') chemin = '/index.html';
    const corps = await readFile(join(RACINE, chemin));
    res.writeHead(200, { 'content-type': TYPES[extname(chemin)] ?? 'application/octet-stream' });
    res.end(corps);
  } catch { res.writeHead(404).end('introuvable'); }
});
await new Promise((r) => serveur.listen(PORT, '127.0.0.1', r));

const navigateur = spawn(CHEMIN_CHROMIUM, [
  '--headless=new', '--remote-debugging-port=9222', '--no-sandbox', '--disable-gpu',
  '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb',
  `--user-data-dir=/tmp/profil-chromium-${Date.now()}`, 'about:blank',
], { stdio: 'ignore' });

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let cible = null;
for (let i = 0; i < 40 && !cible; i += 1) {
  await attendre(250);
  try {
    const liste = await (await fetch('http://127.0.0.1:9222/json/list')).json();
    cible = liste.find((t) => t.type === 'page');
  } catch { /* le navigateur n'écoute pas encore */ }
}
if (!cible) {
  console.error(`\n  ✗ Chromium n'a pas répondu (${CHEMIN_CHROMIUM}).`);
  console.error('    Indique son chemin avec la variable CHROMIUM.\n');
  process.exit(1);
}

const ws = new WebSocket(cible.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });

let idSuivant = 0;
const attentes = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && attentes.has(msg.id)) { attentes.get(msg.id)(msg); attentes.delete(msg.id); }
};
function cdp(method, params = {}) {
  const id = ++idSuivant;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((r) => attentes.set(id, r));
}

await cdp('Page.enable');
await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
  screenOrientation: { type: 'portraitPrimary', angle: 0 },
});
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await cdp('Emulation.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});

const erreurs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    erreurs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    erreurs.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description ?? ''));
  }
});

async function evaluer(expression) {
  const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
}

async function capturer(nom) {
  await attendre(450);
  const { result } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(SORTIE, `${nom}.png`), Buffer.from(result.data, 'base64'));
  const debord = await evaluer('document.documentElement.scrollWidth > window.innerWidth + 1');
  console.log(`  ✓ ${nom.padEnd(22)} débordement horizontal : ${debord ? 'OUI ⚠' : 'non'}`);
  return debord;
}

async function cliquer(selecteur) {
  const ok = await evaluer(`(() => { const el = document.querySelector(${JSON.stringify(selecteur)});
    if (!el) return false; el.click(); return true; })()`);
  if (!ok) throw new Error(`élément introuvable : ${selecteur}`);
  await attendre(400);
}

async function saisir(selecteur, valeur) {
  await evaluer(`(() => { const el = document.querySelector(${JSON.stringify(selecteur)});
    el.value = ${JSON.stringify(valeur)};
    el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await attendre(250);
}

/* --------------------------- LE PARCOURS --------------------------- */
console.log('\n  Parcours iPhone 390 × 844 (DPR 3)\n');
let debordements = 0;

// On repart d'un appareil vierge : le parcours doit être celui d'une
// première visite, pas celui d'un profil déjà installé.
await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await attendre(900);
await evaluer('localStorage.clear()');
await cdp('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await attendre(1600);
debordements += await capturer('01-vitrine');

await cliquer('#commencer');
debordements += await capturer('02-plateformes');

// Sélection de trois plateformes, puis on continue.
for (const id of ['netflix', 'max', 'arte']) await cliquer(`[data-plateforme="${id}"]`);
debordements += await capturer('03-plateformes-choisies');
await cliquer('#continuer');

// Test de personnalité, dix écrans.
await saisir('#pseudo', 'Naïm');
debordements += await capturer('04-test-01-prenom');
await cliquer('#suivant');
await cliquer('[data-annee="1990"]');
debordements += await capturer('05-test-02-naissance');
await cliquer('#suivant');
await cliquer('#suivant');                       // genre : facultatif, on passe
await cliquer('[data-types="film,serie"]');
await cliquer('#suivant');
for (const g of ['Science-Fiction', 'Thriller']) await cliquer(`[data-adore="${g}"]`);
await cliquer('[data-evite="Horreur"]');
debordements += await capturer('06-test-05-genres');
await cliquer('#suivant');
const ids = await evaluer(`[...document.querySelectorAll('[data-titre]')].slice(0,5).map(b=>b.dataset.titre)`);
for (const id of ids) await cliquer(`[data-titre="${id}"]`);
debordements += await capturer('07-test-06-favoris');
await cliquer('#suivant');
debordements += await capturer('08-test-07-enfance');
await cliquer('#suivant');
await cliquer('[data-tonalite="intense"]');
await cliquer('#suivant');
await cliquer('[data-duree="150"]');
debordements += await capturer('09-test-09-reglages');
await cliquer('#suivant');
await cliquer('#suivant');                       // dernière question, facultative
debordements += await capturer('10-profil-cinema');

await cliquer('#go');
await attendre(900);
debordements += await capturer('11-accueil');

await cliquer('[data-humeur="adrenaline"]');
await attendre(700);
debordements += await capturer('12-accueil-adrenaline');

await cliquer('[data-compagnie="famille"]');
await attendre(700);
debordements += await capturer('13-accueil-famille');

// Bande-annonce : un seul appui.
await cliquer('[data-bande-annonce]');
debordements += await capturer('14-bande-annonce');
await cliquer('#fermer-lecteur');

// Ajout à la liste, puis les autres onglets.
await cliquer('[data-signal="ajout_liste"]');
await attendre(600);
await cliquer('[data-route="/decouvrir"]');
await attendre(700);
debordements += await capturer('15-decouvrir');
await saisir('#recherche', 'nolan');
await attendre(500);
debordements += await capturer('16-decouvrir-recherche');

await cliquer('[data-route="/ma-liste"]');
await attendre(500);
debordements += await capturer('17-ma-liste');

await cliquer('[data-route="/profil"]');
await attendre(500);
debordements += await capturer('18-profil');

/* --------------------------- CONTRÔLES ----------------------------- */
console.log('\n  Contrôles automatiques dans le navigateur :\n');

const audit = await evaluer(`(() => {
  const r = {};
  // Polices des champs : sous 16 px, Safari zoome.
  r.champsTropPetits = [...document.querySelectorAll('input,textarea,select')]
    .filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).length;
  // Cibles tactiles sous 44 px.
  r.ciblesTropPetites = [...document.querySelectorAll('button, a[href]')]
    .filter(el => { const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.height < 43.5; }).length;
  // Éléments qui dépassent à droite.
  r.debordements = [...document.querySelectorAll('*')]
    .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1).length;
  r.largeurDocument = document.documentElement.scrollWidth;
  r.largeurFenetre = window.innerWidth;
  return r;
})()`);

console.log(`    Champs sous 16 px             : ${audit.champsTropPetits}`);
console.log(`    Cibles tactiles sous 44 px    : ${audit.ciblesTropPetites}`);
console.log(`    Éléments débordant à droite   : ${audit.debordements}`);
console.log(`    Largeur document / fenêtre    : ${audit.largeurDocument} / ${audit.largeurFenetre} px`);
console.log(`    Écrans avec scroll horizontal : ${debordements}`);
console.log(`    Erreurs JavaScript            : ${erreurs.length}`);
for (const e of erreurs.slice(0, 8)) console.log(`      ⚠ ${e.slice(0, 160)}`);

const echecs = audit.champsTropPetits + audit.ciblesTropPetites + audit.debordements
  + debordements + erreurs.length;
console.log(`\n  ${echecs === 0 ? '✅ Parcours iPhone complet sans défaut détecté' : `❌ ${echecs} défaut(s)`}`);
console.log(`  Captures : ${SORTIE}\n`);

ws.close();
navigateur.kill();
serveur.close();
process.exit(echecs === 0 ? 0 : 1);
