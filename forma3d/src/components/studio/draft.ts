import type { ImagePayload } from "./image";

/**
 * Brouillon de la demande, gardé dans ce navigateur : il survit à un rechargement
 * (mise à jour du site, onglet fermé) tant qu'il n'a pas abouti.
 */
const DRAFT_KEY = "forma3d:draft";
const PENDING_KEY = "forma3d:pending";

export interface Draft {
  prompt: string;
  image: ImagePayload | null;
}

function read(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Draft>;
    return typeof value.prompt === "string" ? { prompt: value.prompt, image: value.image ?? null } : null;
  } catch {
    return null;
  }
}

function write(key: string, draft: Draft | null) {
  try {
    if (!draft || (!draft.prompt && !draft.image)) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Quota dépassé (photo lourde) : on garde au moins le texte.
    try {
      if (draft) localStorage.setItem(key, JSON.stringify({ prompt: draft.prompt, image: null }));
    } catch {
      // stockage indisponible
    }
  }
}

export const readDraft = () => read(DRAFT_KEY);
export const saveDraft = (draft: Draft | null) => write(DRAFT_KEY, draft);
/** Demande envoyée mais pas encore revenue du serveur. */
export const readPending = () => read(PENDING_KEY);
export const savePending = (draft: Draft | null) => write(PENDING_KEY, draft);
