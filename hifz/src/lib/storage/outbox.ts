import type { HifzDB, SyncTable } from "./db";

/**
 * Inscrit une modification à envoyer au serveur. Une seule opération en attente par ligne :
 * la plus récente remplace la précédente. À appeler dans la transaction qui modifie la ligne.
 */
export async function enqueue(
  db: HifzDB,
  table: SyncTable,
  key: string,
  op: "put" | "delete",
  at: string,
): Promise<void> {
  if (!db.trackChanges) return;
  await db.outbox.where("[table+key]").equals([table, key]).delete();
  await db.outbox.add({ table, key, op, at });
}

export async function pendingCount(db: HifzDB): Promise<number> {
  return db.outbox.count();
}
