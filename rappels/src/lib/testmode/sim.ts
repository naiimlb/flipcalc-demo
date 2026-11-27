import type { PushPayload, PushSub, Target, TickDb, TickResult } from "@/server/push-tick";
import { runTick } from "@/server/push-tick";

// Planificateur SIMULÉ : le vrai code (runTick) est exécuté sur des données de test, avec l'horloge du test et une base
// en mémoire. Rien n'est envoyé à personne : on récupère les notifications que le planificateur aurait envoyées.
export type SentMessage = { at: Date; userId: string; payload: PushPayload };

export function makeSim(targets: Target[]) {
  const claimed = new Set<string>();
  const bilans = new Set<string>();
  const sent: SentMessage[] = [];
  let current = new Date();
  let who = "";
  const db: TickDb = {
    loadTargets: async () => targets,
    claim: async (userId, taskId, day, slot) => {
      const k = `${userId}|${taskId}|${day}|${slot}`;
      if (claimed.has(k)) return false;
      claimed.add(k);
      return true;
    },
    removeSubscription: async () => undefined,
    followups: async () => ({ relances: [], postponed: [] }),
    notices: async () => ({ shares: [], claims: [], outbox: [] }),
    bilanClaim: async (userId, date, team) => {
      const k = `${userId}|${date}|${team}`;
      if (bilans.has(k)) return false;
      bilans.add(k);
      return true;
    },
    bilanReminders: async () => [],
  };
  const send = async (_sub: PushSub, payload: PushPayload) => {
    sent.push({ at: current, userId: who, payload });
    return "ok" as const;
  };
  return {
    sent,
    db,
    /** Un passage du planificateur à l'instant `at`. */
    async tick(at: Date): Promise<TickResult> {
      current = at;
      who = targets[0]?.userId ?? "";
      return runTick(at, db, send);
    },
    /** Plusieurs passages simultanés (course) au même instant. */
    async tickParallel(at: Date, n: number) {
      current = at;
      who = targets[0]?.userId ?? "";
      return Promise.all(Array.from({ length: n }, () => runTick(at, db, send)));
    },
  };
}

export const fakeSub = (n = 1): PushSub => ({ endpoint: `https://sim.invalid/${n}`, p256dh: "k", auth: "a" });
