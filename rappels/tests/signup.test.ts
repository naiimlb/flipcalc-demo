import { beforeEach, describe, expect, it, vi } from "vitest";

const createUser = vi.fn();
vi.mock("@/server/supabase-admin", () => ({ getAdminClient: () => ({ auth: { admin: { createUser } } }) }));

const { POST: checkCode } = await import("@/app/api/auth/code/route");
const { POST: signup } = await import("@/app/api/auth/inscription/route");

let n = 0;
const req = (url: string, body: unknown) => new Request(`http://x${url}`, { method: "POST", headers: { "x-forwarded-for": `10.0.0.${++n}` }, body: JSON.stringify(body) });
const valid = { code: "bangers25", prenom: "Naïm", email: "Naim@Exemple.fr ", password: "motdepasse1" };

describe("code d'équipe (côté serveur)", () => {
  beforeEach(() => {
    process.env.TEAM_CODE = "Bangers25";
    createUser.mockReset();
  });

  it("accepte le bon code (sans tenir compte des majuscules/espaces), refuse le mauvais", async () => {
    expect((await checkCode(req("/api/auth/code", { code: " BANGERS25 " }))).status).toBe(200);
    const bad = await checkCode(req("/api/auth/code", { code: "faux" }));
    expect(bad.status).toBe(403);
    expect((await bad.json()).message).toBe("Code d'équipe invalide.");
    expect((await checkCode(req("/api/auth/code", {}))).status).toBe(403);
  });

  it("inscriptions fermées si TEAM_CODE n'est pas défini", async () => {
    delete process.env.TEAM_CODE;
    expect((await checkCode(req("/api/auth/code", { code: "x" }))).status).toBe(503);
    expect((await signup(req("/api/auth/inscription", valid))).status).toBe(503);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("freine les essais en rafale (10 par 15 min et par IP)", async () => {
    const ip = { "x-forwarded-for": "9.9.9.9" };
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await checkCode(new Request("http://x/api/auth/code", { method: "POST", headers: ip, body: JSON.stringify({ code: "faux" }) }))).status;
    expect(last).toBe(429);
  });
});

describe("création de compte", () => {
  beforeEach(() => {
    process.env.TEAM_CODE = "Bangers25";
    createUser.mockReset();
    createUser.mockResolvedValue({ error: null });
  });

  it("refuse sans bon code, sans rien créer", async () => {
    const res = await signup(req("/api/auth/inscription", { ...valid, code: "nope" }));
    expect(res.status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("crée le compte avec email nettoyé, prénom en métadonnée et AUCUN rôle", async () => {
    const res = await signup(req("/api/auth/inscription", { ...valid, role: "responsable", user_metadata: { role: "responsable" } }));
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({ email: "naim@exemple.fr", password: "motdepasse1", email_confirm: true, user_metadata: { prenom: "Naïm" } });
  });

  it("valide prénom, email et mot de passe", async () => {
    for (const bad of [{ prenom: "" }, { prenom: "x".repeat(31) }, { email: "pas-un-mail" }, { password: "court" }]) {
      expect((await signup(req("/api/auth/inscription", { ...valid, ...bad }))).status).toBe(400);
    }
    expect(createUser).not.toHaveBeenCalled();
  });

  it("email déjà utilisé : message clair (409)", async () => {
    createUser.mockResolvedValue({ error: { code: "email_exists", message: "A user with this email address has already been registered", status: 422 } });
    const res = await signup(req("/api/auth/inscription", valid));
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe("Cet email a déjà un compte. Connecte-toi.");
  });

  it("autre erreur : message générique, sans détail technique", async () => {
    createUser.mockResolvedValue({ error: { message: "boom: secret détail", status: 500 } });
    const res = await signup(req("/api/auth/inscription", valid));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
