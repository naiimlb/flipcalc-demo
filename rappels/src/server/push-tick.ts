// Planificateur des rappels (côté serveur) : appelé chaque minute, envoie les rappels dus par Web Push,
// les relances quand personne n'a réagi, les tâches reportées et les notifications de partage.
// Pur et testable : la base et l'envoi sont injectés (voir tests/push-tick.test.ts).
import {
  buildClaimNotification,
  buildPostponedNotification,
  buildRelanceNotification,
  buildShareNotification,
  buildSlotNotification,
  taskUrl,
} from "@/lib/notification-text";
import { addDays, dateKey, notificationSlots, serviceDate, visiblePlan } from "@/lib/service";
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
};
/** Un message à envoyer à tous les appareils d'une personne (le texte est composé ici, pas en base). */
export type Notice = {
  userId: string;
  subs: PushSub[];
  taskId: string;
  /** Journée de service concernée (absente pour une invitation de partage). */
  serviceDate?: string;
  /** Titre de la tâche. */
  title: string;
  /** Prénom de l'autre personne (qui partage, ou qui s'en occupe). */
  who?: string;
};
export type Followups = { relances: Notice[]; postponed: Notice[] };
export type Notices = { shares: Notice[]; claims: Notice[] };
export type TickDb = {
  loadTargets(serviceDates: string[]): Promise<Target[]>;
  /** Réserve un créneau : true si c'est le premier à le faire (donc le seul qui enverra). */
  claim(userId: string, taskId: string, serviceDate: string, slotAtIso: string): Promise<boolean>;
  removeSubscription(endpoint: string): Promise<void>;
  /** Relances à envoyer maintenant (déjà « réservées » en base : chacune ne sort qu'une fois) et tâches reportées qui reviennent. */
  followups(): Promise<Followups>;
  /** Notifications de partage et « un collègue s'en occupe » à envoyer (chacune ne sort qu'une fois). */
  notices(): Promise<Notices>;
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
  duplicates: number;
  removedSubs: number;
  relances: number;
  postponed: number;
  shares: number;
  claims: number;
};

export async function runTick(now: Date, db: TickDb, send: Sender): Promise<TickResult> {
  // Journée en cours + précédente : un rappel de 01h30 appartient à la journée de la veille.
  const today = serviceDate(now);
  const days = [addDays(today, -1), today];
  const targets = await db.loadTargets(days.map(dateKey));
  const result: TickResult = { checked: 0, sent: 0, skippedDone: 0, skippedClaimed: 0, duplicates: 0, removedSubs: 0, relances: 0, postponed: 0, shares: 0, claims: 0 };

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
    const { title, body } = buildPostponedNotification(n.title);
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
  return result;
}
