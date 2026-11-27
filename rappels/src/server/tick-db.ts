import type { SupabaseClient } from "@supabase/supabase-js";
import { doneKey, rowToTask, type DoneRow, type TaskRow } from "@/lib/db-map";
import type { BilanReminder, Notice, Target, TickDb } from "./push-tick";

type SubRow = { user_id: string; endpoint: string; p256dh: string; auth_key: string };
type SettingRow = { user_id: string; notify: boolean; schedule: string | null; handover_min?: number; bilan_lead_min?: number };
type TickTask = TaskRow & { for_user?: string; shared?: boolean };
type TickData = {
  subs: SubRow[];
  settings: SettingRow[];
  tasks: TickTask[];
  done: (DoneRow & { user_id: string })[];
  claims?: { task_id: string; service_date: string; user_id: string }[];
  outcomes?: { task_id: string; service_date: string; user_id: string; status: string }[];
  transfers_in?: (TaskRow & { for_user: string; target_date: string })[];
};
type SubJson = { endpoint: string; p256dh: string; auth_key: string };
type NoticeRow = { user_id: string; task_id: string; service_date?: string; title: string; subs: SubJson[]; owner_prenom?: string; claimer_prenom?: string; who?: string | null; kind?: string; detail?: string | null; why?: string | null };
const toNotice = (r: NoticeRow): Notice => ({
  userId: r.user_id,
  taskId: r.task_id,
  serviceDate: r.service_date,
  title: r.title,
  who: r.owner_prenom ?? r.claimer_prenom ?? r.who ?? undefined,
  kind: r.kind,
  detail: r.detail,
  why: r.why,
  subs: (r.subs ?? []).map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth_key })),
});

/**
 * Accès base du planificateur. Passe par les fonctions SQL push_* de supabase/schema.sql, qui exigent le secret
 * partagé (CRON_SECRET) : aucune clé « service_role » n'est nécessaire.
 */
export function createTickDb(sb: SupabaseClient, secret: string): TickDb {
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.rpc(fn, { p_secret: secret, ...args });
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  };

  return {
    async loadTargets(serviceDates) {
      const d = await rpc<TickData>("push_tick_data", { p_dates: serviceDates });
      const muted = new Set(d.settings.filter((s) => !s.notify).map((s) => s.user_id));
      const schedule = new Map(d.settings.map((s) => [s.user_id, s.schedule]));
      const handover = new Map(d.settings.map((s) => [s.user_id, s.handover_min === 1080 ? 1080 : 1110]));
      const lead = new Map(d.settings.map((s) => [s.user_id, Number.isInteger(s.bilan_lead_min) ? (s.bilan_lead_min as number) : 15]));
      const byUser = new Map<string, Target>();
      for (const s of d.subs) {
        if (muted.has(s.user_id)) continue;
        if (!byUser.has(s.user_id)) byUser.set(s.user_id, { userId: s.user_id, schedule: schedule.get(s.user_id) ?? null, subs: [], tasks: [], done: new Set(), claims: new Map(), outcomes: new Map(), handover: handover.get(s.user_id) ?? 1110, bilanLead: lead.get(s.user_id) ?? 15, transferTasks: [], transferIn: new Set() });
        byUser.get(s.user_id)!.subs.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth_key });
      }
      for (const t of d.tasks) {
        const target = byUser.get(t.for_user ?? t.user_id);
        if (!target) continue;
        const task = rowToTask(t);
        // Tâche d'un collègue que j'ai acceptée : elle entre dans mon planning quelle que soit l'équipe.
        target.tasks.push(t.shared ? { ...task, shareStatus: "accepted" } : task);
      }
      for (const x of d.done) byUser.get(x.user_id)?.done.add(doneKey(x.task_id, x.service_date));
      for (const o of d.outcomes ?? []) byUser.get(o.user_id)?.outcomes.set(doneKey(o.task_id, o.service_date), o.status);
      for (const x of d.transfers_in ?? []) {
        const target = byUser.get(x.for_user);
        if (!target) continue;
        target.transferTasks.push({ ...rowToTask(x), transferOnly: true });
        target.transferIn.add(doneKey(x.id, x.target_date));
      }
      for (const c of d.claims ?? []) {
        const key = doneKey(c.task_id, c.service_date);
        for (const target of byUser.values()) target.claims.set(key, c.user_id);
      }
      return [...byUser.values()];
    },
    claim: (userId, taskId, serviceDate, slotAtIso) => rpc<boolean>("push_claim", { p_user: userId, p_task: taskId, p_date: serviceDate, p_slot: slotAtIso }),
    async removeSubscription(endpoint) {
      await rpc("push_remove_sub", { p_endpoint: endpoint });
    },
    async followups() {
      const r = await rpc<{ relances: NoticeRow[]; postponed: NoticeRow[] }>("push_followups", {});
      return { relances: (r.relances ?? []).map(toNotice), postponed: (r.postponed ?? []).map(toNotice) };
    },
    async notices() {
      const r = await rpc<{ shares: NoticeRow[]; claims: NoticeRow[]; outbox?: NoticeRow[] }>("push_notices", {});
      return { shares: (r.shares ?? []).map(toNotice), claims: (r.claims ?? []).map(toNotice), outbox: (r.outbox ?? []).map(toNotice) };
    },
    async anomaly(kind, userId, detail) {
      await rpc("push_log_anomaly", { p_kind: kind, p_user: userId, p_detail: detail });
    },
    bilanClaim: (userId, serviceDate, team, remaining) => rpc<boolean>("push_bilan_claim", { p_user: userId, p_date: serviceDate, p_team: team, p_remaining: remaining }),
    async bilanReminders() {
      const r = await rpc<{ user_id: string; service_date: string; team: string; subs: SubJson[] }[]>("push_bilan_reminders", {});
      return (r ?? []).map((x): BilanReminder => ({ userId: x.user_id, serviceDate: x.service_date, team: x.team === "jour" ? "jour" : "soir", subs: (x.subs ?? []).map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth_key })) }));
    },
  };
}

/** Nettoyage : les créneaux de plus de 3 jours ne servent plus à rien. */
export async function purgeOldClaims(sb: SupabaseClient, secret: string) {
  await sb.rpc("push_purge", { p_secret: secret });
}

/** Passage du planificateur : date, résultat et compteurs, pour l'écran « Mode test ». Ne doit jamais faire échouer le passage. */
export async function recordHeartbeat(sb: SupabaseClient, secret: string, result: unknown, error: string | null, delivered: number, failed: number) {
  try {
    await sb.rpc("push_heartbeat", { p_secret: secret, p_result: result ?? null, p_error: error, p_delivered: delivered, p_failed: failed });
  } catch {
    /* sans gravité */
  }
}
