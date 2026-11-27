import { cashTotals, computeGap, countCash, formatEuro, plural, toCents } from "@/lib/money";
import { cleanAmount, parseQuantity } from "@/lib/numeric";
import {
  dateKey,
  isAfterMidnight,
  nextShift,
  notificationSlots,
  occurrenceAt,
  parseDateKey,
  parisInstant,
  serviceDate,
  sortKey,
  teamEndAt,
  teamRange,
  visiblePlan,
} from "@/lib/service";
import type { Task } from "@/lib/types";
import { bilanAt, pendingTasks } from "@/lib/bilan";
import type { Target } from "@/server/push-tick";
import { fakeSub, makeSim } from "./sim";
import { check, verdict, type Check, type Ctx, type Outcome } from "./types";

const iso = (d: Date) => d.toISOString();
const baseTask = (extra: Partial<Task>): Task => ({ id: "sim-1", title: "Tâche simulée", category: "Autre", time: "12:00", days: [0, 1, 2, 3, 4, 5, 6], team: "both", remind: 0, untilDone: true, paused: false, ...extra });
const target = (tasks: Task[], extra: Partial<Target> = {}): Target => ({
  userId: "sim-user", schedule: null, subs: [fakeSub()], tasks, done: new Set(), claims: new Map(), outcomes: new Map(), handover: 1110, bilanLead: 15, transferTasks: [], transferIn: new Set(), ...extra,
});

/** 10. Calculette de caisse : quantités connues, résultats attendus calculés en centimes. */
export async function testCalculator(): Promise<Outcome> {
  // 3 × 20 € + 2 × 5 € = 70 € (5 billets) ; 4 × 0,50 € + 7 × 0,01 € = 2,07 € (11 pièces) ; total 72,07 €
  const lines = [
    { denomination: 2000, quantity: 3 },
    { denomination: 500, quantity: 2 },
    { denomination: 50, quantity: 4 },
    { denomination: 1, quantity: 7 },
  ];
  const t = cashTotals(lines);
  const rows = countCash(lines);
  const checks: Check[] = [
    check("total billets (centimes)", 3 * 2000 + 2 * 500, t.bills.total),
    check("nombre de billets", 5, t.bills.count),
    check("total pièces (centimes)", 4 * 50 + 7 * 1, t.coins.total),
    check("nombre de pièces", 11, t.coins.count),
    check("total caisse (centimes)", 7207, t.total),
    check("total caisse affiché", "72,07 €", formatEuro(t.total)),
    check("lignes comptées (les 0 sont ignorées)", 4, rows.rows.length),
    check("libellé d'une ligne", "3 × 20 € = 60,00 €", rows.rows[0]?.label ?? ""),
  ];
  // cas particuliers
  const big = cashTotals([{ denomination: 50000, quantity: 1 }, { denomination: 20000, quantity: 2 }, { denomination: 200, quantity: 9999 }]);
  checks.push(check("500 € + 2 × 200 € + 9999 × 2 € (centimes)", 50000 + 40000 + 1999800, big.total));
  checks.push(check("7 × 0,01 € sans erreur d'arrondi", "0,07 €", formatEuro(cashTotals([{ denomination: 1, quantity: 7 }]).total)));
  checks.push(check("0,10 € × 3 (les flottants donneraient 0,30000000000000004)", 30, cashTotals([{ denomination: 10, quantity: 3 }]).total));
  checks.push(check("saisie « 250,50 »", 25050, toCents("250,50")));
  checks.push(check("saisie « 12.5 € »", 1250, toCents("12.5 €")));
  checks.push(check("saisie illisible", null, toCents("abc")));
  checks.push(check("fond de caisse : écart 0", "exact", computeGap(7207, 7207).kind));
  checks.push(check("écart : manque de 0,93 €", "Manque de 0,93 €.", computeGap(7207, 7300).text));
  checks.push(check("écart : surplus de 0,01 €", "Surplus de 0,01 €.", computeGap(7208, 7207).text));
  checks.push(check("pluriel", "1 billet / 6 billets", `${plural(1, "billet")} / ${plural(6, "billet")}`));
  // saisie au clavier
  checks.push(check("quantité « 007 » → 7", 7, parseQuantity("007")));
  checks.push(check("quantité vide → 0", 0, parseQuantity("")));
  checks.push(check("quantité « 99999 » → 4 chiffres", 9999, parseQuantity("99999")));
  checks.push(check("montant « 250.5x » → « 250,5 »", "250,5", cleanAmount("250.5x")));
  return verdict(checks, `${checks.length} vérifications : billets 70,00 € (5), pièces 2,07 € (11), total 72,07 €.`);
}

