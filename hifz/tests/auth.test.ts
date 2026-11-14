import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authErrorMessage, isValidEmail } from "@/lib/auth/errors";
import { isAuthPath, isPublicPath } from "@/lib/auth/config";
import { createDb, type HifzDB } from "@/lib/storage/db";
import { addProgram } from "@/lib/storage/repository";
import { SyncController } from "@/lib/sync/controller";
import { SyncError } from "@/lib/sync/types";
import { FakeRemote } from "./helpers/fake-remote";

describe("messages d'erreur d'authentification", () => {
  it.each([
    [{ code: "invalid_credentials", message: "Invalid login credentials" }, "E-mail ou mot de passe incorrect."],
    [{ code: "email_not_confirmed" }, "Confirmez d'abord"],
    [{ code: "user_already_exists" }, "Un compte existe déjà"],
    [{ code: "weak_password" }, "trop faible"],
    [{ code: "over_request_rate_limit", status: 429 }, "Trop de tentatives"],
    [{ message: "Database error saving new user" }, "inscriptions sont fermées"],
    [{ message: "Failed to fetch" }, "Connexion impossible"],
    [{ name: "AuthRetryableFetchError" }, "Connexion impossible"],
    [{ code: "otp_expired" }, "lien a expiré"],
    [{ code: "same_password" }, "différent de l'ancien"],
  ])("traduit %j", (error, expected) => {
    expect(authErrorMessage(error)).toContain(expected);
  });

  it("ne renvoie jamais le texte brut du serveur", () => {
    const msg = authErrorMessage({ message: "ERROR: relation public.secret does not exist" });
    expect(msg).not.toContain("secret");
    expect(msg).toBe("Une erreur est survenue. Réessayez dans un instant.");
    expect(authErrorMessage(undefined)).toBe("Une erreur est survenue. Réessayez dans un instant.");
  });

  it("valide les adresses e-mail", () => {
    expect(isValidEmail("nom@exemple.fr")).toBe(true);
    expect(isValidEmail("  nom@exemple.fr ")).toBe(true);
    expect(isValidEmail("nom@exemple")).toBe(false);
    expect(isValidEmail("nom exemple.fr")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("pages publiques", () => {
  it("n'ouvre sans compte que l'identification et les sources", () => {
    expect(isPublicPath("/connexion")).toBe(true);
    expect(isPublicPath("/sources")).toBe(true);
    expect(isPublicPath("/reinitialiser")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/hifz/session")).toBe(false);
    expect(isPublicPath("/reglages")).toBe(false);
    expect(isPublicPath("/connexionx")).toBe(false);
    expect(isAuthPath("/connexion")).toBe(true);
    expect(isAuthPath("/sources")).toBe(false);
  });
});

describe("contrôleur de synchronisation", () => {
  let db: HifzDB | null = null;
  afterEach(async () => {
    vi.useRealTimers();
    await db?.delete();
    db = null;
  });
  const fresh = () => {
    db = createDb(`ctl-${Math.random()}`, { trackChanges: true });
    return db;
  };

  it("passe en « hors ligne » sur une erreur réseau puis se rétablit", async () => {
    const d = fresh();
    const remote = new FakeRemote();
    const ctl = new SyncController(d, remote);
    await addProgram(d, { surah: 1, from: 1, to: 2 });
    remote.failNext = new SyncError("offline", "Réseau indisponible.");
    await ctl.syncNow();
    expect(ctl.getStatus()).toMatchObject({ state: "offline", message: "Réseau indisponible." });
    expect(await d.outbox.count()).toBeGreaterThan(0);
    await ctl.syncNow();
    expect(ctl.getStatus().state).toBe("idle");
    expect(ctl.getStatus().lastSyncAt).not.toBeNull();
    expect(await d.outbox.count()).toBe(0);
    ctl.dispose();
  });

  it("signale une session expirée", async () => {
    const d = fresh();
    const remote = new FakeRemote();
    const ctl = new SyncController(d, remote);
    remote.failNext = new SyncError("auth", "Session expirée : reconnectez-vous.");
    await ctl.syncNow();
    expect(ctl.getStatus().state).toBe("auth");
    ctl.dispose();
  });

  it("ne lance qu'une synchronisation à la fois et rejoue une passe si des demandes arrivent entre-temps", async () => {
    const d = fresh();
    const remote = new FakeRemote();
    let inFlight = 0;
    let maxInFlight = 0;
    const origPull = remote.pull.bind(remote);
    remote.pull = async (...args) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return origPull(...args);
    };
    const ctl = new SyncController(d, remote);
    await Promise.all([ctl.syncNow(), ctl.syncNow(), ctl.syncNow()]);
    expect(maxInFlight).toBe(1);
    ctl.dispose();
  });

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("regroupe les modifications rapprochées en une seule synchronisation", async () => {
    const d = fresh();
    const remote = new FakeRemote();
    let pulls = 0;
    const origPull = remote.pull.bind(remote);
    remote.pull = async (...args) => {
      pulls++;
      return origPull(...args);
    };
    const ctl = new SyncController(d, remote, { debounceMs: 30 });
    ctl.request();
    ctl.request();
    ctl.request();
    expect(pulls).toBe(0);
    await wait(250);
    expect(pulls).toBe(4); // une seule synchronisation : une lecture par table
    ctl.dispose();
  });

  it("une modification locale déclenche seule un envoi planifié", async () => {
    const d = fresh();
    const remote = new FakeRemote();
    const ctl = new SyncController(d, remote, { debounceMs: 30 });
    await addProgram(d, { surah: 112, from: 1, to: 4 });
    expect(remote.tables.programs.size).toBe(0);
    await wait(400);
    expect(remote.tables.programs.size).toBe(1);
    expect(remote.tables.cards.size).toBe(4);
    ctl.dispose();
  });
});
