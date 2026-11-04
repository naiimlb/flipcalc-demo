import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelAsset } from "./providers";
import { MESHY_CREDIT_ACTIONS, MESH_KINDS, meshyRetrieve, type MeshyKind } from "./providers/meshy";

/**
 * Suivi des tâches Meshy d'un projet (colonne design_requests.model_asset) :
 * le maillage affiché, ses versions précédentes et la dernière analyse d'imprimabilité.
 * Les crédits ne sont débités qu'une fois la tâche réussie (fonction SQL idempotente charge_meshy_task).
 */

const MAX_COPY_BYTES = 20 * 1024 * 1024; // limite du dossier « models » de Supabase Storage

export function isMeshyKind(value: unknown): value is MeshyKind {
  return typeof value === "string" && (["preview", "refine", "retexture", "remesh", "resize", "repair", "analyze"] as string[]).includes(value);
}

/** Nouvel état après le lancement d'une tâche. */
export function withStartedTask(current: ModelAsset | null, kind: MeshyKind, taskId: string, prompt?: string): ModelAsset {
  const now = new Date().toISOString();
  const base: ModelAsset = current ?? { provider: "meshy", taskId: "", status: "failed", progress: 0, updatedAt: now };
  if (kind === "analyze") {
    return { ...base, analysis: { taskId, status: "pending", progress: 0, result: null, error: null, updatedAt: now } };
  }
  const history = [...(base.history ?? [])];
  if (base.taskId && base.status === "succeeded") {
    history.unshift({ taskId: base.taskId, kind: base.kind ?? "preview", glbUrl: base.glbUrl ?? null, storedPath: base.storedPath ?? null, createdAt: base.updatedAt });
  }
  return {
    ...base,
    provider: "meshy",
    taskId,
    kind,
    status: "pending",
    progress: 0,
    glbUrl: null,
    storedPath: null,
    error: null,
    prompt: prompt?.slice(0, 600),
    updatedAt: now,
    history: history.slice(0, 8),
  };
}

/**
 * Met à jour les tâches en cours (maillage et analyse) auprès de Meshy.
 * À la réussite : facturation (une seule fois) et copie du GLB dans Supabase Storage.
 * Renvoie le nouvel état et `charged` si des crédits viennent d'être débités.
 */
export async function refreshMeshyAsset(params: {
  asset: ModelAsset;
  apiKey: string;
  supabase: SupabaseClient;
  requestId: string;
  userId: string;
}): Promise<{ asset: ModelAsset; changed: boolean; charged: boolean }> {
  const { apiKey, supabase, requestId, userId } = params;
  let asset = { ...params.asset };
  let changed = false;
  let charged = false;

  const charge = async (kind: MeshyKind, taskId: string) => {
    const { data, error } = await supabase.rpc("charge_meshy_task", { p_action: MESHY_CREDIT_ACTIONS[kind], p_request_id: requestId, p_task_id: taskId });
    if (!error && typeof data === "number" && data > 0) charged = true;
  };

  const kind = (asset.kind ?? "preview") as MeshyKind;
  if (asset.taskId && (asset.status === "pending" || asset.status === "running") && MESH_KINDS.includes(kind)) {
    const task = await meshyRetrieve(kind, asset.taskId, apiKey);
    const glb = task.modelUrls.glb ?? null;
    asset = {
      ...asset,
      status: task.status === "succeeded" && !glb ? "failed" : task.status,
      progress: task.status === "succeeded" ? 100 : task.progress,
      glbUrl: glb,
      error: task.status === "succeeded" && !glb ? "Meshy n'a pas renvoyé de fichier GLB." : task.error,
      updatedAt: new Date().toISOString(),
    };
    changed = true;
    if (asset.status === "succeeded" && glb) {
      await charge(kind, asset.taskId);
      asset.storedPath = await copyToStorage(supabase, userId, requestId, asset.taskId, glb);
    }
  }

  const analysis = asset.analysis;
  if (analysis && (analysis.status === "pending" || analysis.status === "running")) {
    const task = await meshyRetrieve("analyze", analysis.taskId, apiKey);
    asset = {
      ...asset,
      analysis: { ...analysis, status: task.status, progress: task.status === "succeeded" ? 100 : task.progress, result: task.printability, error: task.error, updatedAt: new Date().toISOString() },
    };
    changed = true;
    if (task.status === "succeeded") await charge("analyze", analysis.taskId);
  }
  return { asset, changed, charged };
}

/** Copie le GLB Meshy dans le dossier de l'utilisateur (les liens Meshy expirent). Silencieux en cas d'échec. */
async function copyToStorage(supabase: SupabaseClient, userId: string, requestId: string, taskId: string, url: string): Promise<string | null> {
  try {
    if (!/^https:\/\/([a-z0-9-]+\.)*meshy\.ai\//i.test(url)) return null;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
    const length = Number(res.headers.get("content-length") ?? 0);
    if (!res.ok || length > MAX_COPY_BYTES) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_COPY_BYTES) return null;
    const path = `${userId}/${requestId}-meshy-${taskId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16)}.glb`;
    const { error } = await supabase.storage.from("models").upload(path, buffer, { upsert: true, contentType: "model/gltf-binary" });
    return error ? null : path;
  } catch {
    return null;
  }
}
