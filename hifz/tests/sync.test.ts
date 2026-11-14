import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { exportBackup, importBackup, parseBackup } from "@/lib/storage/backup";
import { createDb, type HifzDB } from "@/lib/storage/db";
import { addProgram, recordGrade, removeProgram, updateSettings } from "@/lib/storage/repository";
import { isLocalEmpty, syncOnce } from "@/lib/sync/engine";
import { SyncError } from "@/lib/sync/types";
import { FakeRemote } from "./helpers/fake-remote";

let n = 0;
const open: HifzDB[] = [];
const device = (name = `dev-${n++}`) => {
  const db = createDb(name, { trackChanges: true });
  open.push(db);
  return db;
};
afterEach(async () => {
  await Promise.all(open.splice(0).map((db) => db.delete()));
});

const T = (h: number, d = 1) => new Date(`2026-06-0${d}T${String(h).padStart(2, "0")}:00:00.000Z`);

describe("synchronisation entre appareils", () => {
  it("un second appareil retrouve exactement les données du premier", async () => {
    const remote = new FakeRemote();
    const a = device();
    await updateSettings(a, { reciter: "Husary_128kbps", dailyNewLimit: 5 }, T(8));
    await addProgram(a, { surah: 1, from: 1, to: 7 }, T(8));
    await recordGrade(a, "1:1", "good", T(9));
    await recordGrade(a, "1:2", "again", T(9));
    const result = await syncOnce(a, remote, T(10));
    expect(result.pushed).toBeGreaterThan(0);
    expect(await a.outbox.count()).toBe(0);

    const b = device();
    await syncOnce(b, remote, T(11));
    expect(await exportBackup(b, T(12))).toEqual(await exportBackup(a, T(12)));
    expect((await b.cards.get("1:1"))?.state).toBe("learning");
    expect(await b.reviews.count()).toBe(2);
  });

  it("une deuxième synchronisation n'envoie plus rien et ne duplique rien", async () => {
    const remote = new FakeRemote();
    const a = device();
    await addProgram(a, { surah: 112, from: 1, to: 4 }, T(8));
    await recordGrade(a, "112:1", "good", T(9));
    await syncOnce(a, remote, T(10));
    const again = await syncOnce(a, remote, T(11));
    expect(again.pushed).toBe(0);
    expect(await a.reviews.count()).toBe(1);
    expect(await a.cards.count()).toBe(4);
  });

  it("deux appareils modifient le même verset : la modification la plus récente gagne partout", async () => {
    const remote = new FakeRemote();
    const a = device();
    const b = device();
    await addProgram(a, { surah: 1, from: 1, to: 3 }, T(8));
    await syncOnce(a, remote, T(8));
    await syncOnce(b, remote, T(8));

    await recordGrade(a, "1:1", "good", T(9)); // appareil A à 9 h
    await recordGrade(b, "1:1", "again", T(10)); // appareil B à 10 h, plus récent
    await syncOnce(a, remote, T(11));
    await syncOnce(b, remote, T(11));
    await syncOnce(a, remote, T(12));

    const [ca, cb] = [await a.cards.get("1:1"), await b.cards.get("1:1")];
    expect(ca).toEqual(cb);
    expect(ca?.lastGrade).toBe("again");
    // Les deux révisions sont conservées dans le journal.
    expect(await a.reviews.count()).toBe(2);
    expect(await b.reviews.count()).toBe(2);
  });

  it("une modification locale plus récente n'est pas écrasée par une version distante plus ancienne", async () => {
    const remote = new FakeRemote();
    const a = device();
    const b = device();
    await addProgram(a, { surah: 1, from: 1, to: 2 }, T(8));
    await recordGrade(a, "1:1", "hard", T(9));
    await syncOnce(a, remote, T(9));

    await syncOnce(b, remote, T(10));
    await recordGrade(b, "1:1", "good", T(11, 2)); // le lendemain, pas encore envoyé
    await syncOnce(b, remote, T(12, 2));
    expect((await b.cards.get("1:1"))?.lastGrade).toBe("good");
    await syncOnce(a, remote, T(13, 2));
    expect((await a.cards.get("1:1"))?.lastGrade).toBe("good");
  });

  it("la suppression d'un programme se propage et garde les versets déjà appris", async () => {
    const remote = new FakeRemote();
    const a = device();
    const b = device();
    const { program } = await addProgram(a, { surah: 2, from: 1, to: 4 }, T(8));
    await recordGrade(a, "2:1", "good", T(8));
    await syncOnce(a, remote, T(9));
    await syncOnce(b, remote, T(9));
    expect(await b.cards.count()).toBe(4);

    await removeProgram(a, program.id, T(10));
    await syncOnce(a, remote, T(10));
    await syncOnce(b, remote, T(11));
    expect(await b.programs.count()).toBe(0);
    expect((await b.cards.toArray()).map((c) => c.key)).toEqual(["2:1"]);
  });

  it("une suppression locale reste supprimée si le serveur n'a qu'une version plus ancienne", async () => {
    const remote = new FakeRemote();
    const a = device();
    const b = device();
    const { program } = await addProgram(a, { surah: 112, from: 1, to: 4 }, T(8));
    await syncOnce(a, remote, T(8));
    await syncOnce(b, remote, T(9));
    await removeProgram(b, program.id, T(10)); // supprimé hors ligne sur B
    await syncOnce(b, remote, T(11));
    await syncOnce(a, remote, T(12));
    expect(await a.programs.count()).toBe(0);
    expect(await a.cards.count()).toBe(0);
  });

  it("un échec réseau ne perd rien : la file reste en place puis part au passage suivant", async () => {
    const remote = new FakeRemote();
    const a = device();
    await addProgram(a, { surah: 1, from: 1, to: 2 }, T(8));
    await recordGrade(a, "1:1", "good", T(9));
    const queued = await a.outbox.count();
    expect(queued).toBeGreaterThan(0);

    remote.failNext = new SyncError("offline", "Réseau indisponible.");
    await expect(syncOnce(a, remote, T(10))).rejects.toMatchObject({ kind: "offline" });
    expect(await a.outbox.count()).toBe(queued);
    expect(await a.cards.count()).toBe(2);

    // Échec pendant l'envoi : même chose.
    await syncOnce(device(), remote, T(10)); // appareil tiers, sans effet
    remote.failNext = null;
    await syncOnce(a, remote, T(11));
    expect(await a.outbox.count()).toBe(0);
    expect(remote.tables.cards.size).toBe(2);
  });

  it("une modification pendant la synchronisation n'est pas perdue", async () => {
    const remote = new FakeRemote();
    const a = device();
    await addProgram(a, { surah: 1, from: 1, to: 2 }, T(8));
    await syncOnce(a, remote, T(8));
    await recordGrade(a, "1:1", "good", T(9));
    const sync = syncOnce(a, remote, T(10));
    await recordGrade(a, "1:2", "good", T(10)); // pendant la synchro
    await sync;
    await syncOnce(a, remote, T(11));
    expect(remote.tables.cards.get("1:2")?.data?.lastGrade).toBe("good");
    expect(await a.outbox.count()).toBe(0);
  });

  it("ignore les lignes distantes invalides au lieu de les appliquer", async () => {
    const remote = new FakeRemote();
    remote.tables.cards.set("1:1", { key: "1:1", data: { key: "1:99", surah: 1, ayah: 99 }, deleted: false, serverUpdatedAt: "2027-01-01T00:00:00.000Z" });
    remote.tables.cards.set("9:9", { key: "9:9", data: null, deleted: false, serverUpdatedAt: "2027-01-01T00:00:01.000Z" });
    remote.tables.reviews.set("x", { key: "x", data: { key: "1:1", day: "pas-un-jour", grade: "good", at: "2026-01-01T00:00:00.000Z" }, deleted: false, serverUpdatedAt: "2027-01-01T00:00:02.000Z" });
    const a = device();
    const r = await syncOnce(a, remote, T(8));
    expect(r.skipped).toBe(3);
    expect(await a.cards.count()).toBe(0);
    expect(await a.reviews.count()).toBe(0);
  });

  it("l'import d'une sauvegarde remplace aussi les données des autres appareils", async () => {
    const remote = new FakeRemote();
    const a = device();
    const b = device();
    await addProgram(a, { surah: 2, from: 1, to: 3 }, T(8));
    await syncOnce(a, remote, T(8));
    await syncOnce(b, remote, T(9));

    const source = device();
    await addProgram(source, { surah: 112, from: 1, to: 4 }, T(9));
    await recordGrade(source, "112:1", "good", T(9));
    const parsed = parseBackup(JSON.stringify(await exportBackup(source, T(9))));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    await importBackup(a, parsed.backup, T(10));
    await syncOnce(a, remote, T(10));
    await syncOnce(b, remote, T(11));
    expect((await b.cards.toArray()).map((c) => c.key).sort()).toEqual(["112:1", "112:2", "112:3", "112:4"]);
    expect((await b.programs.toArray()).map((p) => p.surah)).toEqual([112]);
    expect(await b.reviews.count()).toBe(1);
  });

  it("sans suivi des modifications (mode local), rien n'est mis en file", async () => {
    const db = createDb(`local-${n++}`);
    open.push(db);
    await addProgram(db, { surah: 1, from: 1, to: 2 });
    await recordGrade(db, "1:1", "good");
    expect(await db.outbox.count()).toBe(0);
  });

  it("détecte une base locale vide", async () => {
    const a = device();
    expect(await isLocalEmpty(a)).toBe(true);
    await addProgram(a, { surah: 1, from: 1, to: 2 });
    expect(await isLocalEmpty(a)).toBe(false);
  });
});

