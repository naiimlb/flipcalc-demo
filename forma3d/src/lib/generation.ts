import "server-only";
import { generateDesignWithClaude, type ClaudeUsage, type ImageMediaType } from "./ai/claude";
import { demoDesign } from "./design/demo";
import { languageInstruction } from "./design/prompt";
import type { Design } from "./design/schema";
import { getSecret } from "./secrets";
import type { AiSettings } from "./settings";

export interface GenerationOutcome {
  ok: boolean;
  design: Design | null;
  provider: "claude" | "demo";
  model: string | null;
  error: string | null;
  detail: string | null;
  raw: string | null;
  stopReason: string | null;
  usage: ClaudeUsage | null;
  validationErrors: string[] | null;
  durationMs: number;
}

/**
 * Produit une conception à partir d'une demande : Claude si une clé est disponible,
 * sinon le générateur de démonstration (si autorisé).
 */
export async function generateDesign(params: {
  prompt: string;
  image?: { mediaType: ImageMediaType; data: string } | null;
  ai: AiSettings;
  allowDemo: boolean;
  /** Force le générateur de démonstration (aucun appel payant). */
  forceDemo?: boolean;
  /** Langue de rédaction préférée de l'utilisateur. */
  language?: "fr" | "en";
}): Promise<GenerationOutcome> {
  const started = Date.now();
  const apiKey = params.forceDemo ? null : await getSecret("ANTHROPIC_API_KEY");

  if (!apiKey) {
    if (!params.allowDemo) {
      return {
        ok: false,
        design: null,
        provider: "claude",
        model: null,
        error: "L'IA n'est pas encore configurée. Réessayez plus tard.",
        detail: "ANTHROPIC_API_KEY absente (ni en base, ni en variable d'environnement).",
        raw: null,
        stopReason: null,
        usage: null,
        validationErrors: null,
        durationMs: Date.now() - started,
      };
    }
    // Petite attente pour que l'animation de génération reste lisible.
    await new Promise((r) => setTimeout(r, 900));
    const design = demoDesign(params.prompt);
    return {
      ok: true,
      design,
      provider: "demo",
      model: null,
      error: null,
      detail: null,
      raw: JSON.stringify(design, null, 2),
      stopReason: null,
      usage: null,
      validationErrors: null,
      durationMs: Date.now() - started,
    };
  }

  const result = await generateDesignWithClaude({
    apiKey,
    systemPrompt: params.ai.systemPrompt + languageInstruction(params.language),
    model: params.ai.model,
    effort: params.ai.effort,
    maxTokens: params.ai.maxTokens,
    prompt: params.prompt,
    image: params.image ?? null,
  });
  const durationMs = Date.now() - started;
  if (!result.ok && result.unavailable && params.allowDemo) {
    // Crédit épuisé, clé refusée… : on sert le modèle d'exemple le plus proche plutôt qu'une erreur.
    console.warn(`IA indisponible, repli sur les exemples : ${result.detail}`);
    const design = demoDesign(params.prompt, "L'IA est momentanément indisponible (clé ou crédit) : modèle d'exemple le plus proche de la demande.");
    return {
      ok: true,
      design,
      provider: "demo",
      model: null,
      error: null,
      detail: result.detail,
      raw: JSON.stringify(design, null, 2),
      stopReason: null,
      usage: null,
      validationErrors: null,
      durationMs,
    };
  }
  if (result.ok) {
    return {
      ok: true,
      design: result.design,
      provider: "claude",
      model: result.servedBy,
      error: null,
      detail: null,
      raw: result.raw,
      stopReason: result.stopReason,
      usage: result.usage,
      validationErrors: null,
      durationMs,
    };
  }
  return {
    ok: false,
    design: null,
    provider: "claude",
    model: result.servedBy ?? params.ai.model,
    error: result.error,
    detail: result.detail,
    raw: result.raw || null,
    stopReason: result.stopReason,
    usage: result.usage,
    validationErrors: result.validationErrors ?? null,
    durationMs,
  };
}
