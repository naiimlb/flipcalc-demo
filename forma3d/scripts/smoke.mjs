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
const html = await home.text();
assert(html.includes("Forma3D"), "la page d'accueil s'affiche");
assert(html.includes("Dernières demandes"), "la carte des dernières demandes est rendue");

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
