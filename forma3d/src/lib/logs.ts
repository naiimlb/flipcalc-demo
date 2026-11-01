import "server-only";
import { getServiceSupabase } from "./supabase/admin";

export type LogLevel = "info" | "warn" | "error";

/** Écrit dans app_logs (visible dans /admin/logs). Ne lève jamais d'exception. */
export async function logEvent(
  level: LogLevel,
  source: string,
  message: string,
  extra: { details?: unknown; requestId?: string | null; userId?: string | null } = {},
): Promise<void> {
  const line = `[${level}] ${source} : ${message}`;
  if (level === "error") console.error(line, extra.details ?? "");
  else console.log(line);
  const service = getServiceSupabase();
  if (!service) return;
  try {
    await service.from("app_logs").insert({
      level,
      source: source.slice(0, 80),
      message: message.slice(0, 2000),
      details: extra.details === undefined ? null : JSON.parse(JSON.stringify(extra.details)),
      request_id: extra.requestId ?? null,
      user_id: extra.userId ?? null,
    });
  } catch (err) {
    console.error("Journalisation impossible :", err);
  }
}
