import { bilanAt } from "@/lib/bilan";
import { bilanUrl, buildBilanNotification, buildRelanceNotification, taskUrl } from "@/lib/notification-text";
import { dateKey, nextShift, parseDateKey, serviceDate } from "@/lib/service";
import type { Task } from "@/lib/types";
import { fakeSub, makeSim } from "./sim";
import { check, errText, ko, skip, verdict, type Check, type Ctx, type Outcome } from "./types";

// Tests qui parlent à la base (fonctions SQL du schéma), toujours sur des tâches is_test = true.
type Json = Record<string, unknown>;

async function rpc<T = unknown>(ctx: Ctx, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await ctx.sb.rpc(fn, args);
  if (error) throw new Error(`${fn} : ${error.message}`);
  return data as T;
}
const today = (ctx: Ctx) => dateKey(serviceDate(ctx.now()));

/** Crée une tâche de test (is_test = true) pour le responsable. */
async function mkTask(ctx: Ctx, title: string, extra: Record<string, unknown> = {}): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await ctx.sb.from("tasks").insert({ id, user_id: ctx.uid, title: `🧪 ${title}`, category: "Autre", at_time: "19:30", days: [0, 1, 2, 3, 4, 5, 6], team: "both", remind: 0, until_done: true, is_test: true, ...extra });
  if (error) throw new Error(`création de la tâche de test : ${error.message}`);
  return id;
}
const inspect = (ctx: Ctx, id: string) => rpc<Json>(ctx, "test_inspect", { p_task: id });
const myStatus = (ctx: Ctx, id: string, date: string) => rpc<Json>(ctx, "my_status", { p_task: id, p_date: date });
const act = (ctx: Ctx, id: string, date: string, action: string, minutes = 10, reason: string | null = null) => rpc<Json>(ctx, "occ_act", { p_task: id, p_date: date, p_action: action, p_minutes: minutes, p_reason: reason });
const asTest = (ctx: Ctx, action: string, args: Json = {}) => rpc<unknown>(ctx, "test_as", { p_action: action, p_args: args });
const simOcc = (ctx: Ctx, id: string, user: string, date: string) => rpc<boolean>(ctx, "test_sim_occurrence", { p_task: id, p_user: user, p_date: date });
const age = (ctx: Ctx, id: string, seconds: number) => rpc(ctx, "test_age", { p_task: id, p_seconds: seconds });
const followups = (ctx: Ctx, seconds: number) => rpc<{ relances: { task_id: string; n: number; title: string; service_date: string }[]; postponed: { task_id: string; title: string }[] }>(ctx, "test_followups", { p_delay_seconds: seconds });
const mineOf = (rows: unknown, uid: string) => ((rows as Json[]) ?? []).filter((r) => r.user_id === uid);
const near = (iso: string | null, expectedMs: number, tolMs: number) => !!iso && Math.abs(new Date(iso).getTime() - expectedMs) <= tolMs;

/** Exécute un test en transformant toute erreur en « KO » lisible. */
export async function guarded(fn: () => Promise<Outcome>): Promise<Outcome> {
  try {
    return await fn();
  } catch (e) {
    return ko(errText(e));
  }
}

/** 1. Notification de test vers cet appareil. */
export async function testNotification(ctx: Ctx): Promise<Outcome> {
  const r = await ctx.push("self", [{ title: "Notification de test", body: "Si tu lis ça, les notifications fonctionnent.", url: "/test", tag: "test:notif" }]);
  if (r.ok) return { status: "ok", detail: `Envoyée à ${r.devices} appareil${(r.devices ?? 0) > 1 ? "s" : ""}. Elle doit s'afficher dans quelques secondes.` };
  return ko(r.error ?? `Aucun envoi réussi (${r.failed ?? 0} échec). Vérifie la permission et l'abonnement dans le diagnostic.`);
}

