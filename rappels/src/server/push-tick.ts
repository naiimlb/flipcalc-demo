// Planificateur des rappels (côté serveur) : appelé chaque minute, envoie les rappels dus par Web Push,
// les relances quand personne n'a réagi, les tâches reportées et les notifications de partage.
// Pur et testable : la base et l'envoi sont injectés (voir tests/push-tick.test.ts).
import { bilanAt, pendingTasks } from "@/lib/bilan";
import {
  bilanUrl,
  buildBilanNotification,
  buildClaimNotification,
  buildDeclinedNotification,
  buildPostponedNotification,
  buildRelanceNotification,
  buildShareNotification,
  buildSlotNotification,
  buildTransferExpiredNotification,
  buildTransferNotification,
  buildTransferStartNotification,
  taskUrl,
} from "@/lib/notification-text";
import { addDays, dateKey, myTeam, notificationSlots, parseDateKey, serviceDate, teamEndAt, visiblePlan } from "@/lib/service";
import type { Task } from "@/lib/types";

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type Target = {
  userId: string;
  schedule: string | null;
  subs: PushSub[];
  /** Mes tâches + celles qu'on m'a partagées et que j'ai acceptées. */
  tasks: Task[];
  /** Clés « tâche@journée » déjà cochées. */
  done: Set<string>;
  /** Mode « un seul s'en occupe » : clé « tâche@journée » → collègue qui l'a prise. */
  claims: Map<string, string>;
  /** Refusée / transmise / abandonnée : clé « tâche@journée » → statut. Plus aucun rappel pour ces tâches. */
  outcomes: Map<string, string>;
  /** Heure de relève de la personne (1080 ou 1110) : fin de l'équipe Jour. */
  handover: number;
  /** Envoyer le bilan X minutes avant la fin de l'équipe. */
  bilanLead: number;
  /** Tâches qu'un collègue m'a transmises et que j'ai acceptées (marquées transferOnly), pour le bilan. */
  transferTasks: Task[];
  /** Clés « tâche@journée » de ces tâches. */
  transferIn: Set<string>;
};
/** Un message à envoyer à tous les appareils d'une personne (le texte est composé ici, pas en base). */
export type Notice = {
  userId: string;
  subs: PushSub[];
  taskId: string;
  /** Journée de service concernée (absente pour une invitation de partage). */
  serviceDate?: string;
  /** Pourquoi une tâche reportée revient : « transfer » = le début de mon équipe, pour une tâche transmise. */
  why?: string | null;
  /** Événement de la boîte d'envoi : refus, transmission reçue, transmission refusée, sans réponse. */
  kind?: string;
  /** Motif ou message. */
  detail?: string | null;
  /** Titre de la tâche. */
  title: string;
  /** Prénom de l'autre personne (qui partage, ou qui s'en occupe). */
  who?: string;
};
export type Followups = { relances: Notice[]; postponed: Notice[] };
export type Notices = { shares: Notice[]; claims: Notice[]; outbox: Notice[] };
/** Bilan de fin de service à relancer (le premier n'a pas été ouvert). */
export type BilanReminder = { userId: string; serviceDate: string; team: "jour" | "soir"; subs: PushSub[] };
export type TickDb = {
  loadTargets(serviceDates: string[]): Promise<Target[]>;
  /** Réserve un créneau : true si c'est le premier à le faire (donc le seul qui enverra). */
  claim(userId: string, taskId: string, serviceDate: string, slotAtIso: string): Promise<boolean>;
  removeSubscription(endpoint: string): Promise<void>;
  /** Relances à envoyer maintenant (déjà « réservées » en base : chacune ne sort qu'une fois) et tâches reportées qui reviennent. */
  followups(): Promise<Followups>;
  /** Notifications de partage, « un collègue s'en occupe », refus et transmissions (chacune ne sort qu'une fois). */
  notices(): Promise<Notices>;
  /** Réserve le bilan d'une personne (journée + équipe) : true la première fois seulement. */
  bilanClaim(userId: string, serviceDate: string, team: "jour" | "soir", remaining: number): Promise<boolean>;
  /** Seconds rappels du bilan à envoyer (10 min après le premier, bilan non ouvert) ; chacun ne sort qu'une fois. */
  bilanReminders(): Promise<BilanReminder[]>;
};
export type SendResult = "ok" | "gone" | "error";
export type PushPayload = { title: string; body: string; tag: string; url: string };
export type Sender = (sub: PushSub, payload: PushPayload) => Promise<SendResult>;

