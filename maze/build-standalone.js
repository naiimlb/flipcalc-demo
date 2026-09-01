#!/usr/bin/env node
/* ============================================================
   MazeRun — assemble une version autonome (un seul fichier).

   node build-standalone.js            -> standalone.html (page complète)
   node build-standalone.js --artifact -> artifact.html   (fragment sans
                                          doctype/html/head/body, pour
                                          l'hébergement en artefact)
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const dir = __dirname;
const artifact = process.argv.includes('--artifact');

let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

/* Les fichiers JS sont concaténés dans un seul <script> inline, dans l'ordre
   des balises du document : ils partagent déjà la portée globale. */
const sources = [];
html = html.replace(/[ \t]*<script src="(js\/[^"]+)"><\/script>\n?/g, (_, src) => {
  sources.push({ src, code: fs.readFileSync(path.join(dir, src), 'utf8') });
  return '';
});
if (!sources.length) throw new Error('Aucun <script src="js/…"> trouvé dans index.html');

const bundle = sources
  .map(s => `/* ---------- ${s.src} ---------- */\n${s.code.replace(/^'use strict';\n/m, '')}`)
  .join('\n');

const inline = `<script>\n'use strict';\n${bundle}</script>\n`;

if (artifact) {
  // Le conteneur d'artefact fournit déjà doctype/html/head/body, le charset et
  // le viewport ; on ne garde que le <title>, le <style> et le contenu du body.
  const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
  const style = html.match(/<style>[\s\S]*?<\/style>/)[0];
  const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].trim();
  html = `${title}\n${style}\n\n${body}\n\n${inline}`;
} else {
  // Page autonome : plus de manifeste ni d'icônes externes à charger.
  html = html
    .replace(/[ \t]*<link rel="manifest"[^>]*>\n?/g, '')
    .replace(/[ \t]*<link rel="(apple-touch-)?icon"[^>]*>\n?/g, '')
    .replace('</body>', `${inline}</body>`);
}

const out = path.join(dir, artifact ? 'artifact.html' : 'standalone.html');
fs.writeFileSync(out, html);
console.log(`${path.basename(out)} — ${(html.length / 1024).toFixed(1)} Ko, ${sources.length} scripts inlinés`);
