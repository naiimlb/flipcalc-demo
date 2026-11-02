import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreditAction } from "./settings";

/**
 * Crédits (phase 5, sans paiement) : chaque action consomme un nombre de crédits réglable dans /admin,
 * les crédits gratuits se renouvellent chaque mois. Tout passe par des fonctions SQL (le solde ne peut pas
 * être modifié directement). Si le script SQL de la phase 5 n'est pas appliqué, les crédits sont ignorés.
 */

export interface CreditBalance {
  free: number;
  bonus: number;
  total: number;
  allowance: number;
  renewsAt: string;
  costs: Record<string, number>;
  unlimited: boolean;
}

export async function getMyCredits(supabase: SupabaseClient): Promise<CreditBalance | null> {
  const { data, error } = await supabase.rpc("my_credits");
  if (error || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  return {
    free: Number(d.free ?? 0),
    bonus: Number(d.bonus ?? 0),
    total: Number(d.total ?? 0),
    allowance: Number(d.allowance ?? 0),
    renewsAt: String(d.renews_at ?? ""),
    costs: (d.costs as Record<string, number>) ?? {},
    unlimited: Boolean(d.unlimited),
  };
}

export type ConsumeResult =
  | { ok: true; ledgerId: number | null }
  | { ok: false; exhausted: true };

/** Consomme le coût d'une action. Crédits non activés (script absent) ou erreur inattendue : l'action est autorisée. */
export async function consumeCredits(supabase: SupabaseClient, action: CreditAction, requestId?: string | null): Promise<ConsumeResult> {
  const { data, error } = await supabase.rpc("consume_credits", { p_action: action, p_request_id: requestId ?? null });
  if (error) {
    if (error.message?.includes("CREDITS_EXHAUSTED")) return { ok: false, exhausted: true };
    if (!/does not exist|Could not find the function|schema cache/i.test(error.message ?? "")) {
      console.warn("Crédits : consommation impossible, action autorisée :", error.message);
    }
    return { ok: true, ledgerId: null };
  }
  return { ok: true, ledgerId: typeof data === "number" ? data : data ? Number(data) : null };
}

/** Rembourse une consommation (génération échouée, aucune IA utilisée…). Silencieux en cas d'erreur. */
export async function refundCredits(supabase: SupabaseClient, ledgerId: number | null): Promise<void> {
  if (!ledgerId) return;
  await supabase.rpc("refund_credits", { p_ledger_id: ledgerId }).then(
    () => undefined,
    () => undefined,
  );
}
