import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// Charge public/sw.js dans un faux « service worker » pour vérifier ce que fait un appui sur une notification.
type Win = { visibilityState: string; focus: () => Promise<unknown>; postMessage?: (m: unknown, t: unknown[]) => void; navigate?: (u: string) => Promise<unknown> };

function load(wins: Win[]) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const opened: string[] = [];
  const self = {
    location: { hostname: "hb-rappels.vercel.app", origin: "https://hb-rappels.vercel.app" },
    addEventListener: (n: string, h: (e: unknown) => void) => (handlers[n] = h),
    skipWaiting: () => undefined,
    clients: { matchAll: async () => wins, openWindow: async (u: string) => void opened.push(u), claim: async () => undefined },
    registration: { showNotification: async () => undefined },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL, MessageChannel, setTimeout, clearTimeout, caches: {}, fetch: async () => undefined });
  const click = async (url: unknown) => {
    let pending: Promise<unknown> = Promise.resolve();
    let closed = false;
    handlers.notificationclick!({ notification: { close: () => (closed = true), data: url === undefined ? undefined : { url } }, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
    return closed;
  };
  return { click, opened };
}

describe("service worker : appui sur une notification", () => {
  it("app fermée : ouvre une nouvelle fenêtre directement sur la tâche", async () => {
    const sw = load([]);
    expect(await sw.click("/taches/abc?j=2026-11-26")).toBe(true); // la notification se ferme
    expect(sw.opened).toEqual(["/taches/abc?j=2026-11-26"]);
  });

  it("app déjà ouverte : réutilise la fenêtre (focus + message), sans en ouvrir une autre ni recharger", async () => {
    const messages: unknown[] = [];
    let focused = 0;
    let navigated = 0;
    const win: Win = {
      visibilityState: "hidden",
      focus: async () => void focused++,
      navigate: async () => void navigated++,
      postMessage: (m, t) => {
        messages.push(m);
        (t[0] as MessagePort).postMessage("ok"); // la page répond « reçu »
      },
    };
    const sw = load([win]);
    await sw.click("/taches/abc?j=2026-11-26");
    expect(focused).toBe(1);
    expect(messages).toEqual([{ type: "hb-open", url: "/taches/abc?j=2026-11-26" }]);
    expect(navigated).toBe(0);
    expect(sw.opened).toEqual([]);
  });

  it("préfère la fenêtre visible quand il y en a plusieurs", async () => {
    const got: string[] = [];
    const mk = (name: string, v: string): Win => ({ visibilityState: v, focus: async () => undefined, postMessage: (_m, t) => (got.push(name), (t[0] as MessagePort).postMessage("ok")) });
    await load([mk("cachée", "hidden"), mk("visible", "visible")]).click("/taches/x");
    expect(got).toEqual(["visible"]);
  });

  it("page qui ne répond pas (ancienne version) : on la fait naviguer", async () => {
    const urls: string[] = [];
    const win: Win = { visibilityState: "visible", focus: async () => undefined, postMessage: () => undefined, navigate: async (u) => void urls.push(u) };
    await load([win]).click("/taches/abc");
    expect(urls).toEqual(["/taches/abc"]);
  });

  it("fenêtre qui ne répond pas et ne navigue pas : nouvelle fenêtre en dernier recours", async () => {
    const sw = load([{ visibilityState: "visible", focus: async () => undefined, postMessage: () => undefined }]);
    await sw.click("/taches/abc");
    expect(sw.opened).toEqual(["/taches/abc"]);
  });

  it("lien étranger ou absent : retombe sur l'accueil (jamais un autre site)", async () => {
    const sw = load([]);
    await sw.click("https://evil.example/phishing");
    await sw.click(undefined);
    expect(sw.opened).toEqual(["/", "/"]);
  });
});
