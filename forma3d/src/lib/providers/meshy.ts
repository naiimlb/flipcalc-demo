import "server-only";
import type { Design } from "../design/schema";
import type { AssetStatus, ModelAsset, ModelProvider } from "./types";

/**
 * Client de l'API Meshy (https://docs.meshy.ai), clé côté serveur uniquement.
 *
 * Points d'accès et coûts relevés dans la documentation officielle (pages Text to 3D, Retexture, Remesh, Resize,
 * Analyze / Repair Printability, Balance et Pricing) :
 *   - Text to 3D, aperçu (maillage sans texture)  POST /openapi/v2/text-to-3d  { mode: "preview" }   20 crédits
 *   - Text to 3D, texture                          POST /openapi/v2/text-to-3d  { mode: "refine" }    10 crédits (2K)
 *   - Retexture                                    POST /openapi/v1/retexture                          10 crédits (2K)
 *   - Remesh (simplifier le maillage)              POST /openapi/v1/remesh                              5 crédits
 *   - Resize (mettre à l'échelle réelle)           POST /openapi/v1/resize                              1 crédit
 *   - Analyze Printability                         POST /openapi/v1/print/analyze                       gratuit
 *   - Repair Printability                          POST /openapi/v1/print/repair                       10 crédits
 *   - Solde du compte Meshy                        GET  /openapi/v1/balance
 * Chaque tâche se suit par GET <point d'accès>/<id> (statut PENDING, IN_PROGRESS, SUCCEEDED, FAILED, CANCELED).
 * Les tâches échouées ne consomment pas de crédits Meshy.
 */
const API = "https://api.meshy.ai";

export type MeshyKind = "preview" | "refine" | "retexture" | "remesh" | "resize" | "repair" | "analyze";
export const MESHY_KINDS: MeshyKind[] = ["preview", "refine", "retexture", "remesh", "resize", "repair", "analyze"];

const ENDPOINTS: Record<MeshyKind, string> = {
  preview: "/openapi/v2/text-to-3d",
  refine: "/openapi/v2/text-to-3d",
  retexture: "/openapi/v1/retexture",
  remesh: "/openapi/v1/remesh",
  resize: "/openapi/v1/resize",
  repair: "/openapi/v1/print/repair",
  analyze: "/openapi/v1/print/analyze",
};

/** Coût Meshy de chaque action, en crédits Meshy (documentation « Pricing »). */
export const MESHY_COSTS: Record<MeshyKind, number> = {
  preview: 20,
  refine: 10,
  retexture: 10,
  remesh: 5,
  resize: 1,
  repair: 10,
  analyze: 0,
};

/** Action correspondante dans le système de crédits Forma3D (coût réglable dans /admin/credits). */
export const MESHY_CREDIT_ACTIONS: Record<MeshyKind, string> = {
  preview: "meshy_preview",
  refine: "meshy_refine",
  retexture: "meshy_retexture",
  remesh: "meshy_remesh",
  resize: "meshy_resize",
  repair: "meshy_repair",
  analyze: "meshy_analyze",
};

/** Actions qui produisent un nouveau maillage affichable (l'analyse ne renvoie qu'un rapport). */
export const MESH_KINDS: MeshyKind[] = ["preview", "refine", "retexture", "remesh", "resize", "repair"];

const STATUS: Record<string, AssetStatus> = {
  PENDING: "pending",
  IN_PROGRESS: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "failed",
  EXPIRED: "failed",
};

export interface MeshyTask {
  status: AssetStatus;
  progress: number;
  modelUrls: Record<string, string>;
  thumbnailUrl: string | null;
  error: string | null;
  printability: MeshyPrintability | null;
}

export interface MeshyPrintability {
  status: string;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  metrics: Record<string, number | boolean | null>;
}