describe("migration de l'ancienne base", () => {
  it("ajoute horodatages et identifiants sans perdre de données", async () => {
    const name = `legacy-${n++}`;
    const old = new Dexie(name);
    old.version(1).stores({
      cards: "key, state, due, surah, rank, introduced",
      reviews: "++id, day, key",
      programs: "id, seq",
      settings: "id",
      surahs: "number",
    });
    await old.table("cards").add({ key: "1:1", surah: 1, ayah: 1, rank: 1001, state: "learning", ease: 2.6, interval: 1, reps: 1, lapses: 0, due: "2026-03-02", lastReview: "2026-03-01", lastGrade: "good", introduced: "2026-03-01" });
    await old.table("reviews").bulkAdd([
      { key: "1:1", day: "2026-03-01", grade: "good", at: "2026-03-01T08:00:00.000Z" },
      { key: "1:1", day: "2026-03-02", grade: "hard", at: "2026-03-02T08:00:00.000Z" },
    ]);
    await old.table("programs").add({ id: "p1", surah: 1, from: 1, to: 7, seq: 1, createdAt: "2026-03-01T07:00:00.000Z" });
    old.close();

    const db = createDb(name);
    open.push(db);
    const card = await db.cards.get("1:1");
    expect(card?.interval).toBe(1);
    expect(card?.updatedAt).toBe("1970-01-01T00:00:00.000Z");
    expect((await db.programs.get("p1"))?.updatedAt).toBe("1970-01-01T00:00:00.000Z");
    const reviews = await db.reviews.toArray();
    expect(reviews).toHaveLength(2);
    expect(new Set(reviews.map((r) => r.rid)).size).toBe(2);
    // L'export reste inchangé (aucun champ interne).
    const backup = await exportBackup(db, T(8));
    expect(backup.data.cards[0]).not.toHaveProperty("updatedAt");
    expect(backup.data.reviews[0]).not.toHaveProperty("rid");
  });
});
