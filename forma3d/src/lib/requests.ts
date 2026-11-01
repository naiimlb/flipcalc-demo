import { validateDesign, type Design } from "./design/schema";
import { SAMPLE_DESIGNS } from "./design/samples";

/** Une demande telle qu'affichée par le tableau de bord (jamais de données sensibles). */
export type RequestStatus = "processing" | "ready" | "error";

export interface PublicAsset {
  provider: string;
  status: "pending" | "running" | "succeeded" | "failed";
  progress: number;
  error: string | null;
}

export interface RequestItem {
  id: string;
  prompt: string;
  status: RequestStatus;
  title: string | null;
  design: Design | null;
  error: string | null;
  provider: string | null;
  model: string | null;
  hasImage: boolean;
  createdAt: string;
  durationMs: number | null;
  asset: PublicAsset | null;
  folderId: string | null;
  isFavorite: boolean;
  /** Chemin du GLB dans Supabase Storage (bucket « models »). */
  modelPath: string | null;
  source: "generated" | "duplicate" | "import";
  /** Exemple de vitrine (visiteur non connecté ou mode démo). */
  sample?: boolean;
  /** Essai sans compte : gardé dans ce navigateur jusqu'à la création du compte. */
  guest?: boolean;
}

export const REQUEST_COLUMNS =
  "id, prompt, has_image, status, title, design, error, provider, model, model_asset, duration_ms, created_at, folder_id, is_favorite, model_path, source";

interface RequestRow {
  id: string;
  prompt: string;
  has_image: boolean | null;
  status: string;
  title: string | null;
  design: unknown;
  error: string | null;
  provider: string | null;
  model: string | null;
  model_asset: unknown;
  duration_ms: number | null;
  created_at: string;
  folder_id?: string | null;
  is_favorite?: boolean | null;
  model_path?: string | null;
  source?: string | null;
}

function toPublicAsset(value: unknown): PublicAsset | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  const status = a.status;
  if (status !== "pending" && status !== "running" && status !== "succeeded" && status !== "failed") return null;
  return {
    provider: String(a.provider ?? ""),
    status,
    progress: typeof a.progress === "number" ? a.progress : 0,
    error: typeof a.error === "string" ? a.error : null,
  };
}

export function toRequestItem(row: RequestRow): RequestItem {
  const validated = row.design ? validateDesign(row.design) : null;
  const status: RequestStatus = row.status === "ready" || row.status === "error" ? row.status : "processing";
  return {
    id: row.id,
    prompt: row.prompt,
    status,
    title: row.title,
    design: validated?.ok ? validated.design : null,
    error: row.error,
    provider: row.provider,
    model: row.model,
    hasImage: Boolean(row.has_image),
    createdAt: row.created_at,
    durationMs: row.duration_ms,
    asset: toPublicAsset(row.model_asset),
    folderId: row.folder_id ?? null,
    isFavorite: Boolean(row.is_favorite),
    modelPath: row.model_path ?? null,
    source: row.source === "duplicate" || row.source === "import" ? row.source : "generated",
  };
}

export function sampleRequests(now = Date.now()): RequestItem[] {
  return SAMPLE_DESIGNS.map((s, i) => ({
    id: s.id,
    prompt: s.prompt,
    status: "ready",
    title: s.design.title,
    design: s.design,
    error: null,
    provider: "exemple",
    model: null,
    hasImage: false,
    createdAt: new Date(now - s.daysAgo * 86_400_000 - i * 3_600_000).toISOString(),
    durationMs: null,
    asset: null,
    folderId: null,
    isFavorite: false,
    modelPath: null,
    source: "generated",
    sample: true,
  }));
}
