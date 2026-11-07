/**
 * Faux serveur Supabase pour les tests de bout en bout (aucun réseau réel) :
 * authentification par mot de passe et API REST des tables hifz_* avec isolation par utilisateur.
 */
import { createHash } from "node:crypto";

export const FAKE_URL = "https://fake.supabase.test";
export const GOOD_PASSWORD = "bon-mot-de-passe";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const uuidFor = (email) => {
  const h = createHash("md5").update(email.toLowerCase()).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const PK = { hifz_cards: "key", hifz_programs: "id", hifz_reviews: "id", hifz_settings: "user_id" };
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-expose-headers": "*",
};

export function createFakeSupabase() {
  const state = {
    down: false,
    tick: 0,
    /** user id -> table -> Map(pk -> row) */
    data: new Map(),
    log: [],
    signups: [],
    emails: new Map(),
  };

  const userTables = (uid) => {
    if (!state.data.has(uid)) state.data.set(uid, Object.fromEntries(Object.keys(PK).map((t) => [t, new Map()])));
    return state.data.get(uid);
  };
  const stamp = () => new Date(1_800_000_000_000 + ++state.tick * 1000).toISOString();

  function sessionFor(email) {
    const id = uuidFor(email);
    state.emails.set(id, email);
    const exp = Math.floor(Date.now() / 1000) + 86_400;
    const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: id, email, role: "authenticated", aud: "authenticated", exp })}.sig`;
    const user = {
      id, aud: "authenticated", role: "authenticated", email,
      email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, identities: [],
      created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    };
    return { access_token: jwt, token_type: "bearer", expires_in: 86_400, expires_at: exp, refresh_token: `r-${id}`, user };
  }

  const userFromAuth = (req) => {
    const token = (req.headers()["authorization"] ?? "").replace(/^Bearer /i, "");
    try {
      return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()).sub ?? null;
    } catch {
      return null;
    }
  };

  const json = (route, status, body, extra = {}) =>
    route.fulfill({ status, headers: { ...CORS, "content-type": "application/json", ...extra }, body: JSON.stringify(body) });

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (state.down) return route.abort("internetdisconnected");

    // --- Authentification ---
    if (url.pathname === "/auth/v1/token") {
      const body = JSON.parse(req.postData() ?? "{}");
      if (url.searchParams.get("grant_type") === "refresh_token") {
        const email = state.emails.get(String(body.refresh_token).replace(/^r-/, ""));
        return email ? json(route, 200, sessionFor(email)) : json(route, 400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      }
      if (body.password !== GOOD_PASSWORD) return json(route, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" });
      state.log.push(`login ${body.email}`);
      return json(route, 200, sessionFor(body.email));
    }
    if (url.pathname === "/auth/v1/signup") {
      const body = JSON.parse(req.postData() ?? "{}");
      state.signups.push(body.email);
      return json(route, 200, { id: uuidFor(body.email), aud: "authenticated", email: body.email, identities: [] });
    }
    if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === "/auth/v1/recover") return json(route, 200, {});
    if (url.pathname === "/auth/v1/user") {
      const uid = userFromAuth(req);
      return uid ? json(route, 200, { id: uid, aud: "authenticated", email: "x@test.fr" }) : json(route, 401, { msg: "invalid JWT" });
    }

    // --- API de données (sécurité par utilisateur) ---
    const m = /^\/rest\/v1\/(hifz_\w+)$/.exec(url.pathname);
    if (!m) return json(route, 404, { message: "not found" });
    const table = m[1];
    const uid = userFromAuth(req);
    if (!uid || !PK[table]) return json(route, 401, { code: "PGRST301", message: "JWT expired" });
    const rows = userTables(uid)[table];

    if (req.method() === "GET") {
      let list = [...rows.values()];
      const since = url.searchParams.get("updated_at")?.replace(/^gte\./, "");
      if (since) list = list.filter((r) => r.updated_at >= since);
      list.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? list.length);
      state.log.push(`GET ${table} ${list.length}`);
      return json(route, 200, list.slice(offset, offset + limit));
    }
    if (req.method() === "POST") {
      const body = JSON.parse(req.postData() ?? "[]");
      const prefer = req.headers()["prefer"] ?? "";
      const ignore = prefer.includes("ignore-duplicates");
      for (const r of Array.isArray(body) ? body : [body]) {
        if (r.user_id && r.user_id !== uid) return json(route, 403, { code: "42501", message: "new row violates row-level security policy" });
        const row = { ...r, user_id: uid, updated_at: stamp() };
        const pk = row[PK[table]];
        if (ignore && rows.has(pk)) continue;
        rows.set(pk, { ...(rows.get(pk) ?? {}), ...row });
      }
      state.log.push(`POST ${table} ${Array.isArray(body) ? body.length : 1}`);
      return route.fulfill({ status: 201, headers: CORS, body: "" });
    }
    return json(route, 405, { message: "method not allowed" });
  }

  return {
    state,
    uidFor: uuidFor,
    rowsOf: (email, table) => [...userTables(uuidFor(email))[table].values()],
    install: (context) => context.route(`${FAKE_URL}/**`, handle),
  };
}