/** Un rappel en retard de plus de 5 minutes n'est plus envoyé (le cron a pu sauter une minute, pas plus). */
export const GRACE_MS = 5 * 60_000;

export type TickResult = {
  checked: number;
  sent: number;
  skippedDone: number;
  skippedClaimed: number;
  skippedOutcome: number;
  duplicates: number;
  removedSubs: number;
  relances: number;
  postponed: number;
  shares: number;
  claims: number;
  outbox: number;
  bilans: number;
  bilanReminders: number;
};

export async function runTick(now: Date, db: TickDb, send: Sender): Promise<TickResult> {
  // Journée en cours + précédente : un rappel de 01h30 appartient à la journée de la veille.
  const today = serviceDate(now);
  const days = [addDays(today, -1), today];
  const targets = await db.loadTargets(days.map(dateKey));
  const result: TickResult = { checked: 0, sent: 0, skippedDone: 0, skippedClaimed: 0, skippedOutcome: 0, duplicates: 0, removedSubs: 0, relances: 0, postponed: 0, shares: 0, claims: 0, outbox: 0, bilans: 0, bilanReminders: 0 };

  const deliver = async (subs: PushSub[], payload: PushPayload) => {
    let ok = 0;
    for (const sub of subs) {
      const r = await send(sub, payload);
      if (r === "ok") ok++;
      else if (r === "gone") {
        await db.removeSubscription(sub.endpoint); // appareil désinscrit ou app désinstallée
        result.removedSubs++;
      }
    }
    return ok;
  };

  for (const t of targets) {
    if (t.subs.length === 0) continue;
    for (const sDate of days) {
      for (const p of visiblePlan(t.tasks, sDate, t.schedule)) {
        const done = t.done.has(p.key);
        const holder = t.claims.get(p.key);
        for (const slot of notificationSlots(p.task, sDate)) {
          const late = now.getTime() - slot.at.getTime();
          if (late < 0 || late >= GRACE_MS) continue; // pas encore l'heure, ou trop tard
          result.checked++;
          if (done && p.task.untilDone) {
            result.skippedDone++;
            continue;
          }
          if (t.outcomes.has(p.key)) {
            result.skippedOutcome++; // refusée, transmise ou abandonnée : plus de rappel
            continue;
          }
          if (holder && holder !== t.userId) {
            result.skippedClaimed++; // un collègue s'en occupe déjà : inutile de me déranger
            continue;
          }
          // On réserve le créneau AVANT d'envoyer : si deux appels se chevauchent, un seul peut envoyer.
          const first = await db.claim(t.userId, p.task.id, dateKey(sDate), slot.at.toISOString());
          if (!first) {
            result.duplicates++;
            continue;
          }
          const { title, body } = buildSlotNotification(p.task, slot.ext);
          result.sent += await deliver(t.subs, { title, body, tag: p.key, url: taskUrl(p.task.id, dateKey(sDate)) });
        }
      }
    }
  }

  // Relances : personne n'a réagi (ni ouvert, ni Vu, ni Je m'en occupe, ni Fait, ni Reporter) après le délai réglé en base.
  const dayOf = (n: Notice) => n.serviceDate ?? dateKey(today);
  const f = await db.followups();
  for (const n of f.relances) {
    const { title, body } = buildRelanceNotification(n.title);
    result.relances += (await deliver(n.subs, { title, body, tag: `${n.taskId}@${dayOf(n)}`, url: taskUrl(n.taskId, dayOf(n)) })) > 0 ? 1 : 0;
  }
  for (const n of f.postponed) {
    const { title, body } = n.why === "transfer" ? buildTransferStartNotification(n.who ?? null, n.title) : buildPostponedNotification(n.title);
    result.postponed += (await deliver(n.subs, { title, body, tag: `${n.taskId}@${dayOf(n)}`, url: taskUrl(n.taskId, dayOf(n)) })) > 0 ? 1 : 0;
  }

  // Partages et « untel s'en occupe » (même étiquette que le rappel : la notification précédente est remplacée).
  const notices = await db.notices();
  for (const n of notices.shares) {
    const { title, body } = buildShareNotification(n.who ?? "Un collègue", n.title);
    result.shares += (await deliver(n.subs, { title, body, tag: `share:${n.taskId}`, url: taskUrl(n.taskId, dayOf(n)) })) > 0 ? 1 : 0;
  }
  for (const n of notices.claims) {
    const { title, body } = buildClaimNotification(n.who ?? "Un collègue", n.title);
    result.claims += (await deliver(n.subs, { title, body, tag: `${n.taskId}@${dayOf(n)}`, url: taskUrl(n.taskId, dayOf(n)) })) > 0 ? 1 : 0;
  }
  for (const n of notices.outbox) {
    const day = dayOf(n);
    let text: { title: string; body: string };
    let url = taskUrl(n.taskId, day);
    switch (n.kind) {
      case "transfer":
        text = buildTransferNotification(n.who ?? "Un collègue", n.title, n.detail);
        break;
      case "transfer_declined":
        text = buildDeclinedNotification(n.who ?? null, n.title);
        url = bilanUrl(day);
        break;
      case "transfer_expired":
        text = buildTransferExpiredNotification(n.who ?? null, n.title);
        url = bilanUrl(day);
        break;
      default:
        text = buildDeclinedNotification(n.who ?? "Un collègue", n.title, n.detail);
    }
    result.outbox += (await deliver(n.subs, { ...text, tag: `evt:${n.taskId}:${n.kind}`, url })) > 0 ? 1 : 0;
  }

  // Bilan de fin de service : « Il te reste X tâches non faites » (rien s'il ne reste rien), X minutes avant la fin de mon équipe.
  const bilanTaskInput = (t: Target) => ({
    tasks: [...t.tasks, ...t.transferTasks],
    uid: t.userId,
    handover: t.handover,
    transferIn: t.transferIn,
    isDone: (k: string) => t.done.has(k),
    holder: (k: string) => t.claims.get(k),
    outcome: (k: string) => t.outcomes.get(k),
  });
  for (const t of targets) {
    if (t.subs.length === 0) continue;
    for (const sDate of days) {
      const team = myTeam(t.schedule, sDate);
      if (!team) continue; // repos ou planning non indiqué : pas de bilan
      const nowMs = now.getTime();
      if (nowMs < bilanAt(team, t.handover, sDate, t.bilanLead).getTime() || nowMs >= teamEndAt(team, t.handover, sDate).getTime() + GRACE_MS) continue;
      const remaining = pendingTasks(bilanTaskInput(t), sDate, team).length;
      if (remaining === 0) continue; // rien à signaler : aucune notification
      if (!(await db.bilanClaim(t.userId, dateKey(sDate), team, remaining))) continue; // déjà envoyé
      const { title, body } = buildBilanNotification(remaining);
      result.bilans += (await deliver(t.subs, { title, body, tag: `bilan:${dateKey(sDate)}`, url: bilanUrl(dateKey(sDate), team) })) > 0 ? 1 : 0;
    }
  }
  // Second (et dernier) rappel : 10 minutes plus tard si le bilan n'a pas été ouvert, et seulement s'il reste des tâches.
  for (const r of await db.bilanReminders()) {
    const t = targets.find((x) => x.userId === r.userId);
    if (!t) continue;
    const remaining = pendingTasks(bilanTaskInput(t), parseDateKey(r.serviceDate), r.team).length;
    if (remaining === 0) continue;
    const { title, body } = buildBilanNotification(remaining, true);
    result.bilanReminders += (await deliver(r.subs.length ? r.subs : t.subs, { title, body, tag: `bilan:${r.serviceDate}`, url: bilanUrl(r.serviceDate, r.team) })) > 0 ? 1 : 0;
  }
  return result;
}
