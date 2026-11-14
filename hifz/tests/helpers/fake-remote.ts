import type { SyncTable } from "@/lib/storage/db";
import type { SyncError} from "@/lib/sync/types";
import { type PushRow, type RemoteRow, type RemoteStore } from "@/lib/sync/types";

/** Faux serveur en mémoire : horodatage serveur croissant, comme la base réelle. */
export class FakeRemote implements RemoteStore {
  tables: Record<SyncTable, Map<string, RemoteRow>> = {
    cards: new Map(),
    programs: new Map(),
    reviews: new Map(),
    settings: new Map(),
  };
  private tick = 0;
  failNext: SyncError | null = null;
  pushes = 0;

  private stamp(): string {
    return new Date(1_800_000_000_000 + ++this.tick * 1000).toISOString();
  }

  async pull(table: SyncTable, since: string | null): Promise<RemoteRow[]> {
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = null;
      throw e;
    }
    return [...this.tables[table].values()]
      .filter((r) => since === null || r.serverUpdatedAt >= since)
      .sort((a, b) => a.serverUpdatedAt.localeCompare(b.serverUpdatedAt));
  }

  async push(table: SyncTable, rows: PushRow[]): Promise<void> {
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = null;
      throw e;
    }
    this.pushes += rows.length;
    for (const r of rows) {
      if (table === "reviews" && this.tables.reviews.has(r.key)) continue;
      this.tables[table].set(r.key, { ...r, serverUpdatedAt: this.stamp() });
    }
  }
}
