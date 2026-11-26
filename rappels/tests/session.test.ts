import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isNetworkFailure } from "@/lib/auth";
import { SESSION_COOKIE_OPTIONS, SESSION_MAX_AGE } from "@/lib/session-cookies";

describe("cookies de session longue durée", () => {
  it("durent au moins 1 an (400 jours, maximum des navigateurs), SameSite=Lax, chemin /", () => {
    expect(SESSION_MAX_AGE).toBeGreaterThanOrEqual(365 * 24 * 3600);
    expect(SESSION_COOKIE_OPTIONS).toMatchObject({ sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
  });

  it("pas de httpOnly : le navigateur doit lire la session pour ses requêtes protégées par la RLS", () => {
    expect("httpOnly" in SESSION_COOKIE_OPTIONS).toBe(false);
  });
});

describe("réseau coupé ≠ session invalide", () => {
  it("un problème de réseau ou de serveur ne déconnecte jamais", () => {
    expect(isNetworkFailure({ name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 })).toBe(true);
    expect(isNetworkFailure({ message: "TypeError: Failed to fetch" })).toBe(true);
    expect(isNetworkFailure({ message: "Load failed" })).toBe(true);
    expect(isNetworkFailure({ message: "network request failed" })).toBe(true);
    expect(isNetworkFailure({ message: "Service Unavailable", status: 503 })).toBe(true);
    expect(isNetworkFailure({ message: "timeout of 10000ms exceeded" })).toBe(true);
  });

  it("une réponse claire du serveur (session invalide) n'est PAS un problème de réseau", () => {
    expect(isNetworkFailure({ name: "AuthApiError", message: "Invalid Refresh Token: Refresh Token Not Found", status: 400 })).toBe(false);
    expect(isNetworkFailure({ name: "AuthApiError", message: "Refresh Token Not Found", status: 401 })).toBe(false);
    expect(isNetworkFailure({ name: "AuthSessionMissingError", message: "Auth session missing!" })).toBe(false);
    expect(isNetworkFailure(null)).toBe(false);
  });
});

describe("proxy de rafraîchissement de session", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:9"; // injoignable : le proxy ne doit jamais bloquer la page
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  const req = (init: { cookie?: string; headers?: Record<string, string> } = {}) =>
    new NextRequest("http://localhost/reglages", { headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...init.headers } });

  it("laisse passer sans cookie de session (aucun appel réseau)", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(req());
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("location")).toBeNull();
  });

  it("avec un cookie de session mais Supabase injoignable : la page s'affiche, sans redirection ni erreur", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(req({ cookie: "sb-abc-auth-token=base64-eyJhY2Nlc3NfdG9rZW4iOiJ4In0" }));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("location")).toBeNull();
  });

  it("ne fait rien pour les préchargements de pages", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(req({ cookie: "sb-abc-auth-token=x", headers: { "next-router-prefetch": "1" } }));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
