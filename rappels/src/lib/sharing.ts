"use client";

import { getSupabase } from "./supabase";
import type { ShareMode, ShareStatus } from "./types";

// Appels vers les fonctions SQL de partage (supabase/schema.sql). Tout est contrôlé côté base (RLS + fonctions).
export type Colleague = { id: string; prenom: string };
export type Participant = { userId: string; prenom: string; isOwner: boolean; shareStatus: ShareStatus; progress: "sent" | "seen" | "taken" | "done" };
export type ActAction = "seen" | "taken" | "done" | "postpone" | "decline" | "abandon" | "reopen";
export type ActResult = { ok: true } | { ok: false; takenBy: string } | { ok: false; error: string };

const fail = (e: { message: string }) => new Error(e.message);

/** Les collègues caissiers inscrits : prénom seulement. */
export async function listColleagues(): Promise<Colleague[]> {
  const { data, error } = await getSupabase().rpc("colleagues");
  if (error) throw fail(error);
  return (data as Colleague[]) ?? [];
}

export async function shareTask(taskId: string, recipients: string[], mode: ShareMode): Promise<void> {
  const { error } = await getSupabase().rpc("share_task", { p_task: taskId, p_recipients: recipients, p_mode: mode });
  if (error) throw fail(error);
}

export async function respondShare(taskId: string, accept: boolean): Promise<void> {
  const { error } = await getSupabase().rpc("respond_share", { p_task: taskId, p_accept: accept });
  if (error) throw fail(error);
}

type OverviewRow = { user_id: string; prenom: string; is_owner: boolean; share_status: string; progress: string };

/** Qui est concerné par la tâche et où il en est, pour une journée de service. */
export async function shareOverview(taskId: string, date: string): Promise<Participant[]> {
  const { data, error } = await getSupabase().rpc("share_overview", { p_task: taskId, p_date: date });
  if (error) throw fail(error);
  return ((data as OverviewRow[]) ?? []).map((r) => ({
    userId: r.user_id,
    prenom: r.prenom,
    isOwner: r.is_owner,
    shareStatus: (r.share_status === "declined" || r.share_status === "pending" ? r.share_status : "accepted") as ShareStatus,
    progress: (["seen", "taken", "done"].includes(r.progress) ? r.progress : "sent") as Participant["progress"],
  }));
}

/** Une réaction sur une tâche (vu, je m'en occupe, fait, reporter) : arrête les relances. */
export async function occAct(taskId: string, date: string, action: ActAction, minutes = 10, reason?: string): Promise<ActResult> {
  const { data, error } = await getSupabase().rpc("occ_act", { p_task: taskId, p_date: date, p_action: action, p_minutes: minutes, p_reason: reason ?? null });
  if (error) return { ok: false, error: error.message };
  const r = data as { ok: boolean; taken_by?: string };
  return r.ok ? { ok: true } : { ok: false, takenBy: r.taken_by ?? "Un collègue" };
}

export const PROGRESS_LABEL: Record<Participant["progress"], string> = {
  sent: "📨 Envoyé",
  seen: "👀 Vu",
  taken: "🙋 En cours",
  done: "✅ Fait",
};
