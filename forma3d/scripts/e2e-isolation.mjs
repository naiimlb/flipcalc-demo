// Isolation entre comptes, vue de l'extérieur : uniquement l'API publique de Supabase (clé « publishable »),
// avec deux vrais comptes (A = propriétaire des données, B = attaquant) et un visiteur anonyme.
// Les deux comptes sont supprimés à la fin (fonction delete_my_account).
// Usage : E2E_EMAIL_A=… E2E_PASSWORD_A=… E2E_EMAIL_B=… E2E_PASSWORD_B=… node scripts/e2e-isolation.mjs <dossier>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const out = process.argv[2] ?? "e2e-screens";
mkdirSync(out, { recursive: true });

const lines = [];
const check = (ok, label) => {
  const line = `${ok ? "✓" : "✗"} ${label}`;
  lines.push(line);
  console.log(line);
};
const info = (label) => {
  lines.push(`ℹ ${label}`);
  console.log(`ℹ ${label}`);
};

async function call(path, { token, method = "GET", body, headers = {}, raw = false } = {}) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !raw ? { "Content-Type": "application/json" } : {}),
      Prefer: "return=representation",
      ...headers,
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // réponse non JSON
  }
  return { status: res.status, json, text };
}
const rest = (path, opts) => call(`/rest/v1/${path}`, opts);
const rpc = (name, args, token) => call(`/rest/v1/rpc/${name}`, { method: "POST", body: args, token });

async function signIn(email, password) {
  const r = await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  if (r.status !== 200) throw new Error(`Connexion impossible (${email}) : ${r.status} ${r.text.slice(0, 120)}`);
  return { token: r.json.access_token, id: r.json.user.id };
}

const empty = (r) => r.status < 300 && Array.isArray(r.json) && r.json.length === 0;
const denied = (r) => r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0);