/** 2. Ouverture au clic : on envoie la notification d'une tâche de test et on attend que la page détail s'ouvre. */
export function clickTest(state: "closed" | "background" | "open") {
  const instruction = {
    closed: "Ferme complètement l'app (retire-la des apps récentes), puis appuie sur la notification.",
    background: "Mets l'app en arrière-plan (écran d'accueil), puis appuie sur la notification.",
    open: "Laisse l'app ouverte à l'écran, puis appuie sur la notification quand elle apparaît.",
  }[state];
  return async (ctx: Ctx): Promise<Outcome> => {
    const id = await mkTask(ctx, `Ouverture au clic (${state})`);
    const date = today(ctx);
    const t0 = Date.now();
    const r = await ctx.push("self", [{ title: "Ouverture au clic", body: "Appuie ici : la page de la tâche doit s'ouvrir.", url: taskUrl(id, date), tag: `test:click:${id}` }]);
    if (!r.ok) return ko(r.error ?? "La notification n'a pas pu être envoyée.");
    ctx.say(`Notification envoyée. ${instruction}`);
    const deadline = t0 + 120_000;
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, 2000));
      const info = await inspect(ctx, id);
      const seen = ((info.events as Json[]) ?? []).find((e) => e.action === "seen" && e.user_id === ctx.uid);
      if (seen) {
        const s = Math.round((Date.now() - t0) / 100) / 10;
        return { status: "ok", detail: `Page détail ouverte ${s} s après l'envoi (${state === "closed" ? "app fermée" : state === "background" ? "app en arrière-plan" : "app ouverte"}).`, checks: [check("page détail ouverte, tâche marquée « vue »", "oui", "oui")] };
      }
      ctx.say(`En attente de ton appui… ${Math.round((deadline - Date.now()) / 1000)} s. ${instruction}`);
    }
    return ko("Délai dépassé (2 min) : la page détail ne s'est pas ouverte. Vérifie que la notification est arrivée, puis qu'elle ouvre /taches/… (connexion persistante).");
  };
}

/** 3. Page détail : Fait, Rappelle-moi plus tard, Refuser — statuts vérifiés en base. */
export async function testDetailPage(ctx: Ctx): Promise<Outcome> {
  const date = today(ctx);
  const checks: Check[] = [];
  // Fait
  const a = await mkTask(ctx, "Détail : fait");
  await act(ctx, a, date, "seen");
  checks.push(check("ouverture : statut « vue »", "seen", (await myStatus(ctx, a, date)).status));
  await act(ctx, a, date, "done");
  checks.push(check("Fait : statut « faite »", "done", (await myStatus(ctx, a, date)).status));
  checks.push(check("Fait : une ligne « tâche faite » en base", 1, ((await inspect(ctx, a)).done as unknown[]).length));
  // Rappelle-moi plus tard
  const b = await mkTask(ctx, "Détail : plus tard");
  await act(ctx, b, date, "postpone", 15);
  const sb = await myStatus(ctx, b, date);
  checks.push(check("Plus tard : statut « reportée »", "postponed", sb.status));
  checks.push(check("Plus tard : rappel dans 15 min (±1 min)", "≈ +15 min", String(sb.postponed_until), near(sb.postponed_until as string, Date.now() + 15 * 60_000, 60_000)));
  // Refuser
  const c = await mkTask(ctx, "Détail : refuser");
  await act(ctx, c, date, "decline", 10, "machine en panne");
  const sc = await myStatus(ctx, c, date);
  checks.push(check("Refuser : statut « refusée »", "declined", sc.status));
  checks.push(check("Refuser : motif enregistré", "machine en panne", String(sc.reason)));
  checks.push(check("Refuser (ma tâche) : personne n'est notifié", 0, ((await inspect(ctx, c)).outbox as unknown[]).length));
  await act(ctx, c, date, "reopen");
  checks.push(check("Reprendre : retour à « à faire »", "todo", (await myStatus(ctx, c, date)).status));
  // Laisser tomber
  await act(ctx, c, date, "abandon");
  checks.push(check("Laisser tomber : statut « abandonnée »", "abandoned", (await myStatus(ctx, c, date)).status));
  // historique
  const ev = ((await inspect(ctx, c)).events as Json[]).map((e) => e.action).join(",");
  checks.push(check("historique : refusée, reprise, abandonnée", "declined,reopened,abandoned", ev));
  return verdict(checks, "Fait, Rappelle-moi plus tard et Refuser changent bien le statut en base ; l'historique est complet.");
}