/** 11. Journée de service 11h–2h : cas limites, attendu vs obtenu. */
export async function testServiceDay(ctx: Ctx): Promise<Outcome> {
  const sd = (isoUtc: string) => dateKey(serviceDate(new Date(isoUtc)));
  const checks: Check[] = [
    // une tâche après minuit appartient à la journée de la veille
    check("00h30 Paris (mardi) → journée du lundi", "2026-11-23", sd("2026-11-23T23:30:00Z")),
    check("01h30 Paris (mardi) → journée du lundi", "2026-11-23", sd("2026-11-24T00:30:00Z")),
    check("01h59 Paris → encore le lundi", "2026-11-23", sd("2026-11-24T00:59:00Z")),
    check("02h00 Paris → mardi", "2026-11-24", sd("2026-11-24T01:00:00Z")),
    check("10h59 Paris → mardi", "2026-11-24", sd("2026-11-24T09:59:00Z")),
    check("une tâche à 01h30 est « après minuit »", true, isAfterMidnight("01:30")),
    check("une tâche à 01h30 se classe après 23h00", true, sortKey("01:30") > sortKey("23:00")),
    check("tâche 01h30 du lundi tombe mardi 01h30 Paris (00h30 UTC)", "2026-11-24T00:30:00.000Z", iso(occurrenceAt({ time: "01:30" }, parseDateKey("2026-11-23")))),
    check("tâche 23h59 du lundi tombe lundi 23h59 Paris", "2026-11-23T22:59:00.000Z", iso(occurrenceAt({ time: "23:59" }, parseDateKey("2026-11-23")))),
    // relève à 18h00 / 18h30
    check("équipe Jour (relève 18h00) : 10h30 → 18h00", "630-1080", teamRange("jour", 1080).join("-")),
    check("équipe Soir (relève 18h00) : 18h00 → 01h59", "1080-1559", teamRange("soir", 1080).join("-")),
    check("équipe Jour (relève 18h30) : 10h30 → 18h30", "630-1110", teamRange("jour", 1110).join("-")),
    check("équipe Soir (relève 18h30) : 18h30 → 01h59", "1110-1559", teamRange("soir", 1110).join("-")),
    check("fin équipe Jour (18h30 hiver) = 17h30 UTC", "2026-11-23T17:30:00.000Z", iso(teamEndAt("jour", 1110, parseDateKey("2026-11-23")))),
    check("fin équipe Jour (18h00 hiver) = 17h00 UTC", "2026-11-23T17:00:00.000Z", iso(teamEndAt("jour", 1080, parseDateKey("2026-11-23")))),
    check("fin équipe Soir = 02h00 le lendemain (01h00 UTC)", "2026-11-24T01:00:00.000Z", iso(teamEndAt("soir", 1110, parseDateKey("2026-11-23")))),
    check("prochaine équipe du Jour : Soir le même jour", "soir 2026-11-23", (() => { const n = nextShift("jour", parseDateKey("2026-11-23")); return `${n.team} ${dateKey(n.date)}`; })()),
    check("prochaine équipe du Soir : Jour le lendemain", "jour 2026-11-24", (() => { const n = nextShift("soir", parseDateKey("2026-11-23")); return `${n.team} ${dateKey(n.date)}`; })()),
    // passage de minuit pour un planning
    check("équipe Soir voit une tâche 01h30 (« les deux »)", "oui", visiblePlan([baseTask({ time: "01:30", team: "both" })], parseDateKey("2026-11-23"), "S------").length ? "oui" : "non"),
    check("équipe Jour ne voit pas une tâche « soir »", "non", visiblePlan([baseTask({ team: "soir" })], parseDateKey("2026-11-23"), "J------").length ? "oui" : "non"),
    // heure d'été (dimanche 29 mars 2026 : 02h00 → 03h00) et d'hiver (dimanche 25 octobre 2026 : 03h00 → 02h00)
    check("été : 11h00 le 29/03 = 09h00 UTC (CEST)", "2026-03-29T09:00:00.000Z", iso(occurrenceAt({ time: "11:00" }, parseDateKey("2026-03-29")))),
    check("été : 11h00 le 28/03 = 10h00 UTC (CET)", "2026-03-28T10:00:00.000Z", iso(occurrenceAt({ time: "11:00" }, parseDateKey("2026-03-28")))),
    check("été : 01h30 la nuit du 28 au 29/03 = 00h30 UTC (CET)", "2026-03-29T00:30:00.000Z", iso(occurrenceAt({ time: "01:30" }, parseDateKey("2026-03-28")))),
    check("été : 02h00 n'existe pas le 29/03 → 03h00 CEST = 01h00 UTC", "2026-03-29T01:00:00.000Z", iso(teamEndAt("soir", 1110, parseDateKey("2026-03-28")))),
    check("été : relève 18h30 le 29/03 = 16h30 UTC (CEST)", "2026-03-29T16:30:00.000Z", iso(teamEndAt("jour", 1110, parseDateKey("2026-03-29")))),
    check("hiver : 01h30 la nuit du 24 au 25/10 = 23h30 UTC (CEST)", "2026-10-24T23:30:00.000Z", iso(occurrenceAt({ time: "01:30" }, parseDateKey("2026-10-24")))),
    check("hiver : fin de l'équipe Soir le 25/10 = 02h00 CET = 01h00 UTC", "2026-10-25T01:00:00.000Z", iso(teamEndAt("soir", 1110, parseDateKey("2026-10-24")))),
    check("hiver : 11h00 le 25/10 = 10h00 UTC (CET)", "2026-10-25T10:00:00.000Z", iso(occurrenceAt({ time: "11:00" }, parseDateKey("2026-10-25")))),
    check("parisInstant 2026-07-14 02h00 = 00h00 UTC (CEST)", "2026-07-14T00:00:00.000Z", iso(new Date(parisInstant(2026, 7, 14, 2, 0)))),
  ];
  const now = ctx.now();
  checks.push(check(`journée de service « maintenant » (${iso(now)})`, "une date valide", dateKey(serviceDate(now)), /^\d{4}-\d{2}-\d{2}$/.test(dateKey(serviceDate(now)))));
  return verdict(checks, `${checks.length} cas limites conformes (minuit, relève 18h00/18h30, heure d'été et d'hiver).`);
}

