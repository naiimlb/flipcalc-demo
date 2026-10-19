import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type QuotaKind = "recognize" | "tajweed";
export type QuotaResult = "ok" | "minute" | "day";

/** Limites par utilisateur, stockées dans Postgres (fonctions consume_*_quota). */
const LIMITS: Record<QuotaKind, { fn: string; perMinute: number; perDay: number }> = {
  recognize: { fn: "consume_recognize_quota", perMinute: 6, perDay: 150 },
  tajweed: { fn: "consume_tajweed_quota", perMinute: 6, perDay: 120 },
};

/** Repli en mémoire si la fonction SQL est indisponible (par instance serveur). */
const memory = new Map<string, number[]>();

function memoryQuota(key: string, perMinute: number): QuotaResult {
  const now = Date.now();
  const recent = (memory.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= perMinute) return "minute";
  recent.push(now);
  memory.set(key, recent);
  return "ok";
}

export async function consumeQuota(
  supabase: SupabaseClient,
  userId: string,
  kind: QuotaKind = "recognize",
): Promise<QuotaResult> {
  const { fn, perMinute, perDay } = LIMITS[kind];
  const { data, error } = await supabase.rpc(fn, { per_minute: perMinute, per_day: perDay });
  if (error || (data !== "ok" && data !== "minute" && data !== "day")) {
    console.warn(`[quota:${kind}] repli en mémoire :`, error?.code ?? "réponse inattendue");
    return memoryQuota(`${kind}:${userId}`, perMinute);
  }
  return data;
}

export function quotaMessage(result: Exclude<QuotaResult, "ok">): string {
  return result === "minute"
    ? "Trop de demandes, réessaie dans une minute."
    : "Limite quotidienne atteinte : reviens demain.";
}