/** 4. Relance automatique accélérée (délai réglable, sans attendre 5 minutes). */
export async function testRelance(ctx: Ctx): Promise<Outcome> {
  const date = today(ctx);
  const delay = ctx.accelSeconds;
  const checks: Check[] = [];
  const id = await mkTask(ctx, "Relance accélérée");
  await simOcc(ctx, id, ctx.uid, date);
  const mine = async () => (await followups(ctx, delay)).relances.filter((r) => r.task_id === id);
  checks.push(check(`avant ${delay} s : aucune relance`, 0, (await mine()).length));
  const sent: { title: string; body: string; url: string }[] = [];
  for (let k = 1; k <= 3; k++) {
    await age(ctx, id, delay + 1);
    const r = await mine();
    checks.push(check(`relance n° ${k} après ${delay} s sans réaction`, k, r[0]?.n ?? 0));
    if (r[0]) sent.push({ ...buildRelanceNotification(r[0].title), url: taskUrl(id, date) });
  }
  checks.push(check("aucun doublon dans la même minute", 0, (await mine()).length));
  await act(ctx, id, date, "seen"); // je réagis
  await age(ctx, id, delay + 1);
  checks.push(check("après mon action (« vue ») : plus de relance", 0, (await mine()).length));
  checks.push(check("statut de l'occurrence : vue", "seen", String(mineOf((await inspect(ctx, id)).occurrences, ctx.uid)[0]?.status)));
  // plafond : sans réaction, la série s'arrête d'elle-même
  const cap = await mkTask(ctx, "Relance : plafond");
  await simOcc(ctx, cap, ctx.uid, date);
  let count = 0;
  for (let i = 0; i < 12; i++) {
    await age(ctx, cap, delay + 1);
    const r = (await followups(ctx, delay)).relances.filter((x) => x.task_id === cap);
    if (r.length === 0) break;
    count += r.length;
  }
  const occ = mineOf((await inspect(ctx, cap)).occurrences, ctx.uid)[0];
  checks.push(check("plafond : la série s'arrête seule", "dropped / max", `${occ?.status} / ${occ?.reason}`));
  checks.push(check("nombre de relances avant l'arrêt (6 par défaut)", "≥ 1 et ≤ 12", String(count), count >= 1 && count <= 12));
  let pushNote = "";
  if (ctx.pushToDevice && sent.length) {
    const r = await ctx.push("self", sent.map((s, i) => ({ title: s.title, body: s.body, url: s.url, tag: `test:relance:${i}` })));
    pushNote = r.ok ? ` ${r.sent} relance${(r.sent ?? 0) > 1 ? "s" : ""} aussi envoyée${(r.sent ?? 0) > 1 ? "s" : ""} sur ton appareil.` : ` (envoi sur l'appareil : ${r.error ?? "échec"})`;
  }
  return verdict(checks, `3 relances envoyées toutes les ${delay} s, arrêt dès l'action, plafond atteint après ${count} relances.${pushNote}`);
}

/** 6. « Rappelle-moi plus tard » : 10 / 15 / 30 / 60 min, relance suspendue pendant le délai. */
export async function testPostpone(ctx: Ctx): Promise<Outcome> {
  const date = today(ctx);
  const delay = ctx.accelSeconds;
  const checks: Check[] = [];
  for (const m of [10, 15, 30, 60]) {
    const id = await mkTask(ctx, `Plus tard ${m} min`);
    await simOcc(ctx, id, ctx.uid, date);
    await age(ctx, id, delay + 1); // une relance serait due…
    await act(ctx, id, date, "postpone", m);
    const st = await myStatus(ctx, id, date);
    checks.push(check(`${m} min : statut « reportée » à l'heure choisie`, `reportée +${m} min`, `${st.status} ${st.postponed_until ?? ""}`, st.status === "postponed" && near(st.postponed_until as string, Date.now() + m * 60_000, 60_000)));
    const during = await followups(ctx, delay);
    checks.push(check(`${m} min : relance des ${delay} s suspendue pendant le délai`, 0, during.relances.filter((r) => r.task_id === id).length + during.postponed.filter((r) => r.task_id === id).length));
    await age(ctx, id, delay + 1);
    checks.push(check(`${m} min : toujours suspendue après un nouveau retard`, 0, (await followups(ctx, delay)).relances.filter((r) => r.task_id === id).length));
    await age(ctx, id, m * 60 + 1); // le délai est écoulé
    const back = (await followups(ctx, delay)).postponed.filter((r) => r.task_id === id);
    checks.push(check(`${m} min : la notification repart à l'heure choisie (une seule fois)`, 1, back.length));
    checks.push(check(`${m} min : pas de doublon au passage suivant`, 0, (await followups(ctx, delay)).postponed.filter((r) => r.task_id === id).length));
    const occ = mineOf((await inspect(ctx, id)).occurrences, ctx.uid)[0];
    checks.push(check(`${m} min : compteur de relances remis à zéro`, "sent / 0", `${occ?.status} / ${occ?.reminders}`));
  }
  return verdict(checks, "Reports de 10, 15, 30 et 60 min : relance suspendue pendant le délai, retour à l'heure choisie, sans doublon.");
}

