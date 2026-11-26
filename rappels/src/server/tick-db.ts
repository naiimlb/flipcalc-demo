import type { SupabaseClient } from "@supabase/supabase-js";
import { doneKey, rowToTask, type DoneRow, type TaskRow } from "@/lib/db-map";
import type { Target, TickDb } from "./push-tick";

type SubRow = { user_id: string; endpoint: string; p256dh: string; auth_key: string };
type SettingRow = { user_id: string; notify: boolean; schedule: string | null };
type TickData = { subs: SubRow[]; settings: SettingRow[]; tasks: (TaskRow & { user_id: string })[]; done: (DoneRow & { user_id: string })[] };

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
      const byUser = new Map<string, Target>();
      for (const s of d.subs) {
        if (muted.has(s.user_id)) continue;
        if (!byUser.has(s.user_id)) byUser.set(s.user_id, { userId: s.user_id, schedule: schedule.get(s.user_id) ?? null, subs: [], tasks: [], done: new Set() });
        byUser.get(s.user_id)!.subs.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth_key });
      }
      for (const t of d.tasks) byUser.get(t.user_id)?.tasks.push(rowToTask(t));
      for (const x of d.done) byUser.get(x.user_id)?.done.add(doneKey(x.task_id, x.service_date));
      return [...byUser.values()];
    },
    claim: (userId, taskId, serviceDate, slotAtIso) => rpc<boolean>("push_claim", { p_user: userId, p_task: taskId, p_date: serviceDate, p_slot: slotAtIso }),
    async removeSubscription(endpoint) {
      await rpc("push_remove_sub", { p_endpoint: endpoint });
    },
  };
}

/** Nettoyage : les créneaux de plus de 3 jours ne servent plus à rien. */
export async function purgeOldClaims(sb: SupabaseClient, secret: string) {
  await sb.rpc("push_purge", { p_secret: secret });
}