/** 5. Rappel répété : le planificateur (vrai code) sur une série, sans doublon ni oubli. */
export async function testRepeated(ctx: Ctx): Promise<Outcome> {
  const checks: Check[] = [];
  for (const cfg of [{ every: 30, end: "14:00", label: "toutes les 30 min" }, { every: 5, end: "12:30", label: "toutes les 5 min (accéléré)" }]) {
    const task = baseTask({ id: `rep-${cfg.every}`, time: "12:00", remind: 0, repeatEvery: cfg.every, endTime: cfg.end, untilDone: false });
    const sDate = parseDateKey("2026-11-23");
    const slots = notificationSlots(task, sDate);
    const sim = makeSim([target([task])]);
    const step = Math.max(5, ctx.stepSeconds) * 1000;
    const start = slots[0]!.at.getTime() - 5 * 60_000;
    const stop = slots[slots.length - 1]!.at.getTime() + 10 * 60_000;
    // le planificateur passe souvent (pas réglable) ET en double (course) pour provoquer des doublons
    for (let t = start; t <= stop; t += step) {
      if (Math.floor((t - start) / step) % 7 === 0) await sim.tickParallel(new Date(t), 3);
      else await sim.tick(new Date(t));
    }
    const got = sim.sent.map((m) => m.payload.body);
    const perSlot = slots.map((s) => sim.sent.filter((m) => m.at.getTime() >= s.at.getTime() && m.at.getTime() < s.at.getTime() + 5 * 60_000).length);
    checks.push(check(`${cfg.label} : nombre de rappels`, slots.length, got.length));
    checks.push(check(`${cfg.label} : exactement 1 par créneau (aucun doublon, aucun oubli)`, slots.map(() => 1).join(","), perSlot.join(",")));
    const late = sim.sent.filter((m) => slots.every((s) => m.at.getTime() - s.at.getTime() >= step + 60_000 || m.at.getTime() < s.at.getTime())).length;
    checks.push(check(`${cfg.label} : aucun rappel hors créneau`, 0, late));
  }
  // une tâche cochée arrête la série
  const task = baseTask({ id: "rep-done", time: "12:00", repeatEvery: 30, endTime: "14:00", untilDone: true });
  const slots = notificationSlots(task, parseDateKey("2026-11-23"));
  const sim = makeSim([target([task], { done: new Set(["rep-done@2026-11-23"]) })]);
  for (const s of slots) await sim.tick(new Date(s.at.getTime() + 5_000));
  checks.push(check("tâche cochée : plus aucun rappel", 0, sim.sent.length));
  return verdict(checks, `${checks.length} vérifications : un rappel par créneau, jamais deux, jamais oublié (planificateur passant toutes les ${ctx.stepSeconds} s, avec passages simultanés).`);
}