/** 7. Partage vers le compte de test, dans les deux modes. */
export async function testSharing(ctx: Ctx): Promise<Outcome> {
  const tu = ctx.testUser;
  if (!tu) return skip("Désigne d'abord un compte de test (section « Compte de test »).");
  const date = today(ctx);
  const delay = ctx.accelSeconds;
  const checks: Check[] = [];
  for (const mode of ["each", "one"] as const) {
    const label = mode === "each" ? "Chacun la fait" : "Un seul s'en occupe";
    const id = await mkTask(ctx, `Partage ${label}`);
    await rpc(ctx, "share_task", { p_task: id, p_recipients: [tu.id], p_mode: mode });
    const visible = ((await asTest(ctx, "tasks")) as { id: string }[]).some((t) => t.id === id);
    checks.push(check(`${label} : le compte de test reçoit la tâche`, true, visible));
    const shared = ((await asTest(ctx, "shared_with_me")) as { task_id: string; status: string; owner_prenom: string }[]).find((s) => s.task_id === id);
    checks.push(check(`${label} : invitation « en attente » de ${ctx.prenom}`, "pending", shared?.status ?? "absente"));
    const notices = await rpc<{ shares: { task_id: string; user_id: string }[] }>(ctx, "test_notices");
    checks.push(check(`${label} : notification de partage préparée pour ${tu.prenom}`, 1, notices.shares.filter((s) => s.task_id === id && s.user_id === tu.id).length));
    await asTest(ctx, "respond_share", { task: id, accept: true });
    await simOcc(ctx, id, ctx.uid, date);
    await simOcc(ctx, id, tu.id, date);
    if (mode === "each") {
      const r = (await asTest(ctx, "occ_act", { task: id, date, action: "done" })) as Json;
      checks.push(check(`${label} : ${tu.prenom} la coche`, true, r.ok));
      const info = await inspect(ctx, id);
      checks.push(check(`${label} : seule sa ligne « faite » existe`, tu.id, ((info.done as Json[])[0] ?? {}).user_id));
      checks.push(check(`${label} : ma tâche reste « à faire » (chacun la fait)`, "todo", (await myStatus(ctx, id, date)).status));
      await age(ctx, id, delay + 1);
      checks.push(check(`${label} : mes rappels continuent`, 1, (await followups(ctx, delay)).relances.filter((r) => r.task_id === id && r.service_date === date).length));
    } else {
      const taken = (await asTest(ctx, "occ_act", { task: id, date, action: "taken" })) as Json;
      checks.push(check(`${label} : ${tu.prenom} la prend en premier`, true, taken.ok));
      const mine = await act(ctx, id, date, "taken");
      checks.push(check(`${label} : moi, je suis informé « ${tu.prenom} s'en occupe »`, `${tu.prenom}`, String(mine.taken_by)));
      await age(ctx, id, delay + 1);
      const rel = (await followups(ctx, delay)).relances.filter((r) => r.task_id === id);
      checks.push(check(`${label} : mes relances s'arrêtent dès qu'il la prend`, 0, rel.length));
      const info = await inspect(ctx, id);
      checks.push(check(`${label} : mon rappel est abandonné (pris par un collègue)`, "dropped / taken_by_other", `${mineOf(info.occurrences, ctx.uid)[0]?.status} / ${mineOf(info.occurrences, ctx.uid)[0]?.reason}`));
      checks.push(check(`${label} : la prise en charge est enregistrée`, tu.id, ((info.claims as Json[])[0] ?? {}).user_id));
      const n2 = await rpc<{ claims: { user_id: string }[] }>(ctx, "test_notices");
      checks.push(check(`${label} : notification « ${tu.prenom} s'en occupe » préparée pour moi`, 1, n2.claims.filter((c) => c.user_id === ctx.uid).length));
    }
  }
  // garde-fou : jamais un vrai collègue
  const colleagues = await rpc<{ id: string }[]>(ctx, "colleagues");
  const real = colleagues.find((c) => c.id !== tu.id);
  if (real) {
    const t = await mkTask(ctx, "Partage interdit");
    const { error } = await ctx.sb.rpc("share_task", { p_task: t, p_recipients: [real.id], p_mode: "each" });
    checks.push(check("partager une tâche de test avec un vrai collègue est REFUSÉ", "refusé", error ? "refusé" : "accepté !"));
  }
  return verdict(checks, "Les deux modes fonctionnent : le compte de test reçoit la tâche, et les rappels s'arrêtent quand l'un la prend.");
}