async function call(path: string, apiKey: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Meshy ${res.status} : ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** Lance une tâche ; renvoie son identifiant (champ « result » de la réponse). */
export async function meshyCreate(kind: MeshyKind, body: Record<string, unknown>, apiKey: string): Promise<string> {
  const data = (await call(ENDPOINTS[kind], apiKey, { method: "POST", body: JSON.stringify(body) })) as { result?: unknown; task_id?: unknown };
  const id = typeof data.result === "string" ? data.result : typeof data.task_id === "string" ? data.task_id : null;
  if (!id) throw new Error("Meshy : identifiant de tâche absent.");
  return id;
}

/** État d'une tâche. */
export async function meshyRetrieve(kind: MeshyKind, id: string, apiKey: string): Promise<MeshyTask> {
  const data = (await call(`${ENDPOINTS[kind]}/${encodeURIComponent(id)}`, apiKey)) as {
    status?: string;
    progress?: number;
    model_urls?: Record<string, unknown>;
    thumbnail_url?: unknown;
    task_error?: { message?: unknown } | null;
    printability?: {
      status?: unknown;
      issue_count?: unknown;
      error_count?: unknown;
      warning_count?: unknown;
      metrics?: Record<string, unknown>;
    } | null;
  };
  const urls: Record<string, string> = {};
  for (const [k, v] of Object.entries(data.model_urls ?? {})) if (typeof v === "string" && v) urls[k] = v;
  const p = data.printability;
  const metrics: Record<string, number | boolean | null> = {};
  for (const [k, v] of Object.entries(p?.metrics ?? {})) metrics[k] = typeof v === "number" || typeof v === "boolean" ? v : null;
  return {
    status: STATUS[data.status ?? ""] ?? "running",
    progress: Math.max(0, Math.min(100, Number(data.progress ?? 0) || 0)),
    modelUrls: urls,
    thumbnailUrl: typeof data.thumbnail_url === "string" ? data.thumbnail_url : null,
    error: typeof data.task_error?.message === "string" && data.task_error.message ? data.task_error.message : null,
    printability: p
      ? {
          status: String(p.status ?? "unknown"),
          issueCount: Number(p.issue_count ?? 0) || 0,
          errorCount: Number(p.error_count ?? 0) || 0,
          warningCount: Number(p.warning_count ?? 0) || 0,
          metrics,
        }
      : null,
  };
}

/** Solde du compte Meshy du site (null si indisponible). */
export async function meshyBalance(apiKey: string): Promise<number | null> {
  try {
    const data = (await call("/openapi/v1/balance", apiKey)) as { balance?: unknown };
    return typeof data.balance === "number" ? data.balance : null;
  } catch {
    return null;
  }
}

/** Description envoyée à Meshy pour générer le maillage d'une conception (800 caractères maximum). */
export function describeForMeshy(design: Pick<Design, "title" | "solution" | "materials">, extra = ""): string {
  const materials = design.materials.map((m) => m.name).join(", ");
  const text = `${design.title}. ${design.solution.concept} Materials: ${materials}. Product design object, clean, realistic proportions. ${extra}`;
  return text.replace(/\s+/g, " ").trim().slice(0, 800);
}

/** Corps de la requête de chaque action (paramètres documentés uniquement). */
export function meshyBody(
  kind: MeshyKind,
  input: { taskId?: string | null; modelUrl?: string | null; prompt?: string; texturePrompt?: string; polycount?: number; heightMeters?: number },
): Record<string, unknown> {
  const source = input.taskId ? { input_task_id: input.taskId } : input.modelUrl ? { model_url: input.modelUrl } : {};
  switch (kind) {
    case "preview":
      return { mode: "preview", prompt: (input.prompt ?? "").slice(0, 800) };
    case "refine":
      return { mode: "refine", preview_task_id: input.taskId };
    case "retexture":
      return { ...source, text_style_prompt: (input.texturePrompt ?? "").slice(0, 600) };
    case "remesh":
      return { ...source, target_formats: ["glb"], topology: "triangle", target_polycount: Math.round(Math.min(300_000, Math.max(100, input.polycount ?? 30_000))) };
    case "resize":
      return { ...source, resize_height: Math.max(0.001, input.heightMeters ?? 0.1), origin_at: "bottom" };
    case "repair":
    case "analyze":
      return source;
  }
}

/* ---- Compatibilité : ancien fournisseur « start / poll » (maillage lancé à la génération, désormais à la demande) ---- */

export const meshyProvider: ModelProvider = {
  id: "meshy",
  label: "Meshy",
  secretName: "MESHY_API_KEY",
  assetHosts: ["meshy.ai"],

  async start({ design, apiKey }) {
    const taskId = await meshyCreate("preview", meshyBody("preview", { prompt: describeForMeshy(design) }), apiKey);
    return { provider: "meshy", kind: "preview", taskId, status: "pending", progress: 0, updatedAt: new Date().toISOString() };
  },

  async poll(asset: ModelAsset, apiKey) {
    const kind = (asset.kind ?? "preview") as MeshyKind;
    const task = await meshyRetrieve(kind, asset.taskId, apiKey);
    return {
      ...asset,
      status: task.status,
      progress: task.status === "succeeded" ? 100 : task.progress,
      glbUrl: task.modelUrls.glb ?? asset.glbUrl ?? null,
      error: task.error,
      updatedAt: new Date().toISOString(),
    };
  },
};
