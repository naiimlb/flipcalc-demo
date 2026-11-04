import type { Design } from "../design/schema";

/**
 * Interface « fournisseur 3D ».
 *
 * Le fournisseur intégré (`primitives`) n'a rien à faire : le modèle est déjà décrit
 * par Claude sous forme de primitives (design.model.parts) et rendu par la visionneuse.
 *
 * Un service text-to-3D externe (Meshy, Tripo, Rodin…) produit un vrai maillage de
 * façon asynchrone : `start` lance une tâche, `poll` donne son avancement, et la
 * visionneuse charge le GLB via /api/requests/[id]/asset/file quand il est prêt.
 * Pour en ajouter un : implémenter cette interface puis l'enregistrer dans ./index.ts.
 */
export type AssetStatus = "pending" | "running" | "succeeded" | "failed";

export interface ModelAsset {
  provider: string;
  taskId: string;
  status: AssetStatus;
  progress: number;
  /** URL du GLB chez le fournisseur (jamais exposée telle quelle au navigateur). */
  glbUrl?: string | null;
  error?: string | null;
  updatedAt: string;
  /** Meshy : action qui a produit ce maillage (aperçu, texture, retexture, remesh, échelle, réparation). */
  kind?: string;
  /** Description de texture (retexture). */
  prompt?: string;
  /** Copie du GLB dans Supabase Storage (les liens Meshy expirent). */
  storedPath?: string | null;
  /** Maillages Meshy précédents du projet (variantes), du plus récent au plus ancien. */
  history?: { taskId: string; kind: string; glbUrl?: string | null; storedPath?: string | null; createdAt: string }[];
  /** Dernière analyse d'imprimabilité Meshy. */
  analysis?: {
    taskId: string;
    status: AssetStatus;
    progress: number;
    result?: { status: string; issueCount: number; errorCount: number; warningCount: number; metrics: Record<string, number | boolean | null> } | null;
    error?: string | null;
    updatedAt: string;
  } | null;
}

export interface ModelProvider {
  id: string;
  label: string;
  /** Nom du secret contenant la clé d'API (null si aucune). */
  secretName: "MESHY_API_KEY" | null;
  /** Hôtes autorisés pour télécharger les GLB (protection SSRF du proxy). */
  assetHosts: string[];
  start(input: { prompt: string; design: Design; apiKey: string }): Promise<ModelAsset>;
  poll(asset: ModelAsset, apiKey: string): Promise<ModelAsset>;
}