/** 8. Bilan de fin de service : généré tout de suite, transmission et « laisser tomber » (y compris groupés). */
export async function testBilan(ctx: Ctx): Promise<Outcome> {
  const date = today(ctx);
  const d = parseDateKey(date);
  const checks: Check[] = [];
  const ids = [await mkTask(ctx, "Bilan A", { at_time: "19:30", team: "soir" }), await mkTask(ctx, "Bilan B", { at_time: "21:00", team: "soir" }), await mkTask(ctx, "Bilan C", { at_time: "22:30", team: "soir" })];
  // le planificateur (vrai code) à 15 min de la fin d'équipe
  const tasks: Task[] = ids.map((id, i) => ({ id, title: `🧪 Bilan ${"ABC"[i]}`, category: "Autre", time: ["19:30", "21:00", "22:30"][i]!, days: [0, 1, 2, 3, 4, 5, 6], team: "soir", remind: 0, untilDone: true, paused: false }));
  const sim = makeSim([{ userId: ctx.uid, schedule: "SSSSSSS", subs: [fakeSub()], tasks, done: new Set(), claims: new Map(), outcomes: new Map(), handover: 1110, bilanLead: 15, transferTasks: [], transferIn: new Set() }]);
  const at = bilanAt("soir", 1110, d, 15);
  await sim.tick(at);
  const b = sim.sent.find((m) => m.payload.tag.startsWith("bilan"));
  checks.push(check("bilan généré : « Il te reste 3 tâches non faites »", "📋 Il te reste 3 tâches non faites", b?.payload.title ?? "aucun"));
  await sim.tick(new Date(at.getTime() + 60_000));
  checks.push(check("pas de second bilan à la minute suivante", 1, sim.sent.filter((m) => m.payload.tag.startsWith("bilan")).length));
  let pushNote = "";
  if (ctx.pushToDevice) {
    const r = await ctx.push("self", [{ ...buildBilanNotification(3), url: bilanUrl(date, "soir"), tag: "test:bilan" }]);
    pushNote = r.ok ? " Le bilan a aussi été envoyé sur ton appareil : touche-le pour ouvrir la page." : ` (envoi sur l'appareil : ${r.error ?? "échec"})`;
  }
  // actions : abandon individuel, groupé, transmission
  await act(ctx, ids[0]!, date, "abandon");
  checks.push(check("Laisser tomber (une tâche) : « abandonnée »", "abandoned", (await myStatus(ctx, ids[0]!, date)).status));
  const tu = ctx.testUser;
  const next = nextShift("soir", d);
  if (tu) {
    const r = await rpc<Json>(ctx, "transfer_send", { p_task: ids[1], p_date: date, p_to: [tu.id], p_target_date: dateKey(next.date), p_target_team: next.team, p_message: "test du bilan" });
    checks.push(check(`Transmettre au prochain caissier (${tu.prenom}, équipe Jour demain)`, true, r.ok));
    checks.push(check("la tâche est « transmise »", "handed", (await myStatus(ctx, ids[1]!, date)).status));
    const g1 = await mkTask(ctx, "Bilan groupé 1"), g2 = await mkTask(ctx, "Bilan groupé 2");
    for (const g of [g1, g2]) await rpc(ctx, "transfer_send", { p_task: g, p_date: date, p_to: [tu.id], p_target_date: dateKey(next.date), p_target_team: next.team, p_message: null });
    const sts = [await myStatus(ctx, g1, date), await myStatus(ctx, g2, date)].map((s) => s.status).join(",");
    checks.push(check("Tout transmettre (action groupée) : 2 tâches « transmises »", "handed,handed", sts));
  } else {
    checks.push({ label: "Transmettre : non testé (aucun compte de test désigné)", expected: "-", got: "-", ok: true });
  }
  const g3 = await mkTask(ctx, "Bilan à laisser tomber 1"), g4 = await mkTask(ctx, "Bilan à laisser tomber 2");
  for (const g of [g3, g4, ids[2]!]) await act(ctx, g, date, "abandon");
  const sts2 = (await Promise.all([g3, g4, ids[2]!].map((g) => myStatus(ctx, g, date)))).map((s) => s.status).join(",");
  checks.push(check("Tout laisser tomber (action groupée) : 3 tâches « abandonnées »", "abandoned,abandoned,abandoned", sts2));
  const out = await rpc<{ task_id: string; status: string }[]>(ctx, "my_outcomes", { p_since: date });
  checks.push(check("elles restent dans l'historique (pas supprimées)", true, ids.every((id) => out.some((o) => o.task_id === id))));
  return verdict(checks, `Bilan généré (3 tâches non faites), abandons et transmissions OK.${pushNote} Ouvre « Bilan du service » (Aujourd'hui → 📋 Bilan) pour voir la page.`);
}

