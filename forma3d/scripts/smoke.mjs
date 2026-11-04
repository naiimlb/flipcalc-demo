// Test de fumée de bout en bout (mode démo) : 1 demande → 1 modèle 3D.
// Usage : npm run build && npm start & node scripts/smoke.mjs [http://localhost:3000]
const base = process.argv[2] ?? "http://localhost:3000";

async function waitForServer(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(base);
      if (res.ok) return res;
    } catch {
      // serveur pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Serveur injoignable : ${base}`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

const home = await waitForServer();
const landing = await home.text();
assert(landing.includes("Forma3D"), "la page d'accueil s'affiche");
assert(/Ouvrir l('|&#x27;)éditeur/.test(landing) && landing.includes("Comment ça marche"), "accueil des visiteurs : bouton « Ouvrir l'éditeur » et explication en 3 étapes");
const studio = await fetch(`${base}/studio`);
const html = await studio.text();
assert(studio.ok && html.includes('id="prompt"') && html.includes("Outils de l&#x27;éditeur"), "l'éditeur (/studio) : barre de saisie et barre d'outils");
const english = await (await fetch(`${base}/`, { headers: { "Accept-Language": "en-US,en;q=0.9" } })).text();
assert(english.includes('lang="en"') && english.includes("Open the editor"), "détection automatique de la langue (anglais)");
const arabic = await (await fetch(`${base}/`, { headers: { "Accept-Language": "ar" } })).text();
assert(arabic.includes('dir="rtl"'), "arabe : lecture de droite à gauche");
const dark = await (await fetch(`${base}/studio`, { headers: { Cookie: "forma3d-theme=dark" } })).text();
assert(/<html[^>]*class="[^"]*\bdark\b/.test(dark), "mode sombre mémorisé (cookie) rendu dès le serveur");
assert(/<html[^>]*class="[^"]*\bdark\b/.test(landing), "identité : thème sombre par défaut (sans choix enregistré)");
const light = await (await fetch(`${base}/`, { headers: { Cookie: "forma3d-theme=light" } })).text();
assert(!/<html[^>]*class="[^"]*\bdark\b/.test(light), "thème clair mémorisé (cookie) rendu dès le serveur");
assert(["accueil", "apercu", "etapes", "outils", "exemples", "galerie", "commencer"].every((id) => landing.includes(`id="${id}"`)), "accueil : héros, aperçu de l'éditeur + 5 sections");
assert(landing.includes('aria-label="Navigation principale"') && landing.includes('href="/studio"'), "navigation : lien vers l'éditeur");
const oldLink = await fetch(`${base}/?p=00000000-0000-0000-0000-000000000000`, { redirect: "manual" });
assert(oldLink.status >= 300 && oldLink.status < 400 && (oldLink.headers.get("location") ?? "").includes("/studio?p="), "anciens liens /?p= redirigés vers l'éditeur");
assert((await fetch(`${base}/galerie`)).ok, "la galerie publique répond");
const ds = await fetch(`${base}/design-system`);
const dsHtml = await ds.text();
assert(ds.ok && dsHtml.includes("Système de design") && dsHtml.includes("--accent"), "la page /design-system répond (couleurs, composants)");
const shared = await fetch(`${base}/p/lien-inexistant-0123456789`);
assert(shared.ok && (await shared.text()).includes("lien de partage"), "un lien de partage inconnu affiche un message clair");
const badComment = await fetch(`${base}/api/share/comment`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ token: "x", pseudo: "", body: "" }),
});
assert(badComment.status === 400, "commentaire invalide refusé (400)");
const badReport = await fetch(`${base}/api/gallery/report`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ id: "pas-un-uuid", reason: "" }),
});
assert(badReport.status === 400, "signalement invalide refusé (400)");

const res = await fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ prompt: "Une solution pour ranger mes câbles de charge" }),
});
assert(res.ok, `POST /api/generate répond ${res.status}`);
const body = await res.json();
assert(body.request?.status === "ready", "la demande est prête");
assert(body.request.design?.model?.parts?.length > 0, `le modèle 3D contient ${body.request.design.model.parts.length} pièces`);
assert(typeof body.request.design.analysis.summary === "string", "l'analyse du problème est présente");
assert(body.request.design.materiaux_conseilles?.length >= 3, "des matières conseillées sont renvoyées");

// Réponse diffusée en continu (une ligne JSON par évènement, la dernière contient le résultat).
const streamed = await fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base, Accept: "application/x-ndjson" },
  body: JSON.stringify({ prompt: "Un support de téléphone pour mon bureau" }),
});
assert((streamed.headers.get("content-type") ?? "").includes("application/x-ndjson"), "la génération est diffusée en continu (NDJSON)");
const events = (await streamed.text()).trim().split("\n").map((l) => JSON.parse(l));
assert(events.some((e) => e.t === "progress"), "des évènements d'avancement sont envoyés");
const last = events.at(-1);
assert(last.t === "result" && last.status === 200 && last.body.request.status === "ready", "l'évènement final contient la conception");

