import type { HifzDB } from "@/lib/storage/db";
import { syncOnce } from "./engine";
import { SyncError, type RemoteStore } from "./types";

export type SyncState = "idle" | "syncing" | "offline" | "auth" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: string | null;
  message: string | null;
}

/**
 * Pilote la synchronisation d'un compte : une seule synchronisation à la fois, déclenchée à la
 * demande (avec un petit délai pour regrouper les modifications) ou par le réseau/l'utilisateur.
 */
export class SyncController {
  private status: SyncStatus = { state: "idle", lastSyncAt: null, message: null };
  private listeners = new Set<(s: SyncStatus) => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private readonly onChange = () => this.request();

  private readonly now: () => Date;
  private readonly debounceMs: number;

  constructor(
    private readonly db: HifzDB,
    private readonly remote: RemoteStore,
    options: { now?: () => Date; debounceMs?: number } = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.debounceMs = options.debounceMs ?? 1500;
    // Toute nouvelle modification locale planifie un envoi.
    db.outbox.hook("creating", this.onChange);
    void db.meta.get("sync").then((m) => m && !this.disposed && this.set({ lastSyncAt: m.lastSyncAt }));
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: (s: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Planifie une synchronisation (regroupe les demandes rapprochées). */
  request(delayMs = this.debounceMs): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncNow();
    }, delayMs);
  }

  /** Synchronise maintenant. Si une synchronisation est en cours, une nouvelle passe suivra. */
  syncNow(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async loop(): Promise<void> {
    do {
      this.again = false;
      this.set({ state: "syncing", message: null });
      try {
        await syncOnce(this.db, this.remote, this.now());
        this.set({ state: "idle", lastSyncAt: this.now().toISOString(), message: null });
      } catch (error) {
        if (this.disposed) return;
        if (error instanceof SyncError) {
          this.set({ state: error.kind === "offline" ? "offline" : error.kind === "auth" ? "auth" : "error", message: error.message });
        } else if (typeof navigator !== "undefined" && navigator.onLine === false) {
          this.set({ state: "offline", message: "Hors ligne : vos modifications seront envoyées au retour du réseau." });
        } else {
          this.set({ state: "error", message: "La synchronisation a échoué. Vos données restent sur cet appareil." });
        }
        return;
      }
    } while (this.again && !this.disposed);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
    try {
      this.db.outbox.hook("creating").unsubscribe(this.onChange);
    } catch {
      // Base déjà fermée.
    }
  }

  private set(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const l of this.listeners) l(this.status);
  }
}
