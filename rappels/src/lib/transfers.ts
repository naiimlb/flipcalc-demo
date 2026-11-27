"use client";

import { doneKey } from "./db-map";
import { getSupabase } from "./supabase";
import { refreshStore } from "./store";
import type { Colleague } from "./sharing";
import type { OccStatus, Transfer } from "./types";

// Transmission d'une tâche à la prochaine équipe, état d'une tâche, historique. Tout est contrôlé côté base (supabase/schema.sql).
const fail = (e: { message: string }) => new Error(e.message);

/** Collègues dont le planning indique cette équipe ce jour-là (prénom seulement). */
export async function nextTeamMembers(date: string, team: "jour" | "soir"): Promise<Colleague[]> {
  const { data, error } = await getSupabase().rpc("next_team_members", { p_date: date, p_team: team });
  if (error) throw fail(error);
  return (data as Colleague[]) ?? [];
}

export type SendResult = { ok: true; count: number; wholeTeam: boolean } | { ok: false; error: string };

/** Transmet une tâche : `to` vide = toute la prochaine équipe. */
export async function sendTransfer(taskId: string, date: string, to: string[], targetDate: string, targetTeam: "jour" | "soir", message: string): Promise<SendResult> {
  const { data, error } = await getSupabase().rpc("transfer_send", { p_task: taskId, p_date: date, p_to: to, p_target_date: targetDate, p_target_team: targetTeam, p_message: message.trim() || null });
  if (error) return { ok: false, error: error.message };
  const r = data as { count: number; whole_team: boolean };
  return { ok: true, count: r.count, wholeTeam: r.whole_team };
}

export type RespondResult = { ok: true } | { ok: false; takenBy?: string; state?: string; error?: string };

export async function respondTransfer(id: string, accept: boolean): Promise<RespondResult> {
  const { data, error } = await getSupabase().rpc("transfer_respond", { p_id: id, p_accept: accept });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; taken_by?: string; state?: string };
  await refreshStore(true);
  return r.ok ? { ok: true } : { ok: false, takenBy: r.taken_by, state: r.state };
}

export type MyStatus = { status: Exclude<OccStatus, "missed">; postponedUntil: string | null; reason: string | null; handedTo: string | null };

export async function myStatus(taskId: string, date: string): Promise<MyStatus> {
  const { data, error } = await getSupabase().rpc("my_status", { p_task: taskId, p_date: date });
  if (error) throw fail(error);
  const r = data as { status: MyStatus["status"]; postponed_until: string | null; reason: string | null; handed_to: string | null };
  return { status: r.status, postponedUntil: r.postponed_until, reason: r.reason, handedTo: r.handed_to };
}

export type HistoryItem = { who: string | null; action: string; detail: string | null; at: string; concerned: string | null };

export async function taskHistory(taskId: string, date: string): Promise<HistoryItem[]> {
  const { data, error } = await getSupabase().rpc("task_history", { p_task: taskId, p_date: date });
  if (error) throw fail(error);
  return ((data as { prenom: string | null; action: string; detail: string | null; created_at: string; concerned: string | null }[]) ?? []).map((r) => ({ who: r.prenom, action: r.action, detail: r.detail, at: r.created_at, concerned: r.concerned }));
}

/** J'ouvre mon bilan : pas de second rappel. */
export async function openBilan(date: string): Promise<void> {
  await getSupabase().rpc("bilan_open", { p_date: date });
}

export const HISTORY_LABEL: Record<string, string> = {
  seen: "a vu la tâche",
  taken: "s'en occupe",
  postponed: "a reporté",
  done: "a fait la tâche",
  declined: "a refusé",
  handed: "a transmis à la prochaine équipe",
  transfer_accepted: "a accepté la transmission",
  transfer_declined: "a refusé la transmission",
  transfer_expired: "n'a pas répondu à la transmission",
  abandoned: "a laissé tomber",
  reopened: "a repris la tâche",
};

/** Mes transmissions reçues et en attente. */
export const pendingIncoming = (transfers: Transfer[], uid: string) => transfers.filter((t) => t.toUser === uid && t.status === "pending");
/** Tâches transmises que j'ai acceptées : clés « tâche@journée ». */
export const acceptedTransferKeys = (transfers: Transfer[], uid: string): Set<string> =>
  new Set(transfers.filter((t) => t.toUser === uid && t.status === "accepted").map((t) => doneKey(t.taskId, t.targetDate)));
