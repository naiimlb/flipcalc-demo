// Parcours complet de l'app au format iPhone (390 × 844) avec captures d'écran.
// Usage : npm run build && npx vite preview --port 4173 &  puis  node scripts/check-iphone.mjs [url] [dossier]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const url = process.argv[2] ?? 'http://localhost:4173/';
const outDir = process.argv[3] ?? 'captures';
const scale = Number(process.env.SCALE ?? 1);
mkdirSync(outDir, { recursive: true });

// Encoches simulées (iPhone 14/15 : 47 px en haut, 34 px pour la barre d'accueil).
const SAFE = ':root{--safe-top:47px!important;--safe-bottom:34px!important;--tabbar-h:calc(64px + 34px)!important}';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: scale,
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  colorScheme: 'light',
  permissions: ['clipboard-read', 'clipboard-write'],
});
let page = await ctx.newPage();
const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
};
watch(page);

/** Contenu brut d'IndexedDB (vérifie que la sauvegarde est bien là, pas seulement à l'écran). */
const readIdb = () =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open('hb-courses');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['lists', 'meta']);
          const lists = tx.objectStore('lists').getAll();
          const meta = tx.objectStore('meta').get('state');
          const settings = tx.objectStore('meta').get('settings');
          tx.oncomplete = () => {
            db.close();
            resolve({ lists: lists.result, meta: meta.result, settings: settings.result });
          };
        };
      }),
  );

let n = 0;
const shot = async (name) => {
  const file = join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('📸', file);
};
const checks = [];
const check = (label, ok) => {
  checks.push({ label, ok });
  console.log(ok ? '✅' : '❌', label);
};
const noHorizontalScroll = async (where) => {
  const w = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.querySelector('main')?.scrollWidth ?? 0));
  check(`pas de défilement horizontal (${where}) : ${w}px`, w <= 390);
};
const tap = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  await locator.tap();
};

await page.goto(url);
await page.addStyleTag({ content: SAFE });
await page.waitForTimeout(250);
await shot('splash');
await page.waitForTimeout(1200);
await shot('accueil-vide');
await noHorizontalScroll('accueil');

