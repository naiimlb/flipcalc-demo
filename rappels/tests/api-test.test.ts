import { beforeEach, describe, expect, it, vi } from "vitest";

// Routes /api/test/* : le serveur refuse tout appel qui ne vient pas d'un responsable, quoi que dise le navigateur.
type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
let rpcImpl: Rpc;
const sent: { endpoint: string; payload: string }[] = [];

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: (fn: string, args?: Record<string, unknown>) => rpcImpl(fn, args) }) }));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: () => undefined,
    sendNotification: async (sub: { endpoint: string }, payload: string) => {
      sent.push({ endpoint: sub.endpoint, payload });
    },
  },
}));

const req = (path: string, init: RequestInit & { token?: string } = {}) =>
  new Request(`http://localhost${path}`, { ...init, headers: { ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), "Content-Type": "application/json" } });

beforeEach(() => {
  sent.length = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://sb.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.CRON_SECRET = "secret-tres-secret";
});

const asRole = (manager: boolean): Rpc => async (fn, args) => {
  if (fn === "is_manager") return { data: manager, error: null };
  if (fn === "test_target_subs") {
    if (!manager) return { data: null, error: { message: "réservé au responsable", code: "42501" } };
    return { data: args?.p_target === "test" ? [{ endpoint: "https://push/testeur", p256dh: "k", auth_key: "a" }] : [{ endpoint: "https://push/moi", p256dh: "k", auth_key: "a" }], error: null };
  }
  return { data: null, error: null };
};

describe("/api/test/status", () => {
  it("sans jeton : 401 ; jeton invalide : 401 ; caissier : 403 (refus côté serveur)", async () => {
    const { GET } = await import("@/app/api/test/status/route");
    rpcImpl = asRole(false);
    expect((await GET(req("/api/test/status"))).status).toBe(401);
    rpcImpl = async () => ({ data: null, error: { message: "JWT invalide" } });
    expect((await GET(req("/api/test/status", { token: "faux" }))).status).toBe(401);
    rpcImpl = asRole(false);
    const r = await GET(req("/api/test/status", { token: "jeton-caissier" }));
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "réservé au responsable" });
  });
  it("responsable : 200, seulement des booléens (jamais les valeurs secrètes)", async () => {
    const { GET } = await import("@/app/api/test/status/route");
    rpcImpl = asRole(true);
    const r = await GET(req("/api/test/status", { token: "jeton-responsable" }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ vapid: true, cronSecret: true, supabase: true });
    expect(JSON.stringify(body)).not.toContain("secret-tres-secret");
    expect(JSON.stringify(body)).not.toContain("priv");
  });
});

describe("/api/test/push", () => {
  const post = (token: string | undefined, body: unknown) => req("/api/test/push", { method: "POST", token, body: JSON.stringify(body) });
  const item = { title: "Notification de test", body: "ok", url: "/test" };

  it("un caissier reçoit 403 et RIEN n'est envoyé", async () => {
    const { POST } = await import("@/app/api/test/push/route");
    rpcImpl = asRole(false);
    expect((await POST(post("jeton-caissier", { target: "self", items: [item] }))).status).toBe(403);
    expect((await POST(post(undefined, { target: "self", items: [item] }))).status).toBe(401);
    expect(sent).toHaveLength(0);
  });
  it("responsable → mes appareils : envoi avec le marqueur 🧪 ; vers le compte de test : uniquement ses appareils", async () => {
    const { POST } = await import("@/app/api/test/push/route");
    rpcImpl = asRole(true);
    const r1 = await POST(post("jeton-responsable", { target: "self", items: [item] }));
    expect(await r1.json()).toMatchObject({ ok: true, sent: 1, devices: 1 });
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push/moi"]);
    expect(JSON.parse(sent[0]!.payload).title).toBe("🧪 Notification de test");
    sent.length = 0;
    await POST(post("jeton-responsable", { target: "test", items: [item] }));
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push/testeur"]);
  });
  it("une cible inconnue est traitée comme « mes appareils » (jamais un autre utilisateur) ; les liens externes sont refusés", async () => {
    const { POST } = await import("@/app/api/test/push/route");
    rpcImpl = asRole(true);
    await POST(post("jeton-responsable", { target: "tous-les-caissiers", items: [item] }));
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push/moi"]);
    sent.length = 0;
    const r = await POST(post("jeton-responsable", { target: "self", items: [{ ...item, url: "https://evil.example" }, { ...item, url: "//evil.example" }] }));
    expect(r.status).toBe(400);
    expect(sent).toHaveLength(0);
  });
  it("aucun appareil : message clair, rien d'envoyé", async () => {
    const { POST } = await import("@/app/api/test/push/route");
    rpcImpl = async (fn) => (fn === "is_manager" ? { data: true, error: null } : { data: [], error: null });
    const r = await POST(post("jeton-responsable", { target: "self", items: [item] }));
    expect(await r.json()).toMatchObject({ ok: false });
  });
});
