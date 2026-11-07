import type { SyncTable } from "@/lib/storage/db";

/** Ligne telle que stockée côté serveur. */
export interface RemoteRow {
  /** Clé de la ligne (clé du verset, id du programme, rid de la révision, « app »). */
  key: string;
  /** Contenu (null pour une ligne supprimée). */
  data: Record<string, unknown> | null;
  deleted: boolean;
  /** Horodatage attribué par le serveur : sert de curseur de lecture, jamais de comparaison entre appareils. */
  serverUpdatedAt: string;
}

export interface PushRow {
  key: string;
  data: Record<string, unknown> | null;
  deleted: boolean;
}

/** Ce dont le moteur a besoin du serveur. Implémenté par Supabase et par un faux serveur de test. */
export interface RemoteStore {
  /** Toutes les lignes modifiées depuis `since` (inclus). `null` : tout. */
  pull(table: SyncTable, since: string | null): Promise<RemoteRow[]>;
  push(table: SyncTable, rows: PushRow[]): Promise<void>;
}

export class SyncError extends Error {
  constructor(
    readonly kind: "offline" | "auth" | "server",
    message: string,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  /** Lignes distantes ignorées car invalides. */
  skipped: number;
}