// Import
await tap(page.getByRole('button', { name: /Coller ma liste/ }));
await page.waitForTimeout(450);
await tap(page.getByRole('button', { name: /liste d'exemple/ }));
await page.waitForTimeout(300);
await shot('import-apercu');
const detected = await page.getByText(/10 articles détectés/).count();
check('import : 10 articles détectés', detected === 1);
await tap(page.getByRole('button', { name: /Créer la liste · 10 articles/ }));
await page.waitForTimeout(700);
await shot('courses-liste');
await noHorizontalScroll('courses');

// Ordre des catégories et classement
const sections = (await page.locator('section button[aria-expanded] > span.font-display').allInnerTexts()).filter((t) => !/^\d+\/\d+$/.test(t));
console.log('   catégories :', sections.join(' | '));
check('10 catégories distinctes affichées dans l’ordre du magasin', sections.length === 10 && sections[0].toUpperCase().includes('EMBALLAGES'));

const row = (name) => page.locator('[role=checkbox]', { hasText: name });

// Cocher = tout prendre
await tap(row('Huile de friture'));
await tap(row('Boîtes burger'));
await tap(row('Liquide vaisselle'));
await page.waitForTimeout(500);
check('Huile cochée (aria-checked=true)', (await row('Huile de friture').getAttribute('aria-checked')) === 'true');

// Prise partielle : 3 frites sur 8
for (let i = 0; i < 3; i++) await tap(row('Frites').getByRole('button', { name: /Prendre un/ }));
await page.waitForTimeout(300);
check('Frites en partiel (3/8)', (await row('Frites').getAttribute('aria-checked')) === 'mixed' && (await row('Frites').innerText()).includes('manque 5'));
// Coca : 4 sur 4 via stepper → complet
for (let i = 0; i < 4; i++) await tap(row('Coca-Cola').getByRole('button', { name: /Prendre un/ }));
await page.waitForTimeout(300);
check('Coca complet via le stepper', (await row('Coca-Cola').getAttribute('aria-checked')) === 'true');
await page.locator('main').evaluate((m) => m.scrollTo({ top: 0 }));
await page.waitForTimeout(300);
await shot('courses-coches');
await page.locator('main').evaluate((m) => m.scrollTo({ top: 520 }));
await page.waitForTimeout(400);
await shot('courses-defilement-barre-collee');

// Appui long → modifier / changer de catégorie
const poulet = row('Poulet pané');
await poulet.scrollIntoViewIfNeeded();
const box = await poulet.boundingBox();
await page.mouse.move(box.x + 60, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(650);
await page.mouse.up();
await page.waitForTimeout(450);
await shot('appui-long-modifier');
check('appui long ouvre « Modifier »', (await page.getByRole('heading', { name: 'Modifier' }).count()) === 1);
await tap(page.getByRole('button', { name: /Surgelés/ }).last());
await tap(page.getByRole('button', { name: 'Enregistrer' }));
await page.waitForTimeout(600);
const surgSection = page.locator('section', { hasText: 'Surgelés' });
check('Poulet pané déplacé dans Surgelés', (await surgSection.locator('[role=checkbox]', { hasText: 'Poulet pané' }).count()) === 1);

// Swipe gauche → suppression + annuler
const sauce = row('Sauce algérienne');
await sauce.scrollIntoViewIfNeeded();
const sb = await sauce.boundingBox();
await page.mouse.move(sb.x + sb.width - 30, sb.y + sb.height / 2);
await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(sb.x + sb.width - 30 - i * 22, sb.y + sb.height / 2, { steps: 2 });
await page.waitForTimeout(80);
await shot('swipe-supprimer');
await page.mouse.up();
await page.waitForTimeout(600);
check('swipe gauche supprime l’article', (await row('Sauce algérienne').count()) === 0);
await shot('toast-annuler');
await tap(page.getByRole('button', { name: 'Annuler' }));
await page.waitForTimeout(500);
check('« Annuler » restaure l’article', (await row('Sauce algérienne').count()) === 1);

// Ajout manuel (on remonte un peu : le bouton + réapparaît quand on remonte)
await page.locator('main').evaluate((m) => m.scrollBy({ top: -200 }));
await page.waitForTimeout(500);
await tap(page.getByRole('button', { name: 'Ajouter un article' }).first());
await page.waitForTimeout(450);
await page.getByLabel('Produit').fill('Nuggets 1kg');
await page.waitForTimeout(150);
await shot('ajout-manuel');
await tap(page.getByRole('button', { name: 'Ajouter', exact: true }));
await page.waitForTimeout(600);
check('article ajouté et rangé en Surgelés', (await surgSection.locator('[role=checkbox]', { hasText: 'Nuggets 1kg' }).count()) === 1);

// Terminer
await tap(page.getByRole('button', { name: /Terminer les courses/ }).first());
await page.waitForTimeout(500);
await shot('confirmer-fin');
await tap(page.getByRole('dialog').getByRole('button', { name: 'Terminer les courses' }));
await page.waitForTimeout(1200);
await shot('recap-manquants');
const recapText = await page.locator('.fixed.inset-0.z-40').innerText();
check('récap : Pris 5 / Manquants 7', /Pris\s+5/.test(recapText) && /Manquants\s+7/.test(recapText));
await page.evaluate(() => {
  navigator.share = undefined;
});
await tap(page.getByRole('button', { name: 'Copier' }));
await page.waitForTimeout(300);
const copied = await page.evaluate(() => navigator.clipboard.readText());
console.log('--- message copié ---\n' + copied + '\n---------------------');
const today = new Date();
const dd = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
check('message : titre « 🛒 Manquants Metro Lomme – JJ/MM »', copied.startsWith(`🛒 Manquants Metro Lomme – ${dd}`));
check('message : frites partielles → x5', copied.includes('• Frites 2,5kg x5'));
check('message : poulet pané (déplacé) dans Surgelés', /🧊 Surgelés\n(• .*\n)*• Poulet pané 5kg x3/.test(copied));
const recapH = await page.locator('.fixed.inset-0.z-40 .scroll-area').evaluate((el) => el.scrollHeight);
await page.locator('.fixed.inset-0.z-40 .scroll-area').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
await page.waitForTimeout(300);
await shot('recap-boutons');
console.log('   hauteur récap :', recapH);
await tap(page.getByRole('button', { name: /Nouvelle liste avec les manquants/ }));
await page.waitForTimeout(900);
await shot('nouvelle-liste-manquants');
check('nouvelle liste créée avec 7 articles', (await page.locator('[role=checkbox]').count()) === 7);

// Listes
await tap(page.getByRole('button', { name: 'Listes' }));
await page.waitForTimeout(500);
await shot('listes-en-cours');
await tap(page.getByRole('radio', { name: /Manquants/ }));
await page.waitForTimeout(400);
await shot('listes-manquants');
await tap(page.getByRole('radio', { name: /Terminées/ }));
await page.waitForTimeout(400);
await shot('listes-terminees');
await noHorizontalScroll('listes');
const card = await page.locator('main li', { hasText: /Terminée/ }).first().textContent();
check('liste terminée : magasin, statut, date et heure', /Metro Lomme/.test(card) && /Terminée/.test(card) && /\d{2}\/\d{2} · \d{2}:\d{2}/.test(card));
check('liste terminée : « ✅ 5 pris » et « ⚠️ 7 manquants »', card.includes('✅ 5 pris') && card.includes('⚠️ 7 manquants'));
await tap(page.getByRole('radio', { name: /En cours/ }));
await page.waitForTimeout(500);
const cardOngoing = await page.locator('main li', { hasText: /En cours/ }).first().textContent();
check('liste en cours : statut « En cours » et compteurs', /En cours/.test(cardOngoing) && /✅ 0 pris/.test(cardOngoing) && /⚠️ 7 manquants/.test(cardOngoing));

// Réglages
await tap(page.getByRole('button', { name: 'Réglages' }));
await page.waitForTimeout(500);
await shot('reglages');
await noHorizontalScroll('réglages');
check('réglages : « Poulet pané » dans Mes catégories mémorisées', (await page.getByRole('button', { name: 'Modifier Poulet pané' }).count()) === 1);
const saveStatus = await page.getByTestId('save-status').innerText();
check('réglages : sauvegarde automatique + stockage persistant affichés', /Enregistrement automatique actif/.test(saveStatus) && /Stockage persistant/.test(saveStatus));
await page.locator('main').evaluate((m) => m.scrollTo({ top: 1500 }));
await page.waitForTimeout(300);
await shot('reglages-sauvegarde');

// Mode sombre
await tap(page.getByRole('radio', { name: 'Sombre' }));
await tap(page.getByRole('button', { name: 'Courses', exact: true }));
await page.waitForTimeout(600);
await shot('sombre-courses');
await tap(page.getByRole('button', { name: 'Listes' }));
await page.waitForTimeout(500);
await shot('sombre-listes');

// Persistance : rechargement
await page.reload();
await page.addStyleTag({ content: SAFE });
await page.waitForTimeout(1500);
const idb3 = await readIdb();
check('IndexedDB : 3 listes enregistrées, rechargement sans perte', idb3.lists.length === 3 && idb3.meta?.schema === 2);
check('copie de secours localStorage présente', await page.evaluate(() => !!localStorage.getItem('hb-courses:v2')));

// ───── Mémoire des catégories (interface) ─────
await tap(page.getByRole('button', { name: 'Courses', exact: true }));
await page.waitForTimeout(500);
const longPress = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  await page.mouse.move(b.x + 60, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await page.waitForTimeout(450);
};
await longPress(row('Sauce algérienne'));
await shot('memoire-changer-categorie');
check('appui long : section « Changer de catégorie »', (await page.getByText('Changer de catégorie', { exact: true }).count()) === 1);
await tap(page.getByRole('button', { name: /Épicerie sèche/ }).last());
await tap(page.getByRole('button', { name: 'Enregistrer' }));
await page.waitForTimeout(350);
await shot('memoire-message');
check('message discret « Je m’en souviendrai pour la prochaine fois ✅ »', (await page.getByText('Je m’en souviendrai pour la prochaine fois ✅').count()) === 1);
check('« Sauce algérienne » rangée en Épicerie sèche', (await page.locator('section', { hasText: 'Épicerie sèche' }).locator('[role=checkbox]', { hasText: 'Sauce algérienne' }).count()) === 1);

// Nouvelle liste : autre graphie, autre format = même produit
await tap(page.getByRole('button', { name: 'Options de la liste' }));
await page.waitForTimeout(400);
await tap(page.getByRole('button', { name: /Coller une nouvelle liste/ }));
await page.waitForTimeout(450);
await page.getByPlaceholder(/Une ligne par produit/).fill('sauce algerienne 1L\npoulet pane 2kg x4\nFrites 5kg x3');
await page.waitForTimeout(250);
await shot('memoire-apercu-nouvelle-liste');
await tap(page.getByRole('button', { name: /Créer la liste · 3 articles/ }));
await page.waitForTimeout(700);
check('nouvelle liste : « sauce algerienne 1L » dans Épicerie sèche (choix mémorisé)', (await page.locator('section', { hasText: 'Épicerie sèche' }).locator('[role=checkbox]', { hasText: 'Sauce algerienne 1L' }).count()) === 1);
check('nouvelle liste : « poulet pane 2kg » dans Surgelés (mémorisé plus tôt)', (await page.locator('section', { hasText: 'Surgelés' }).locator('[role=checkbox]', { hasText: 'poulet pane 2kg' }).count()) === 1);

// Réglages > Mes catégories mémorisées : modifier, supprimer, réinitialiser, annuler
await tap(page.getByRole('button', { name: 'Réglages' }));
await page.waitForTimeout(500);
check('réglages : « Sauce algérienne » mémorisée', (await page.getByRole('button', { name: 'Modifier Sauce algérienne' }).count()) === 1);
await tap(page.getByRole('button', { name: 'Modifier Sauce algérienne' }));
await page.waitForTimeout(450);
await shot('memoire-reglages-modifier');
await tap(page.getByRole('dialog').getByRole('button', { name: /Sauces & Condiments/ }));
await page.waitForTimeout(500);
check('réglages : catégorie mémorisée modifiable', (await page.locator('main li', { hasText: 'Sauce algérienne' }).first().innerText()).includes('Sauces & Condiments'));
await tap(page.getByRole('button', { name: 'Oublier Sauce algérienne' }));
await page.waitForTimeout(300);
check('réglages : suppression d’un produit mémorisé', (await page.getByRole('button', { name: 'Modifier Sauce algérienne' }).count()) === 0);
await tap(page.getByRole('button', { name: 'Annuler' }));
await page.waitForTimeout(300);
check('réglages : « Annuler » le rétablit', (await page.getByRole('button', { name: 'Modifier Sauce algérienne' }).count()) === 1);
await tap(page.getByRole('button', { name: 'Réinitialiser', exact: true }));
await page.waitForTimeout(300);
check('réglages : « Réinitialiser » vide la liste', (await page.getByRole('button', { name: /^Modifier / }).count()) === 0);
await tap(page.getByRole('button', { name: 'Annuler' }));
await page.waitForTimeout(300);
check('réglages : « Annuler » restaure tout', (await page.getByRole('button', { name: /^Modifier / }).count()) === 2);

// ───── Fermeture brutale en plein milieu des courses ─────
await tap(page.getByRole('button', { name: 'Courses', exact: true }));
await page.waitForTimeout(500);
await tap(row('Frites'));
for (let i = 0; i < 2; i++) await tap(row('poulet pane').getByRole('button', { name: /Prendre un/ }));
await tap(page.locator('section', { hasText: 'Épicerie sèche' }).locator('button[aria-expanded]'));
// L'onglet est tué tout de suite : pas d'attente, pas de bouton « Sauvegarder ».
await page.close();
page = await ctx.newPage();
watch(page);
await page.goto(url);
await page.addStyleTag({ content: SAFE });
await page.waitForTimeout(1600);
await shot('apres-fermeture-brutale');
check('rouvert : « Frites » toujours cochée', (await row('Frites').getAttribute('aria-checked')) === 'true');
check('rouvert : « poulet pane » toujours à 2/4 (partiel)', (await row('poulet pane').getAttribute('aria-checked')) === 'mixed' && /2\/4/.test(await row('poulet pane').innerText()));
check('rouvert : rayon Épicerie sèche toujours replié', (await page.locator('section', { hasText: 'Épicerie sèche' }).locator('button[aria-expanded]').getAttribute('aria-expanded')) === 'false');
const idbAfter = await readIdb();
const frites = idbAfter.lists.find((l) => l.id === idbAfter.meta.activeId)?.items.find((i) => i.name.startsWith('Frites'));
check('IndexedDB contient bien la coche et la liste ouverte', frites?.taken === frites?.qty && frites?.taken === 3);

// ───── Exporter / importer ─────
await tap(page.getByRole('button', { name: 'Réglages' }));
await page.waitForTimeout(500);
const [download] = await Promise.all([page.waitForEvent('download'), tap(page.getByRole('button', { name: 'Exporter mes données' }))]);
const { readFileSync } = await import('node:fs');
const exportPath = await download.path();
const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
console.log('   export :', download.suggestedFilename(), `(${exported.lists.length} listes)`);
check('export : fichier JSON nommé avec la date', /^hashtagbangers-courses-\d{4}-\d{2}-\d{2}\.json$/.test(download.suggestedFilename()));
check('export : 4 listes + catégories mémorisées + réglages', exported.app === 'hashtagbangers-courses' && exported.lists.length === 4 && Object.keys(exported.settings.learned).length === 2 && exported.settings.theme === 'dark');

await page.getByRole('button', { name: 'Effacer toutes les données' }).scrollIntoViewIfNeeded();
await tap(page.getByRole('button', { name: 'Effacer toutes les données' }));
await page.waitForTimeout(400);
await tap(page.getByRole('button', { name: 'Oui, tout effacer' }));
await page.waitForTimeout(500);
check('tout effacé (IndexedDB vide)', (await readIdb()).lists.length === 0);

await page.setInputFiles('input[type=file]', { name: 'faux.json', mimeType: 'application/json', buffer: Buffer.from('ceci n’est pas une sauvegarde') });
await page.waitForTimeout(500);
check('import d’un fichier invalide : message d’erreur, rien ne change', (await page.getByText(/illisible/).count()) === 1 && (await readIdb()).lists.length === 0);

await page.setInputFiles('input[type=file]', exportPath);
await page.waitForTimeout(600);
await shot('import-confirmation');
check('import : confirmation « 4 listes » et « 2 catégories mémorisées »', /4 listes/.test(await page.getByRole('dialog').innerText()) && /2 catégories mémorisées/.test(await page.getByRole('dialog').innerText()));
await tap(page.getByRole('button', { name: 'Remplacer mes données' }));
await page.waitForTimeout(700);
const idbImported = await readIdb();
check('import : 4 listes restaurées dans IndexedDB', idbImported.lists.length === 4);
check('import : catégories mémorisées restaurées', (await page.getByRole('button', { name: /^Modifier / }).count()) === 2);
await tap(page.getByRole('button', { name: 'Courses', exact: true }));
await page.waitForTimeout(500);
check('import : la liste ouverte est retrouvée avec ses coches', (await row('Frites').getAttribute('aria-checked')) === 'true');

// PWA
const manifest = await page.evaluate(async () => (await fetch('/manifest.json')).json());
check('manifest : standalone + thème rose + icônes 192/512', manifest.display === 'standalone' && manifest.theme_color === '#ED1E79' && manifest.icons.length === 3);
const sw = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
check('service worker enregistré', sw);
const metas = await page.evaluate(() => ({
  capable: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content,
  status: document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]')?.content,
  viewport: document.querySelector('meta[name=viewport]')?.content,
}));
check('balises iOS (capable, black-translucent, viewport-fit=cover)', metas.capable === 'yes' && metas.status === 'black-translucent' && metas.viewport.includes('viewport-fit=cover'));

// Hors ligne
await page.waitForTimeout(800);
await ctx.setOffline(true);
await page.reload();
await page.waitForTimeout(1500);
const offlineOk = (await page.getByRole('button', { name: 'Courses', exact: true }).count()) === 1;
check('fonctionne hors ligne (rechargement sans réseau)', offlineOk);
await ctx.setOffline(false);

check('aucune erreur JavaScript', errors.length === 0);
if (errors.length) console.log(errors);
await browser.close();
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications OK`);
process.exit(failed.length ? 1 : 0);
