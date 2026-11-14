import "server-only";
import { generateDesignWithClaude, type ClaudeUsage, type ImageMediaType } from "./ai/claude";
import { DEMO_NO_MATCH, demoDesign, matchDemoDesign } from "./design/demo";
import { languageInstruction } from "./design/prompt";
import type { Design } from "./design/schema";
import { verifyDesign, type VerifyCheck } from "./fabrication/verify";
import { VARIANTS, applyVariantLocally, variantInstruction, type VariantId, type VariantIntensity } from "./design/variants";
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
  /** Vrai si une seconde génération a corrigé un défaut bloquant (pièce flottante, paroi trop fine). */
  corrected?: boolean;
}

/** Défauts que l'IA doit corriger elle-même (une seule fois) : ils rendraient la pièce inimprimable. */
export function blockingChecks(checks: VerifyCheck[]): VerifyCheck[] {
  return checks.filter((c) => c.status === "error" && (c.id === "floating" || c.id === "walls"));
}

export function correctionInstruction(problems: VerifyCheck[]): string {
  return `\n\nUne première version de cette conception avait des défauts bloquants pour l'impression 3D. Corrige-les en gardant la même solution :\n${problems
    .map((p) => `- ${p.label} : ${p.detail}`)
    .join("\n")}\nRappels : toutes les pièces doivent se toucher ou s'emboîter (aucune pièce flottante) et aucune paroi ne doit faire moins de 1,2 mm.`;
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
  language?: "fr" | "en" | "ar";
  /** Texte cumulé de la réponse de l'IA pendant qu'elle s'écrit (affichage progressif). */
  onText?: (snapshot: string) => void;
  onRestart?: () => void;
  /** Nouvelle version d'une conception existante (« Plus petit », « Plus solide »…). */
  variant?: { id: VariantId; base: Design; intensity?: VariantIntensity } | null;
}): Promise<GenerationOutcome> {
  const started = Date.now();
  const variant = params.variant ?? null;
  // Version : l'IA reçoit la conception actuelle et l'objectif ; sans IA, la version est calculée localement.
  const fallbackDesign = (note: string) =>
    variant ? applyVariantLocally(variant.base, variant.id, variant.intensity) : demoDesign(params.prompt, note);
  const markVariant = (design: Design): Design =>
    variant ? { ...design, variante: { objectif: variant.id, libelle: VARIANTS[variant.id].label, base: variant.base.title } } : design;
  // Démonstration : aucune demande sans rapport avec les exemples ne reçoit un modèle au hasard.
  const noMatch = (): GenerationOutcome => ({
    ok: false,
    design: null,
    provider: "demo",
    model: null,
    error: DEMO_NO_MATCH,
    detail: "Aucun modèle d'exemple ne correspond à cette demande (démonstration).",
    raw: null,
    stopReason: null,
    usage: null,
    validationErrors: null,
    durationMs: Date.now() - started,
  });
  const unmatched = !variant && !matchDemoDesign(params.prompt);
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
    if (unmatched) return noMatch();
    // Petite attente pour que l'animation de génération reste lisible.
    await new Promise((r) => setTimeout(r, 900));
    const design = fallbackDesign("Mode démonstration : modèle d'exemple le plus proche de la demande (l'IA n'a pas été utilisée).");
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
    prompt: variant ? `${params.prompt}\n\n${variantInstruction(variant.id, variant.base, variant.intensity)}` : params.prompt,
    image: variant ? null : (params.image ?? null),
    onText: params.onText,
    onRestart: params.onRestart,
  });
  const durationMs = Date.now() - started;
  if (!result.ok && result.unavailable && params.allowDemo) {
    // Crédit épuisé, clé refusée… : on sert le modèle d'exemple le plus proche plutôt qu'une erreur.
    console.warn(`IA indisponible, repli sur les exemples : ${result.detail}`);
    if (unmatched) return noMatch();
    const design = fallbackDesign("L'IA n'a pas pu répondre (clé, crédit ou réglage) : modèle d'exemple le plus proche de la demande.");
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
    let final = result;
    let corrected = false;
    // Vérifications automatiques : un défaut bloquant déclenche UNE seule tentative de correction.
    const problems = variant ? [] : blockingChecks(verifyDesign(result.design, { request: params.prompt }).checks);
    if (problems.length) {
      const retry = await generateDesignWithClaude({
        apiKey,
        systemPrompt: params.ai.systemPrompt + languageInstruction(params.language),
        model: params.ai.model,
        effort: params.ai.effort,
        maxTokens: params.ai.maxTokens,
        prompt: params.prompt + correctionInstruction(problems),
        image: params.image ?? null,
        onRestart: params.onRestart,
      });
      // On garde la correction seulement si elle a moins de défauts bloquants que la première version.
      if (retry.ok && blockingChecks(verifyDesign(retry.design, { request: params.prompt }).checks).length < problems.length) {
        final = retry;
        corrected = true;
      }
    }
    return {
      ok: true,
      design: markVariant(final.design),
      provider: "claude",
      model: final.servedBy,
      error: null,
      detail: null,
      raw: final.raw,
      stopReason: final.stopReason,
      usage: final.usage,
      validationErrors: null,
      durationMs: Date.now() - started,
      corrected,
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
