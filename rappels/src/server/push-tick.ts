// Planificateur des rappels (côté serveur) : appelé chaque minute, envoie les rappels dus par Web Push.
// Pur et testable : la base et l'envoi sont injectés (voir tests/push-tick.test.ts).
import { buildSlotNotification } from "@/lib/notification-text";
import { addDays, dateKey, notificationSlots, serviceDate, visiblePlan } from "@/lib/service";
import type { Task } from "@/lib/types";

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type Target = {
  userId: string;
  schedule: string | null;
  subs: PushSub[];
  tasks: Task[];
  /** Clés « tâche@journée » déjà cochées. */
  done: Set<string>;
};
export type TickDb = {
  loadTargets(serviceDates: string[]): Promise<Target[]>;
  /** Réserve un créneau : true si c'est le premier à le faire (donc le seul qui enverra). */
  claim(userId: string, taskId: string, serviceDate: string, slotAtIso: string): Promise<boolean>;
  removeSubscription(endpoint: string): Promise<void>;
};
export type SendResult = "ok" | "gone" | "error";
export type PushPayload = { title: string; body: string; tag: string; url: string };
export type Sender = (sub: PushSub, payload: PushPayload) => Promise<SendResult>;

/** Un rappel en retard de plus de 5 minutes n'est plus envoyé (le cron a pu sauter une minute, pas plus). */
export const GRACE_MS = 5 * 60_000;

export type TickResult = { checked: number; sent: number; skippedDone: number; duplicates: number; removedSubs: number };

export async function runTick(now: Date, db: TickDb, send: Sender): Promise<TickResult> {
  // Journée en cours + précédente : un rappel de 01h30 appartient à la journée de la veille.
  const today = serviceDate(now);
  const days = [addDays(today, -1), today];
  const targets = await db.loadTargets(days.map(dateKey));
  const result: TickResult = { checked: 0, sent: 0, skippedDone: 0, duplicates: 0, removedSubs: 0 };

  for (const t of targets) {
    if (t.subs.length === 0) continue;
    for (const sDate of days) {
      for (const p of visiblePlan(t.tasks, sDate, t.schedule)) {
        const done = t.done.has(p.key);
        for (const slot of notificationSlots(p.task, sDate)) {
          const late = now.getTime() - slot.at.getTime();
          if (late < 0 || late >= GRACE_MS) continue; // pas encore l'heure, ou trop tard
          result.checked++;
          if (done && p.task.untilDone) {
            result.skippedDone++;
            continue;
          }
          // On réserve le créneau AVANT d'envoyer : si deux appels se chevauchent, un seul peut envoyer.
          const first = await db.claim(t.userId, p.task.id, dateKey(sDate), slot.at.toISOString());
          if (!first) {
            result.duplicates++;
            continue;
          }
          const { title, body } = buildSlotNotification(p.task, slot.ext);
          const payload: PushPayload = { title, body, tag: p.key, url: "/" };
          for (const sub of t.subs) {
            const r = await send(sub, payload);
            if (r === "ok") result.sent++;
            else if (r === "gone") {
              await db.removeSubscription(sub.endpoint); // appareil désinscrit ou app désinstallée
              result.removedSubs++;
            }
          }
        }
      }
    }
  }
  return result;
}