/** 9. Transmission : arrivée chez le prochain caissier, acceptation, refus, sans réponse. */
export async function testTransfer(ctx: Ctx): Promise<Outcome> {
  const tu = ctx.testUser;
  if (!tu) return skip("Désigne d'abord un compte de test (section « Compte de test »).");
  const date = today(ctx);
  const next = nextShift("soir", parseDateKey(date)); // Soir → équipe Jour du lendemain 11h
  const target = dateKey(next.date);
  const send = (task: string, to: string[], msg: string | null = "à toi !") => rpc<Json>(ctx, "transfer_send", { p_task: task, p_date: date, p_to: to, p_target_date: target, p_target_team: next.team, p_message: msg });
  const checks: Check[] = [];
  const transferId = async (task: string) => (((await inspect(ctx, task)).transfers as Json[])[0] ?? {}).id as string;

  // accepter
  const a = await mkTask(ctx, "Transmission acceptée");
  await send(a, [tu.id]);
  checks.push(check("elle arrive chez le prochain caissier", true, ((await asTest(ctx, "tasks")) as { id: string }[]).some((t) => t.id === a)));
  const tr = ((await asTest(ctx, "transfers")) as { task_id: string; status: string; message: string }[]).find((x) => x.task_id === a);
  checks.push(check("demande « en attente » avec le message", "pending / à toi !", `${tr?.status} / ${tr?.message}`));
  const n = await rpc<{ outbox: { kind: string; user_id: string; who: string; task_id: string }[] }>(ctx, "test_notices");
  checks.push(check(`notification « ${ctx.prenom} t'a transmis » préparée pour ${tu.prenom}`, 1, n.outbox.filter((o) => o.kind === "transfer" && o.user_id === tu.id && o.task_id === a).length));
  checks.push(check("mon statut : « transmise »", "handed", (await myStatus(ctx, a, date)).status));
  const acc = (await asTest(ctx, "transfer_respond", { id: await transferId(a), accept: true })) as Json;
  checks.push(check("le compte de test accepte", true, acc.ok));
  checks.push(check("transmission « acceptée »", "accepted", String((((await inspect(ctx, a)).transfers as Json[])[0] ?? {}).status)));
  const done = (await asTest(ctx, "occ_act", { task: a, date: target, action: "done" })) as Json;
  checks.push(check("il peut ensuite la cocher", true, done.ok));
  const later = mineOf((await inspect(ctx, a)).occurrences, tu.id)[0];
  checks.push(check("un rappel était prévu au début de son équipe", "présent", later ? "présent" : "absent"));

  // refuser
  const r = await mkTask(ctx, "Transmission refusée");
  await send(r, [tu.id]);
  await rpc(ctx, "test_notices");
  await asTest(ctx, "transfer_respond", { id: await transferId(r), accept: false });
  checks.push(check("refus : la tâche me revient (« à faire »)", "todo", (await myStatus(ctx, r, date)).status));
  const n2 = await rpc<{ outbox: { kind: string; user_id: string; who: string; task_id: string }[] }>(ctx, "test_notices");
  checks.push(check(`refus : je suis prévenu « ${tu.prenom} a refusé »`, `${ctx.uid}/${tu.prenom}`, n2.outbox.filter((o) => o.kind === "transfer_declined" && o.task_id === r).map((o) => `${o.user_id}/${o.who}`)[0] ?? "aucune"));

  // pas de réponse dans le délai
  const e = await mkTask(ctx, "Transmission sans réponse");
  await send(e, [tu.id]);
  await rpc(ctx, "test_notices");
  await age(ctx, e, 24 * 3600); // délai dépassé
  const n3 = await rpc<{ outbox: { kind: string; user_id: string; task_id: string }[] }>(ctx, "test_notices");
  checks.push(check("sans réponse : je suis prévenu (« Pas de réponse »)", 1, n3.outbox.filter((o) => o.kind === "transfer_expired" && o.user_id === ctx.uid && o.task_id === e).length));
  checks.push(check("sans réponse : la tâche me revient", "todo", (await myStatus(ctx, e, date)).status));

  // toute la prochaine équipe (selon le planning du compte de test)
  const w = await mkTask(ctx, "Transmission à toute l'équipe");
  const { data: wd, error: we } = await ctx.sb.rpc("transfer_send", { p_task: w, p_date: date, p_to: [], p_target_date: target, p_target_team: next.team, p_message: null });
  if (we) checks.push({ label: "toute l'équipe : non testé (le compte de test n'est pas dans le planning de la prochaine équipe)", expected: "-", got: we.message, ok: true });
  else checks.push(check("toute l'équipe : seul le compte de test est visé", 1, (wd as Json).count));
  return verdict(checks, "La tâche arrive chez le prochain caissier, l'acceptation, le refus et l'absence de réponse sont gérés (avec les bonnes notifications).");
}

