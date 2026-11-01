import "server-only";
import type { ModelAsset, ModelProvider } from "./types";

/**
 * Adaptateur Meshy (text-to-3D, EXPÉRIMENTAL — à valider avec la documentation à jour :
 * https://docs.meshy.ai). Mode « preview » : maillage sans texture, en 1 à 2 minutes.
 */
const API = "https://api.meshy.ai/openapi/v2/text-to-3d";

function describe(design: { title: string; solution: { concept: string }; materials: { name: string }[] }) {
  const materials = design.materials.map((m) => m.name).join(", ");
  return `${design.title}. ${design.solution.concept} Materials: ${materials}. Product design, clean, studio.`.slice(0, 590);
}

const STATUS: Record<string, ModelAsset["status"]> = {
  PENDING: "pending",
  IN_PROGRESS: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELED: "failed",
  EXPIRED: "failed",
};

export const meshyProvider: ModelProvider = {
  id: "meshy",
  label: "Meshy (text-to-3D)",
  secretName: "MESHY_API_KEY",
  assetHosts: ["meshy.ai"],

  async start({ design, apiKey }) {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "preview", prompt: describe(design), art_style: "realistic", should_remesh: true }),
    });
    if (!res.ok) throw new Error(`Meshy ${res.status} : ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { result?: string };
    if (!body.result) throw new Error("Meshy : identifiant de tâche absent.");
    return { provider: "meshy", taskId: body.result, status: "pending", progress: 0, updatedAt: new Date().toISOString() };
  },

  async poll(asset, apiKey) {
    const res = await fetch(`${API}/${encodeURIComponent(asset.taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Meshy ${res.status} : ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as {
      status?: string;
      progress?: number;
      model_urls?: { glb?: string };
      task_error?: { message?: string };
    };
    return {
      ...asset,
      status: STATUS[body.status ?? ""] ?? "running",
      progress: Math.max(0, Math.min(100, body.progress ?? asset.progress)),
      glbUrl: body.model_urls?.glb ?? null,
      error: body.task_error?.message || null,
      updatedAt: new Date().toISOString(),
    };
  },
};