// Nouvelle version d'une conception (« Plus petit ») : calculée sans IA en mode démo.
const variantRes = await fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ prompt: body.request.prompt, variant: "smaller", base: body.request.design }),
});
const variantBody = await variantRes.json();
assert(variantRes.ok && variantBody.request?.design?.variante?.objectif === "smaller", "« Plus petit » crée une nouvelle version marquée comme telle");
assert(
  variantBody.request.design.dimensions.width < body.request.design.dimensions.width,
  `la nouvelle version est plus petite (${Math.round(variantBody.request.design.dimensions.width)} < ${Math.round(body.request.design.dimensions.width)} mm)`,
);
const badVariant = await fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ prompt: "un support", variant: "smaller", base: { title: "faux" } }),
});
assert(badVariant.status === 400, "une conception de départ invalide est refusée (400)");

// Assistant de questions : floue → 2 à 3 questions à choix ; détaillée → aucune ; invalide → 400.
const clarify = (payload) =>
  fetch(`${base}/api/clarify`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(payload) });
const vague = await (await clarify({ prompt: "un support" })).json();
assert(vague.needed === true && vague.questions.length >= 2 && vague.questions.length <= 3, `une demande floue déclenche ${vague.questions?.length} questions`);
assert(vague.questions.every((q) => q.options.length >= 2), "chaque question propose des réponses à cliquer");
const detailed = await (
  await clarify({ prompt: "Un support de téléphone pour mon bureau en bois, qui laisse passer le câble de charge et incline l'écran à 60 degrés pour les visioconférences" })
).json();
assert(detailed.needed === false && detailed.questions.length === 0, "une demande détaillée ne pose aucune question");
assert((await clarify({ prompt: "x" })).status === 400, "une demande invalide est refusée par l'assistant (400)");
const photo = await (await clarify({ prompt: "un cache pour ce câble qui traîne le long du mur", hasImage: true })).json();
assert(photo.needed && photo.questions[0]?.freeText, "photo sans mesure : une mesure de référence est demandée (réponse libre)");
const answered = await fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ prompt: "un support", answers: [{ question: "Où ?", answer: "À l'intérieur" }] }),
});
assert(answered.ok, "une demande accompagnée de réponses est acceptée");
const tooMany = await fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ prompt: "un support", answers: Array.from({ length: 5 }, () => ({ question: "Q ?", answer: "R" })) }),
});
assert(tooMany.status === 400, "plus de 3 réponses sont refusées (400)");

// Application installable (PWA).
const manifest = await fetch(`${base}/manifest.webmanifest`);
const manifestBody = await manifest.json();
assert(manifest.ok && manifestBody.display === "standalone" && manifestBody.icons.length >= 3, "le manifeste PWA est valide (plein écran, icônes)");
assert(Array.isArray(manifestBody.shortcuts) && manifestBody.shortcuts.length >= 2, "le manifeste PWA propose des raccourcis (éditeur, galerie)");
assert(manifestBody.icons.some((i) => i.purpose === "maskable"), "une icône « maskable » est fournie");
for (const path of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/splash/2048x2732.png"]) {
  const r = await fetch(`${base}${path}`);
  assert(r.ok && (r.headers.get("content-type") ?? "").includes("image/png"), `${path} est servi`);
}
const sw = await fetch(`${base}/sw.js`);
assert(sw.ok && (sw.headers.get("cache-control") ?? "").includes("no-cache"), "le service worker n'est jamais mis en cache");
assert((await (await fetch(`${base}/offline.html`)).text()).includes("hors ligne"), "la page hors-ligne est disponible");
assert(html.includes("apple-mobile-web-app-capable") || html.includes("mobile-web-app-capable"), "la page déclare le mode application");
assert(html.includes('rel="manifest"'), "la page référence le manifeste");

const version = await fetch(`${base}/api/version`);
const versionBody = await version.json();
assert(version.ok && typeof versionBody.version === "string", `/api/version répond (${versionBody.version})`);
assert((version.headers.get("cache-control") ?? "").includes("no-store"), "/api/version n'est jamais mis en cache");

const bad = await fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ prompt: "x" }),
});
assert(bad.status === 400, "une demande trop courte est refusée (400)");

const foreign = await fetch(`${base}/api/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://malveillant.example" },
  body: JSON.stringify({ prompt: "Une solution pour ranger mes câbles" }),
});
assert(foreign.status === 403, "une origine étrangère est refusée (403)");

const setup = await fetch(`${base}/setup`);
assert(setup.ok && (await setup.text()).includes("Supabase configuré"), "/setup affiche la liste de contrôle");
console.log("Test de fumée réussi.");
