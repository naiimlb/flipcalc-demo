import { afterEach, describe, expect, it, vi } from "vitest";
import { applyEditLocally } from "@/lib/design/edit-local";
import { drillHole } from "@/lib/design/ops";
import { WALL_KEY_SHELF } from "@/lib/design/samples";
import { withStartedTask } from "@/lib/meshy-jobs";
import { MESHY_COSTS, meshyBalance, meshyBody, meshyCreate, meshyRetrieve } from "@/lib/providers/meshy";

afterEach(() => vi.unstubAllGlobals());

function mockFetch(payload: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("client Meshy (documentation officielle)", () => {
  it("lance une retexture sur le bon point d'accès avec la clé en Bearer", async () => {
    const fetch = mockFetch({ result: "task-123456" });
    const id = await meshyCreate("retexture", meshyBody("retexture", { modelUrl: "https://x.test/m.glb", texturePrompt: "bois de chêne" }), "msy_key");
    expect(id).toBe("task-123456");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.meshy.ai/openapi/v1/retexture");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer msy_key");
    expect(JSON.parse(String(init.body))).toEqual({ model_url: "https://x.test/m.glb", text_style_prompt: "bois de chêne" });
  });

  it("construit les corps de requête documentés", () => {
    expect(meshyBody("preview", { prompt: "a".repeat(900) })).toEqual({ mode: "preview", prompt: "a".repeat(800) });
    expect(meshyBody("refine", { taskId: "p1" })).toEqual({ mode: "refine", preview_task_id: "p1" });
    expect(meshyBody("remesh", { taskId: "t", polycount: 5000 })).toEqual({ input_task_id: "t", target_formats: ["glb"], topology: "triangle", target_polycount: 5000 });
    expect(meshyBody("resize", { taskId: "t", heightMeters: 0.12 })).toEqual({ input_task_id: "t", resize_height: 0.12, origin_at: "bottom" });
    expect(meshyBody("repair", { modelUrl: "https://x.test/m.glb" })).toEqual({ model_url: "https://x.test/m.glb" });
  });

  it("lit l'état d'une tâche, ses fichiers et le rapport d'imprimabilité", async () => {
    const fetch = mockFetch({
      status: "SUCCEEDED",
      progress: 100,
      model_urls: { glb: "https://assets.meshy.ai/x.glb", fbx: "" },
      printability: { status: "warning", issue_count: 1, error_count: 0, warning_count: 1, metrics: { is_watertight: true, holes: 0 } },
    });
    const task = await meshyRetrieve("analyze", "a1", "k");
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe("https://api.meshy.ai/openapi/v1/print/analyze/a1");
    expect(task.status).toBe("succeeded");
    expect(task.modelUrls).toEqual({ glb: "https://assets.meshy.ai/x.glb" });
    expect(task.printability?.warningCount).toBe(1);
  });

  it("lit le solde du compte Meshy", async () => {
    mockFetch({ balance: 1000 });
    expect(await meshyBalance("k")).toBe(1000);
    mockFetch({ message: "Unauthorized" }, 401);
    expect(await meshyBalance("k")).toBeNull();
  });

  it("coûts relevés dans la documentation", () => {
    expect(MESHY_COSTS).toEqual({ preview: 20, refine: 10, retexture: 10, remesh: 5, resize: 1, repair: 10, analyze: 0 });
  });

  it("garde le maillage précédent dans l'historique au lancement d'une nouvelle tâche", () => {
    const done = { provider: "meshy", taskId: "old-task-1", kind: "preview", status: "succeeded" as const, progress: 100, glbUrl: "https://assets.meshy.ai/a.glb", updatedAt: "2026-11-04T00:00:00Z" };
    const next = withStartedTask(done, "retexture", "new-task-1", "laiton");
    expect(next.taskId).toBe("new-task-1");
    expect(next.status).toBe("pending");
    expect(next.history?.[0].taskId).toBe("old-task-1");
    const analysed = withStartedTask(next, "analyze", "an-1");
    expect(analysed.taskId).toBe("new-task-1");
    expect(analysed.analysis?.taskId).toBe("an-1");
  });
});

describe("« Modifie la pièce » sans IA", () => {
  const box = WALL_KEY_SHELF.model.parts.find((p) => p.shape === "box")!;

  it("agrandit un trou de 2 mm", () => {
    const drilled = drillHole(WALL_KEY_SHELF, box.id, 8, 0, 0, "y");
    if ("error" in drilled) throw new Error(drilled.error);
    const r = applyEditLocally(drilled.design, "Agrandis le trou de 2 mm", box.id)!;
    const ring = r.design.model.parts.find((p) => p.id === box.id)!.holes[0];
    const xs = ring.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(10, 0);
  });

  it("arrondit les angles et refuse une consigne incomprise", () => {
    const r = applyEditLocally(WALL_KEY_SHELF, "arrondis les angles", box.id)!;
    expect(r.design.model.parts.find((p) => p.id === box.id)!.cornerRadius).toBeGreaterThan(0);
    expect(applyEditLocally(WALL_KEY_SHELF, "chante une chanson", null)).toBeNull();
  });
});
