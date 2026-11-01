import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "./supabase/admin";

export type LogLevel = "info" | "warn" | "error";

/** Écrit dans app_logs (visible dans /admin/logs). Ne lève jamais d'exception. */
export async function logEvent(
  level: LogLevel,
  source: string,
  message: string,
  extra: { details?: unknown; requestId?: string | null; userId?: string | null; supabase?: SupabaseClient } = {},
): Promise<void> {
  const line = `[${level}] ${source} : ${message}`;
  if (level === "error") console.error(line, extra.details ?? "");
  else console.log(line);
  const service = getServiceSupabase();
  const details = extra.details === undefined ? null : JSON.parse(JSON.stringify(extra.details));
  if (!service) {
    // Sans clé secrète : écriture via la session de l'utilisateur (fonction log_event).
    if (!extra.supabase) return;
    try {
      await extra.supabase.rpc("log_event", {
        p_level: level,
        p_source: source.slice(0, 80),
        p_message: message.slice(0, 2000),
        p_details: details,
        p_request_id: extra.requestId ?? null,
      });
    } catch (err) {
      console.error("Journalisation impossible :", err);
    }
    return;
  }
  try {
    await service.from("app_logs").insert({
      level,
      source: source.slice(0, 80),
      message: message.slice(0, 2000),
      details,
      request_id: extra.requestId ?? null,
      user_id: extra.userId ?? null,
    });
  } catch (err) {
    console.error("Journalisation impossible :", err);
  }
}
