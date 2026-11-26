import { describe, expect, it } from "vitest";
import { buildSlotNotification } from "@/lib/notification-text";
import { runTick, type Followups, type Notice, type Notices, type PushPayload, type Sender, type Target, type TickDb } from "@/server/push-tick";
import type { Task } from "@/lib/types";

const task = (extra: Partial<Task>): Task => ({ id: "t1", title: "Sortir les poubelles", category: "Hygiène", time: "12:00", days: [0, 1, 2, 3, 4, 5, 6], team: "both", remind: 0, untilDone: true, paused: false, ...extra });
const sub = (n: number) => ({ endpoint: `https://push.example/${n}`, p256dh: "k", auth: "a" });

/** Fausse base : mémorise les créneaux réservés comme le ferait la clé primaire de push_sent. */
function fakeDb(targets: Target[], extra: { followups?: Followups; notices?: Notices } = {}) {
  const claimed = new Set<string>();
  const removed: string[] = [];
  const db: TickDb = {
    loadTargets: async () => targets,
    claim: async (_u, taskId, day, slot) => {
      const k = `${taskId}|${day}|${slot}`;
      if (claimed.has(k)) return false;
      claimed.add(k);
      return true;
    },
    removeSubscription: async (e) => void removed.push(e),
    followups: async () => extra.followups ?? { relances: [], postponed: [] },
    notices: async () => extra.notices ?? { shares: [], claims: [] },
  };
  return { db, claimed, removed };
}
const okSender = () => {
  const sent: { sub: string; payload: PushPayload }[] = [];
  const send: Sender = async (s, payload) => (sent.push({ sub: s.endpoint, payload }), "ok");
  return { send, sent };
};
const target = (tasks: Task[], extra: Partial<Target> = {}): Target => ({ userId: "u1", schedule: null, subs: [sub(1)], tasks, done: new Set(), claims: new Map(), ...extra });

// 2026-11-23 (lundi), heure de Paris = UTC + 1 l'hiver.
const at = (iso: string) => new Date(iso);

