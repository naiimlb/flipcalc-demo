import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PER_MINUTE = 6;
export const PER_DAY = 150;

export type QuotaResult = "ok" | "minute" | "day";

/** Repli en mémoire si la fonction SQL est indisponible (par instance serveur). */
const memory = new Map<string, number[]>();

function memoryQuota(userId: string): QuotaResult {
  const now = Date.now();
  const recent = (memory.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) return "minute";
  recent.push(now);
  memory.set(userId, recent);
  return "ok";
}

/** Limite de requêtes par utilisateur, stockée dans Postgres (consume_recognize_quota). */
export async function consumeQuota(
  supabase: SupabaseClient,
  userId: string,
): Promise<QuotaResult> {
  const { data, error } = await supabase.rpc("consume_recognize_quota", {
    per_minute: PER_MINUTE,
    per_day: PER_DAY,
  });
  if (error || (data !== "ok" && data !== "minute" && data !== "day")) {
    console.warn("[quota] repli en mémoire :", error?.code ?? "réponse inattendue");
    return memoryQuota(userId);
  }
  return data;
}
