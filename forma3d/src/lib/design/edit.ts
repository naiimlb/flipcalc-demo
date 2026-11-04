import { FINISHES, LIMITS, MATERIALS, type Design, type Finish, type MaterialKind, type Part } from "./schema";

/**
 * Modifications d'une conception dans l'éditeur. Fonctions pures : elles renvoient une nouvelle conception
 * (l'ancienne reste intacte, ce qui permet l'historique annuler / rétablir).
 * Les valeurs sont bornées comme à la validation serveur (millimètres, degrés).
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
type Vec = { x: number; y: number; z: number };

const clamp = (n: number, min: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
const round = (n: number) => Math.round(n * 100) / 100;

function clampVec(v: Vec, min: number, max: number): Vec {
  return { x: round(clamp(v.x, min, max)), y: round(clamp(v.y, min, max)), z: round(clamp(v.z, min, max)) };
}

export type PartPatch = Partial<{
  name: string;
  position: Vec;
  rotation: Vec;
  size: Vec;
  color: string;
  material: MaterialKind;
  cornerRadius: number;
  finish: Finish | null;
  locked: boolean;
}>;

function withParts(design: Design, parts: Part[]): Design {
  return { ...design, model: { ...design.model, parts } };
}

/** Applique une modification à une pièce (nom, position, rotation, taille, couleur, matière). */
export function updatePart(design: Design, id: string, patch: PartPatch): Design {
  let changed = false;
  const parts = design.model.parts.map((part) => {
    if (part.id !== id) return part;
    changed = true;
    const next: Part = { ...part };
    if (patch.name !== undefined) next.name = patch.name.trim().slice(0, 80) || part.name;
    if (patch.position) next.position = clampVec(patch.position, -LIMITS.maxCoord, LIMITS.maxCoord);
    if (patch.rotation) next.rotation = clampVec(patch.rotation, -360, 360);
    if (patch.size) next.size = clampVec(patch.size, LIMITS.minSize, LIMITS.maxSize);
    if (patch.color !== undefined && HEX.test(patch.color)) next.color = patch.color.toLowerCase();
    if (patch.material && (MATERIALS as readonly string[]).includes(patch.material)) next.material = patch.material;
    if (patch.cornerRadius !== undefined) next.cornerRadius = round(clamp(patch.cornerRadius, 0, Math.min(next.size.x, next.size.y, next.size.z) / 2));
    if (patch.finish === null) delete next.finish;
    else if (patch.finish && (FINISHES as readonly string[]).includes(patch.finish)) next.finish = patch.finish;
    if (patch.locked !== undefined) {
      if (patch.locked) next.locked = true;
      else delete next.locked;
    }
    return next;
  });
  return changed ? withParts(design, parts) : design;
}

export function uniqueId(base: string, taken: Set<string>): string {
  const stem = base.replace(/-copie(-\d+)?$/, "").slice(0, 28) || "piece";
  let n = 1;
  let id = `${stem}-copie`;
  while (taken.has(id)) id = `${stem}-copie-${++n}`;
  return id;
}

/** Duplique une pièce, décalée sur X pour rester visible. Renvoie aussi l'identifiant de la copie. */
export function duplicatePart(design: Design, id: string): { design: Design; id: string | null } {
  const index = design.model.parts.findIndex((p) => p.id === id);
  if (index < 0 || design.model.parts.length >= LIMITS.maxParts) return { design, id: null };
  const source = design.model.parts[index];
  const taken = new Set(design.model.parts.map((p) => p.id));
  const copyId = uniqueId(source.id, taken);
  const offset = Math.max(source.size.x, 10) + 5;
  const copy: Part = {
    ...source,
    id: copyId,
    name: `${source.name} (copie)`.slice(0, 80),
    position: { ...source.position, x: round(clamp(source.position.x + offset, -LIMITS.maxCoord, LIMITS.maxCoord)) },
    size: { ...source.size },
    rotation: { ...source.rotation },
    profile: source.profile.map((p) => ({ ...p })),
    holes: source.holes.map((ring) => ring.map((p) => ({ ...p }))),
  };
  const parts = [...design.model.parts];
  parts.splice(index + 1, 0, copy);
  return { design: withParts(design, parts), id: copyId };
}

/** Supprime une pièce (la dernière pièce ne peut pas être supprimée : un modèle en contient au moins une). */
export function deletePart(design: Design, id: string): Design {
  if (design.model.parts.length <= 1) return design;
  const parts = design.model.parts.filter((p) => p.id !== id);
  return parts.length === design.model.parts.length ? design : withParts(design, parts);
}

/** Renomme la conception (titre du projet). */
export function renameDesign(design: Design, title: string): Design {
  const next = title.trim().slice(0, 120);
  return next && next !== design.title ? { ...design, title: next } : design;
}

/**
 * Historique illimité des modifications (une conception par étape).
 * Les modifications rapprochées d'un même champ (frappe au clavier, curseur) sont regroupées en une seule étape.
 */
export class EditHistory {
  private past: Design[] = [];
  private future: Design[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;

  /** À appeler avant d'appliquer une modification, avec l'état d'avant. */
  record(previous: Design, key: string | null = null, now = Date.now()) {
    const coalesce = key !== null && key === this.lastKey && now - this.lastAt < 800;
    if (!coalesce) this.past.push(previous);
    this.future = [];
    this.lastKey = key;
    this.lastAt = now;
  }

  undo(current: Design): Design | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(current);
    this.lastKey = null;
    return previous;
  }

  redo(current: Design): Design | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(current);
    this.lastKey = null;
    return next;
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  get size() {
    return this.past.length;
  }
}