describe("planificateur de rappels (serveur)", () => {
  it("envoie le rappel à la minute prévue, avec le bon texte", async () => {
    const { db } = fakeDb([target([task({ time: "12:00" })])]);
    const { send, sent } = okSender();
    const r = await runTick(at("2026-11-23T11:00:20Z"), db, send); // 12h00 Paris
    expect(r.sent).toBe(1);
    expect(sent[0]!.payload).toMatchObject({ title: "⏰ Sortir les poubelles", body: "12h00 · Hygiène — c'est l'heure !", tag: "t1@2026-11-23", url: "/taches/t1?j=2026-11-23" });
  });

  it("n'envoie rien avant l'heure, ni plus de 5 min après", async () => {
    const { db } = fakeDb([target([task({ time: "12:00" })])]);
    const { send, sent } = okSender();
    await runTick(at("2026-11-23T10:59:00Z"), db, send); // 11h59
    await runTick(at("2026-11-23T11:06:00Z"), db, send); // 12h06 : trop tard
    expect(sent).toHaveLength(0);
  });

  it("ANTI-DOUBLON : le même rappel ne part qu'une fois, même si le planificateur passe plusieurs fois", async () => {
    const { db } = fakeDb([target([task({ time: "12:00" })])]);
    const { send, sent } = okSender();
    await runTick(at("2026-11-23T11:00:05Z"), db, send);
    await runTick(at("2026-11-23T11:01:05Z"), db, send); // le minuit suivant : encore dans la tolérance
    const r = await runTick(at("2026-11-23T11:02:05Z"), db, send);
    expect(sent).toHaveLength(1);
    expect(r.duplicates).toBe(1);
  });

  it("ANTI-DOUBLON : deux appels simultanés n'envoient qu'une fois", async () => {
    const { db } = fakeDb([target([task({ time: "12:00" })])]);
    const { send, sent } = okSender();
    await Promise.all([runTick(at("2026-11-23T11:00:05Z"), db, send), runTick(at("2026-11-23T11:00:06Z"), db, send)]);
    expect(sent).toHaveLength(1);
  });

  it("répétition toutes les 30 min : un envoi par créneau, jamais deux", async () => {
    const { db } = fakeDb([target([task({ time: "11:00", repeatEvery: 30, endTime: "12:00" })])]);
    const { send, sent } = okSender();
    for (const t of ["10:00", "10:15", "10:30", "10:31", "11:00", "11:20"]) await runTick(at(`2026-11-23T${t}:10Z`), db, send); // 11h00, 11h30, 12h00 Paris
    expect(sent.map((s) => s.payload.body)).toEqual(["11h00 · Hygiène — c'est l'heure !", "11h00 · Hygiène — toujours à faire (depuis 30 min) !", "11h00 · Hygiène — toujours à faire (depuis 60 min) !"]);
  });

  it("une tâche cochée arrête les rappels (option « jusqu'à ce que je coche »)", async () => {
    const t = task({ time: "11:00", repeatEvery: 30, endTime: "13:00", untilDone: true });
    const { db } = fakeDb([target([t])]);
    const { send, sent } = okSender();
    await runTick(at("2026-11-23T10:00:10Z"), db, send); // 11h00 : envoyé
    const done = fakeDb([target([t], { done: new Set(["t1@2026-11-23"]) })]);
    const r = await runTick(at("2026-11-23T10:30:10Z"), done.db, send); // 11h30 : cochée → rien
    expect(sent).toHaveLength(1);
    expect(r.skippedDone).toBe(1);
  });

  it("sans l'option, les rappels continuent même si la tâche est cochée", async () => {
    const t = task({ time: "11:00", repeatEvery: 30, endTime: "13:00", untilDone: false });
    const { db } = fakeDb([target([t], { done: new Set(["t1@2026-11-23"]) })]);
    const { send, sent } = okSender();
    await runTick(at("2026-11-23T10:30:10Z"), db, send);
    expect(sent).toHaveLength(1);
  });

  it("une tâche à 01h00 de la veille sonne à 01h00, et les répétitions passent minuit", async () => {
    const t = task({ time: "23:30", repeatEvery: 30, endTime: "01:00" });
    const { db } = fakeDb([target([t])]);
    const { send, sent } = okSender();
    for (const iso of ["2026-11-23T22:30:10Z", "2026-11-23T23:00:10Z", "2026-11-23T23:30:10Z", "2026-11-24T00:00:10Z"]) await runTick(at(iso), db, send); // 23h30, 00h00, 00h30, 01h00
    expect(sent).toHaveLength(4);
    expect(new Set(sent.map((s) => s.payload.tag))).toEqual(new Set(["t1@2026-11-23"])); // journée du lundi, même après minuit
  });

  it("respecte la pause, le planning (repos / autre équipe) et les réglages", async () => {
    const jour = task({ id: "j", team: "jour" });
    const soir = task({ id: "s", team: "soir" });
    const { send, sent } = okSender();
    const run = (t: Target) => runTick(at("2026-11-23T11:00:10Z"), fakeDb([t]).db, send);
    await run(target([task({ paused: true })])); // en pause (filtrée aussi côté base)
    await run(target([jour], { schedule: "S------" })); // lundi = Soir : tâche du jour ignorée
    await run(target([jour], { schedule: "R------" })); // repos
    expect(sent).toHaveLength(0);
    await run(target([jour, soir], { schedule: "J------" })); // équipe Jour : seulement « jour »
    expect(sent.map((s) => s.payload.tag)).toEqual(["j@2026-11-23"]);
  });

  it("supprime un abonnement expiré (410) et continue avec les autres appareils", async () => {
    const { db, removed } = fakeDb([target([task({ time: "12:00" })], { subs: [sub(1), sub(2)] })]);
    const sent: string[] = [];
    const send: Sender = async (s) => (s.endpoint.endsWith("/1") ? "gone" : (sent.push(s.endpoint), "ok"));
    const r = await runTick(at("2026-11-23T11:00:10Z"), db, send);
    expect(removed).toEqual(["https://push.example/1"]);
    expect(sent).toEqual(["https://push.example/2"]);
    expect(r.removedSubs).toBe(1);
  });

  it("heure d'hiver : un rappel à 01h30 la nuit du 24 au 25 octobre part à 01h30 heure de Paris (23h30 UTC)", async () => {
    const { db } = fakeDb([target([task({ time: "01:30" })])]);
    const { send, sent } = okSender();
    await runTick(at("2026-10-24T23:30:10Z"), db, send); // samedi 24 oct, 01h30 CEST du dimanche
    expect(sent).toHaveLength(1);
    expect(sent[0]!.payload.tag).toBe("t1@2026-10-24");
  });

  it("texte des rappels répétés : avant, à l'heure, après", () => {
    const t = task({ time: "12:00", remind: 10 });
    expect(buildSlotNotification(t, 710).body).toBe("12h00 · Hygiène — dans 10 min, prépare-toi !");
    expect(buildSlotNotification(t, 720).body).toBe("12h00 · Hygiène — c'est l'heure !");
    expect(buildSlotNotification(t, 750).body).toBe("12h00 · Hygiène — toujours à faire (depuis 30 min) !");
  });

  // ---------------------------------------------------------------- partage, relances ---
  const notice = (extra: Partial<Notice> = {}): Notice => ({ userId: "u1", subs: [sub(1)], taskId: "t1", serviceDate: "2026-11-23", title: "Sortir les poubelles", ...extra });

  it("mode « un seul » : si un collègue a pris la tâche, je ne reçois pas le rappel", async () => {
    const t = task({ time: "12:00", shareMode: "one", shareStatus: "accepted", sharedBy: "Léa" });
    const { send, sent } = okSender();
    const r1 = await runTick(at("2026-11-23T11:00:10Z"), fakeDb([target([t], { claims: new Map([["t1@2026-11-23", "u2"]]) })]).db, send);
    expect(sent).toHaveLength(0);
    expect(r1.skippedClaimed).toBe(1);
    // si c'est moi qui l'ai prise, je suis rappelé normalement
    await runTick(at("2026-11-23T11:00:10Z"), fakeDb([target([t], { claims: new Map([["t1@2026-11-23", "u1"]]) })]).db, send);
    expect(sent).toHaveLength(1);
  });

  it("une tâche partagée acceptée sonne même si elle est d'une autre équipe que la mienne", async () => {
    const soir = task({ id: "s", team: "soir", shareStatus: "accepted", sharedBy: "Léa" });
    const { send, sent } = okSender();
    await runTick(at("2026-11-23T11:00:10Z"), fakeDb([target([soir], { schedule: "J------" })]).db, send);
    expect(sent.map((x) => x.payload.tag)).toEqual(["s@2026-11-23"]);
  });

  it("une tâche partagée en attente ou refusée ne sonne pas", async () => {
    const { send, sent } = okSender();
    for (const shareStatus of ["pending", "declined"] as const) await runTick(at("2026-11-23T11:00:10Z"), fakeDb([target([task({ shareStatus, sharedBy: "Léa" })])]).db, send);
    expect(sent).toHaveLength(0);
  });

  it("relance : « Rappel : titre », même lien profond, un envoi par appareil", async () => {
    const { db } = fakeDb([], { followups: { relances: [notice({ subs: [sub(1), sub(2)] })], postponed: [] } });
    const { send, sent } = okSender();
    const r = await runTick(at("2026-11-23T11:05:10Z"), db, send);
    expect(r.relances).toBe(1);
    expect(sent.map((x) => x.sub)).toEqual(["https://push.example/1", "https://push.example/2"]);
    expect(sent[0]!.payload).toEqual({ title: "🔔 Rappel : Sortir les poubelles", body: "Touche pour ouvrir la tâche.", tag: "t1@2026-11-23", url: "/taches/t1?j=2026-11-23" });
  });

  it("tâche reportée qui revient", async () => {
    const { db } = fakeDb([], { followups: { relances: [], postponed: [notice()] } });
    const { send, sent } = okSender();
    const r = await runTick(at("2026-11-23T11:05:10Z"), db, send);
    expect(r.postponed).toBe(1);
    expect(sent[0]!.payload.title).toBe("⏱️ C'est reparti : Sortir les poubelles");
  });

  it("partage : « Prénom t'a partagé une tâche : titre » ouvre la tâche", async () => {
    const { db } = fakeDb([], { notices: { shares: [notice({ who: "Léa", serviceDate: undefined })], claims: [] } });
    const { send, sent } = okSender();
    const r = await runTick(at("2026-11-23T11:05:10Z"), db, send);
    expect(r.shares).toBe(1);
    expect(sent[0]!.payload).toMatchObject({ title: "Léa t'a partagé une tâche : Sortir les poubelles", url: "/taches/t1?j=2026-11-23", tag: "share:t1" });
  });

  it("un collègue s'en occupe : « Prénom s'en occupe : titre », même étiquette que le rappel (il le remplace)", async () => {
    const { db } = fakeDb([], { notices: { shares: [], claims: [notice({ who: "Tom" })] } });
    const { send, sent } = okSender();
    const r = await runTick(at("2026-11-23T11:05:10Z"), db, send);
    expect(r.claims).toBe(1);
    expect(sent[0]!.payload).toMatchObject({ title: "🙌 Tom s'en occupe : Sortir les poubelles", tag: "t1@2026-11-23" });
  });

  it("appareil expiré pendant une relance : abonnement supprimé", async () => {
    const { db, removed } = fakeDb([], { followups: { relances: [notice({ subs: [sub(1), sub(2)] })], postponed: [] } });
    const send: Sender = async (s) => (s.endpoint.endsWith("/1") ? "gone" : "ok");
    const r = await runTick(at("2026-11-23T11:05:10Z"), db, send);
    expect(removed).toEqual(["https://push.example/1"]);
    expect(r.relances).toBe(1); // l'autre appareil l'a reçue
  });
});