/** 13. Simulateur d'horloge : on déclenche une fin de service sans attendre, l'heure réelle n'est pas touchée. */
export async function testClock(ctx: Ctx): Promise<Outcome> {
  const checks: Check[] = [];
  const realBefore = Date.now();
  // lundi 23/11/2026 18h15 Paris = 17h15 UTC : 15 min avant la relève de 18h30
  const sDate = parseDateKey("2026-11-23");
  const task = baseTask({ id: "clk", time: "14:00", team: "jour", remind: 0 });
  const at = bilanAt("jour", 1110, sDate, 15);
  const sim = makeSim([target([task], { schedule: "J------" })]);
  await sim.tick(new Date(at.getTime() - 60_000));
  checks.push(check("1 min avant : pas de bilan", 0, sim.sent.filter((m) => m.payload.tag.startsWith("bilan")).length));
  await sim.tick(at);
  const b = sim.sent.find((m) => m.payload.tag.startsWith("bilan"));
  checks.push(check("à 18h15 simulées : bilan envoyé", "📋 Il te reste 1 tâche non faite", b?.payload.title ?? "aucun"));
  checks.push(check("lien du bilan", "/bilan?j=2026-11-23&e=jour", b?.payload.url ?? ""));
  await sim.tick(new Date(at.getTime() + 60_000));
  checks.push(check("1 min après : pas de doublon", 1, sim.sent.filter((m) => m.payload.tag.startsWith("bilan")).length));
  const sd = serviceDate(new Date("2026-11-24T00:30:00Z"));
  checks.push(check("à 01h30 simulée, la journée est celle de la veille", "2026-11-23", dateKey(sd)));
  checks.push(check("tâche du jour comptée dans le bilan", 1, pendingTasks({ tasks: [task], uid: "u", handover: 1110, transferIn: new Set(), isDone: () => false, holder: () => undefined, outcome: () => undefined }, sDate, "jour").length));
  const realAfter = Date.now();
  checks.push(check("l'heure réelle de l'app n'a pas bougé", "écart < 5 s", `${realAfter - realBefore} ms`, realAfter - realBefore < 5000));
  const sim2 = ctx.now();
  checks.push(check("horloge des tests", "date valide", iso(sim2), !Number.isNaN(sim2.getTime())));
  return verdict(checks, "Fin de service déclenchée à l'heure simulée (18h15) sans attendre ; l'heure réelle est intacte.");
}