let A, B;
try {
  A = await signIn(process.env.E2E_EMAIL_A, process.env.E2E_PASSWORD_A);
  B = await signIn(process.env.E2E_EMAIL_B, process.env.E2E_PASSWORD_B);
  check(true, "Deux comptes distincts connectés");

  /* ----- A crée ses données ----- */
  const created = await rpc("create_design_request", { p_prompt: "Demande privée du compte A", p_has_image: false }, A.token);
  const rid = created.json?.id;
  check(Boolean(rid), "A : création d'une demande");
  const done = await rpc(
    "complete_design_request",
    { p_id: rid, p_status: "ready", p_title: "Titre secret A", p_design: { title: "Titre secret A" }, p_error: null, p_provider: "test", p_model: "m", p_duration_ms: 5, p_model_asset: null, p_raw: "brut-secret", p_stop_reason: null, p_usage: null, p_validation_errors: null },
    A.token,
  );
  check(done.status < 300, "A : résultat enregistré via la fonction SQL");
  const folder = await rest("folders", { method: "POST", token: A.token, body: { name: "Dossier secret A" } });
  const fid = folder.json?.[0]?.id;
  check(Boolean(fid), "A : création d'un dossier");
  const path = `${A.id}/prive.glb`;
  const upload = await call(`/storage/v1/object/models/${path}`, {
    method: "POST",
    token: A.token,
    raw: true,
    body: randomBytes(64),
    headers: { "Content-Type": "model/gltf-binary", "x-upsert": "true" },
  });
  check(upload.status < 300, "A : fichier 3D envoyé dans son dossier Storage");
  const own = await rest("design_requests?select=id,title", { token: A.token });
  check(own.json?.length === 1, "A : voit sa propre demande");

  /* ----- B (autre compte) ----- */
  check(empty(await rest("design_requests?select=*", { token: B.token })), "B ne voit aucune demande de A");
  check(empty(await rest(`design_requests?id=eq.${rid}&select=*`, { token: B.token })), "B ne trouve pas la demande de A, même avec son identifiant");
  check(empty(await rest("folders?select=*", { token: B.token })), "B ne voit pas les dossiers de A");
  check(empty(await rest(`profiles?id=eq.${A.id}&select=*`, { token: B.token })), "B ne voit pas le profil de A");
  check(empty(await rest("request_debug?select=*", { token: B.token })), "B ne voit pas les réponses brutes (réservées aux admins)");
  check(empty(await rest("usage_events?select=*", { token: B.token })), "B ne voit pas le registre d'usage");
  check(empty(await rest("app_logs?select=*", { token: B.token })), "B ne voit pas le journal");

  const patched = await rest(`design_requests?id=eq.${rid}`, { method: "PATCH", token: B.token, body: { title: "piraté" } });
  check(denied(patched), "B ne peut pas modifier la demande de A");
  const deleted = await rest(`design_requests?id=eq.${rid}`, { method: "DELETE", token: B.token });
  check(denied(deleted), "B ne peut pas supprimer la demande de A");
  const stillThere = await rest(`design_requests?id=eq.${rid}&select=title`, { token: A.token });
  check(stillThere.json?.[0]?.title === "Titre secret A", "La demande de A est intacte après ces tentatives");
  const renamed = await rest(`folders?id=eq.${fid}`, { method: "PATCH", token: B.token, body: { name: "piraté" } });
  check(denied(renamed), "B ne peut pas renommer le dossier de A");

  check((await rpc("duplicate_design_request", { p_id: rid }, B.token)).status >= 400, "B ne peut pas dupliquer la demande de A");
  check(
    (await rpc("complete_design_request", { p_id: rid, p_status: "ready", p_title: "x", p_design: {}, p_error: null, p_provider: null, p_model: null, p_duration_ms: 1, p_model_asset: null, p_raw: null, p_stop_reason: null, p_usage: null, p_validation_errors: null }, B.token)).status >= 400,
    "B ne peut pas écrire un résultat dans la demande de A",
  );
  const promote = await rest(`profiles?id=eq.${B.id}`, { method: "PATCH", token: B.token, body: { role: "admin" } });
  const roleNow = await rest(`profiles?id=eq.${B.id}&select=role`, { token: B.token });
  check(promote.status >= 400 && roleNow.json?.[0]?.role === "user", "B ne peut pas se promouvoir administrateur via l'API");
  check((await rpc("set_user_role", { p_user_id: B.id, p_role: "admin" }, B.token)).status >= 400, "B ne peut pas appeler set_user_role");
  check((await rpc("admin_stats", {}, B.token)).status >= 400, "B ne peut pas lire les statistiques admin");
  // Un administrateur existe déjà : la fonction répond « false » (ou refuse) ; dans tous les cas B reste simple utilisateur.
  const claim = await rpc("claim_first_admin", { p_token: "mauvais-jeton" }, B.token);
  const roleAfterClaim = await rest(`profiles?id=eq.${B.id}&select=role`, { token: B.token });
  check(
    (claim.status >= 400 || claim.json === false) && roleAfterClaim.json?.[0]?.role === "user",
    "B ne devient pas admin avec un faux jeton",
  );
  const secrets = await rest("app_secrets?select=*", { token: B.token });
  check(secrets.status >= 400 || empty(secrets), "B ne peut pas lire les clés d'API");
  check((await rest("settings_inexistants?select=*", { token: B.token })).status >= 400, "Les tables non exposées restent introuvables");

  const own2 = await rpc("create_design_request", { p_prompt: "Demande de B pour le test", p_has_image: false }, B.token);
  const rid2 = own2.json?.id;
  const stolenFolder = await rest(`design_requests?id=eq.${rid2}`, { method: "PATCH", token: B.token, body: { folder_id: fid } });
  check(stolenFolder.status >= 400, "B ne peut pas ranger sa demande dans le dossier de A");
  const stolenFile = await rest(`design_requests?id=eq.${rid2}`, { method: "PATCH", token: B.token, body: { model_path: path } });
  check(stolenFile.status >= 400, "B ne peut pas lier le fichier 3D de A à sa demande");

  const download = await call(`/storage/v1/object/authenticated/models/${path}`, { token: B.token });
  check(download.status >= 400, "B ne peut pas télécharger le fichier 3D de A");
  const listing = await call("/storage/v1/object/list/models", { method: "POST", token: B.token, body: { prefix: `${A.id}/`, limit: 10 } });
  check(Array.isArray(listing.json) && listing.json.length === 0, "B ne voit pas le contenu du dossier Storage de A");
  const intrusion = await call(`/storage/v1/object/models/${A.id}/piege.glb`, {
    method: "POST",
    token: B.token,
    raw: true,
    body: randomBytes(16),
    headers: { "Content-Type": "model/gltf-binary" },
  });
  check(intrusion.status >= 400, "B ne peut pas écrire dans le dossier Storage de A");
  const ownUpload = await call(`/storage/v1/object/models/${B.id}/ok.glb`, {
    method: "POST",
    token: B.token,
    raw: true,
    body: randomBytes(16),
    headers: { "Content-Type": "model/gltf-binary" },
  });
  check(ownUpload.status < 300, "B peut écrire dans son propre dossier Storage");
  const wrongBucket = await call(`/storage/v1/object/avatars/${A.id}/avatar.webp`, {
    method: "POST",
    token: B.token,
    raw: true,
    body: randomBytes(16),
    headers: { "Content-Type": "image/webp" },
  });
  check(wrongBucket.status >= 400, "B ne peut pas déposer une photo de profil au nom de A");

  /* ----- Visiteur sans compte ----- */
  check(denied(await rest("design_requests?select=*")), "Visiteur : aucune demande lisible");
  check(denied(await rest("profiles?select=*")), "Visiteur : aucun profil lisible");
  check(denied(await rest("folders?select=*")), "Visiteur : aucun dossier lisible");
  check((await rest("app_secrets?select=*")).status >= 400 || empty(await rest("app_secrets?select=*")), "Visiteur : clés d'API illisibles");
  check((await rpc("create_design_request", { p_prompt: "Demande visiteur", p_has_image: false })).status >= 400, "Visiteur : ne peut pas créer de demande");
  check((await rpc("delete_my_account", {})).status >= 400, "Visiteur : ne peut pas supprimer de compte");
  const publicFile = await call(`/storage/v1/object/public/models/${path}`);
  check(publicFile.status >= 400, "Visiteur : fichier 3D privé inaccessible, même par l'URL publique");
  const settings = await rest("app_settings?select=key");
  info(`Visiteur : réglages lisibles = ${(settings.json ?? []).map((s) => s.key).join(", ") || "aucun"} (le prompt système « ai » est public sans clé secrète)`);

  const hash = randomBytes(32).toString("hex");
  const quota = [];
  for (let i = 0; i < 3; i++) quota.push((await rpc("consume_guest_quota", { p_ip_hash: hash })).json);
  check(quota[0] === true && quota[1] === true && quota[2] === false, `Essai invité : 2 essais par jour, le 3e refusé (${quota.join(", ")})`);
  check((await rpc("consume_guest_quota", { p_ip_hash: "pas-un-hash" })).status >= 400, "Essai invité : hash invalide refusé");

  /* ----- Export, suppression ----- */
  const exported = await rest("design_requests?select=id,title,design", { token: A.token });
  check(exported.json?.length === 1, "A : export de ses propres données (1 demande)");
  await call(`/storage/v1/object/models/${path}`, { method: "DELETE", token: A.token });
  await call(`/storage/v1/object/models/${B.id}/ok.glb`, { method: "DELETE", token: B.token });
  for (const [name, who] of [["A", A], ["B", B]]) {
    const del = await rpc("delete_my_account", {}, who.token);
    check(del.status < 300, `${name} : suppression du compte`);
  }
  const gone = await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email: process.env.E2E_EMAIL_A, password: process.env.E2E_PASSWORD_A } });
  check(gone.status >= 400, "Après suppression : connexion impossible");
} catch (err) {
  check(false, `Test interrompu : ${String(err.message).split("\n")[0]}`);
}

writeFileSync(join(out, "isolation.txt"), lines.join("\n") + "\n");
process.exit(lines.some((l) => l.startsWith("✗")) ? 1 : 0);
