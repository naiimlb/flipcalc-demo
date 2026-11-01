import "server-only";
import type { ModelProvider } from "./types";
import { meshyProvider } from "./meshy";

/** Registre des fournisseurs 3D externes (le fournisseur « primitives » est intégré). */
const PROVIDERS: Record<string, ModelProvider> = {
  [meshyProvider.id]: meshyProvider,
};

export function getModelProvider(id: string): ModelProvider | null {
  return PROVIDERS[id] ?? null;
}

/** Vérifie qu'une URL de maillage appartient bien au fournisseur (anti-SSRF). */
export function isAllowedAssetUrl(provider: ModelProvider, url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" && provider.assetHosts.some((h) => hostname === h || hostname.endsWith(`.${h}`))
    );
  } catch {
    return false;
  }
}

export type { ModelAsset, ModelProvider } from "./types";
