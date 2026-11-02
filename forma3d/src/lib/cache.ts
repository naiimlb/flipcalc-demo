import "server-only";
import { createHash, createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { composePrompt, type Answer } from "./clarify-types";
import { validateDesign, type Design } from "./design/schema";
import { getSecret } from "./secrets";
import type { AiSettings } from "./settings";

/**
 * Cache des conceptions : une demande identique (même texte, mêmes réponses, même langue, mêmes réglages d'IA)
 * est servie sans rappeler l'IA.
 *
 * La clé est un HMAC secret côté serveur : personne ne peut la calculer sans passer par le serveur, donc
 * personne ne peut viser la demande d'un autre ni « empoisonner » une entrée à l'avance.
 * Pas de cache pour les demandes avec photo (elles dépendent d'une image privée).
 */

export function normalizeForCache(text: string): string {
  return text
    .normalize("NFC")
    .toLocaleLowerCase("fr-FR")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?\s]+$/u, "");
}

async function cacheSecret(): Promise<string | null> {
  const explicit = process.env.CACHE_SECRET || process.env.SECRETS_ENCRYPTION_KEY;
  if (explicit) return explicit;
  const apiKey = await getSecret("ANTHROPIC_API_KEY");
  return apiKey ? createHash("sha256").update(`forma3d-cache:${apiKey}`).digest("hex") : null;
}

export async function computeCacheKey(params: {
  prompt: string;
  answers: Answer[];
  language: string;
  ai: Pick<AiSettings, "model" | "effort" | "systemPrompt">;
}): Promise<string | null> {
  const secret = await cacheSecret();
  if (!secret) return null;
  const payload = JSON.stringify({
    v: 1,
    p: normalizeForCache(composePrompt(params.prompt, params.answers)),
    l: params.language,
    m: params.ai.model,
    e: params.ai.effort,
    s: createHash("sha256").update(params.ai.systemPrompt).digest("hex"),
  });
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export interface CachedDesign {
  design: Design;
  model: string | null;
}

/** Cherche une conception déjà générée pour cette clé. Toute erreur = pas de cache (jamais bloquant). */
export async function cacheLookup(supabase: SupabaseClient | null, key: string | null): Promise<CachedDesign | null> {
  if (!supabase || !key) return null;
  try {
    const { data, error } = await supabase.rpc("cache_lookup", { p_key: key });
    if (error || !data || typeof data !== "object") return null;
    const row = data as { design?: unknown; model?: unknown };
    const validated = validateDesign(row.design);
    if (!validated.ok) return null;
    return { design: validated.design, model: typeof row.model === "string" ? row.model : null };
  } catch {
    return null;
  }
}

/** Enregistre la clé sur la demande de l'utilisateur (elle devient la source du cache). Silencieux en cas d'erreur. */
export async function cacheStore(supabase: SupabaseClient, requestId: string, key: string | null): Promise<void> {
  if (!key) return;
  try {
    await supabase.rpc("set_request_cache_key", { p_id: requestId, p_key: key });
  } catch {
    // le cache est facultatif
  }
}
