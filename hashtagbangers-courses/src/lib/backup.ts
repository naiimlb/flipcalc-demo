import { sanitizeSnapshot, type AppState } from '../state/snapshot';

export const BACKUP_APP = 'hashtagbangers-courses';
export const BACKUP_VERSION = 2;

export interface Backup extends AppState {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: number;
}

/** Contenu du fichier « Exporter mes données » : listes, historique, réglages et catégories mémorisées. */
export function buildBackup(state: AppState, now = Date.now()): Backup {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now, ...state };
}

export function backupFileName(now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `hashtagbangers-courses-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export type ParsedBackup =
  | { ok: true; state: AppState; exportedAt: number | null; listCount: number; learnedCount: number }
  | { ok: false; error: string };

/** Lit un fichier de sauvegarde. Tout est validé et nettoyé : un fichier abîmé ne peut pas casser l'app. */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Ce fichier est illisible (JSON invalide).' };
  }
  const r = data as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || r.app !== BACKUP_APP || !Array.isArray(r.lists)) {
    return { ok: false, error: 'Ce fichier n’est pas une sauvegarde Hashtagbangers Courses.' };
  }
  if (typeof r.version === 'number' && r.version > BACKUP_VERSION) {
    return { ok: false, error: 'Cette sauvegarde vient d’une version plus récente de l’app. Mets l’app à jour.' };
  }
  const state = sanitizeSnapshot(r);
  if (!state) return { ok: false, error: 'Cette sauvegarde est vide ou abîmée.' };
  return {
    ok: true,
    state,
    exportedAt: typeof r.exportedAt === 'number' ? r.exportedAt : null,
    listCount: state.lists.length,
    learnedCount: Object.keys(state.settings.learned).length,
  };
}
