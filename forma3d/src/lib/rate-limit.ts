import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Limite de débit pour les appels peu coûteux (questions de précision) :
 * - en base (fonction SQL consume_rate_limit : par utilisateur ou par adresse, plus un plafond global par jour) ;
 * - à défaut (migration non appliquée, erreur), compteur en mémoire de l'instance : moins strict, mais jamais ouvert.
 */
const memory = new Map<string, number[]>();

function allowInMemory(bucket: string, max: number, windowSeconds: number): boolean {
  const now = Date.now();
  const hits = (memory.get(bucket) ?? []).filter((t) => now - t < windowSeconds * 1000);
  if (hits.length >= max) {
    memory.set(bucket, hits);
    return false;
  }
  hits.push(now);
  memory.set(bucket, hits);
  if (memory.size > 5000) memory.clear(); // borne la mémoire
  return true;
}

export async function allowAction(
  supabase: SupabaseClient | null,
  scope: "clarify",
  options: { identity: string; ipHash: string; max: number; windowSeconds: number; globalMax: number },
): Promise<boolean> {
  if (supabase) {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_scope: scope,
      p_ip_hash: options.ipHash,
      p_max: options.max,
      p_window_seconds: options.windowSeconds,
      p_global_max: options.globalMax,
    });
    if (!error && typeof data === "boolean") return data;
  }
  return allowInMemory(`${scope}:${options.identity}`, options.max, options.windowSeconds);
}