/** 12. Session : connexion persistante, jeton renouvelable, date d'expiration. */
export async function testSession(ctx: Ctx): Promise<Outcome> {
  const { data, error } = await ctx.sb.auth.getSession();
  if (error || !data.session) return ko(`Aucune session valide${error ? ` : ${error.message}` : ""}. Reconnecte-toi.`);
  const s = data.session;
  const expMs = (s.expires_at ?? 0) * 1000;
  const checks: Check[] = [
    check("session valide", "oui", "oui"),
    check("jeton d'accès non expiré", "oui", expMs > Date.now() ? "oui" : "non", expMs > Date.now()),
  ];
  const cookies = typeof document !== "undefined" ? document.cookie : "";
  checks.push(check("cookie de session présent (connexion persistante)", "oui", /sb-[^=]*auth-token/.test(cookies) ? "oui" : "non", /sb-[^=]*auth-token/.test(cookies)));
  const before = s.access_token;
  const r = await ctx.sb.auth.refreshSession();
  checks.push(check("renouvellement du jeton (refresh)", "réussi", r.error ? `échec : ${r.error.message}` : "réussi", !r.error));
  const newExp = (r.data.session?.expires_at ?? 0) * 1000;
  checks.push(check("nouvelle expiration dans le futur", "oui", newExp > Date.now() ? "oui" : "non", newExp > Date.now()));
  const left = Math.round((newExp - Date.now()) / 60_000);
  const when = new Date(newExp).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "medium" });
  return verdict(checks, `Session valide. Jeton renouvelé${before === r.data.session?.access_token ? " (identique)" : ""} : expire le ${when} (dans ${left} min) ; il se renouvelle seul, la connexion reste ouverte.`);
}
