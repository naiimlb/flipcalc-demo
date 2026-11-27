import { dateKey, myTeam, planForService, sortKey, teamEndAt, teamEndExt, teamRange, type PlannedTask, type Team } from "./service";
import type { OccStatus, Outcome, Task } from "./types";

// Bilan de fin de service : quelles tâches restent à faire à la fin de mon équipe ? Même calcul côté serveur
// (notification « Il te reste X tâches non faites ») et côté app (page « Bilan du service »).
export type BilanInput = {
  /** Mes tâches + celles partagées + celles qu'on m'a transmises (marquées transferOnly). */
  tasks: Task[];
  uid: string;
  handover: number;
  /** Clés « tâche@journée » des tâches transmises que j'ai acceptées. */
  transferIn: ReadonlySet<string>;
  isDone: (key: string) => boolean;
  /** Collègue qui a pris la tâche (mode « un seul s'en occupe »). */
  holder: (key: string) => string | undefined;
  outcome: (key: string) => string | undefined;
};

/**
 * Tâches non faites de la journée `sDate` pour l'équipe `team` : ni faites, ni refusées, ni transmises, ni abandonnées,
 * ni prises par un collègue. Une tâche d'équipe « les deux » ne compte que si son heure tombe pendant MON équipe ;
 * une tâche partagée ou transmise compte toujours.
 */
export function pendingTasks(c: BilanInput, sDate: Date, team: Team): PlannedTask[] {
  const [from, to] = teamRange(team, c.handover);
  return planForService(c.tasks, sDate, c.transferIn).filter((p) => {
    if (c.isDone(p.key) || c.outcome(p.key)) return false;
    const h = c.holder(p.key);
    if (h && h !== c.uid) return false;
    if (p.task.shareStatus !== undefined || p.task.transferOnly) return true;
    if (p.task.team !== "both" && p.task.team !== team) return false;
    const k = sortKey(p.task.time);
    return k >= from && k <= to;
  });
}

/** Instant où l'on envoie le bilan : fin de l'équipe moins X minutes. */
export function bilanAt(team: Team, handover: number, sDate: Date, leadMin: number): Date {
  return new Date(teamEndAt(team, handover, sDate).getTime() - leadMin * 60_000);
}

/** La journée de service est-elle finie pour moi ? (équipe Jour : relève ; Soir ou planning absent : 2h.) */
export function shiftOver(now: Date, sDate: Date, schedule: string | null, handover: number): boolean {
  const team = myTeam(schedule, sDate) ?? "soir";
  return now.getTime() >= teamEndAt(team, handover, sDate).getTime();
}

/** Statut d'une occurrence dans l'historique : « non faite » quand la fin d'équipe est passée sans rien. */
export function historyStatus(args: { done: boolean; outcome?: Outcome; over: boolean }): OccStatus {
  if (args.done) return "done";
  if (args.outcome) return args.outcome.status;
  return args.over ? "missed" : "todo";
}

export { dateKey, teamEndExt };
