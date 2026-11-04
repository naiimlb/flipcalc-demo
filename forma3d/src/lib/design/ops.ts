import { Euler, Quaternion, Vector3 } from "three";
import { uniqueId } from "./edit";
import { LIMITS, type Design, type Part, type Shape } from "./schema";

/**
 * Opérations de modélisation de l'éditeur (refonte phase 3). Fonctions pures : elles renvoient une nouvelle conception,
 * ou `{ error }` quand l'opération ne s'applique pas à la forme choisie (rien n'est modifié).
 * Unités : millimètres, degrés (ordre XYZ), Y vers le haut, sol à y = 0. Une extrusion est un profil dans son plan XY,
 * extrudé selon son axe Z local.
 */

export type Vec3 = { x: number; y: number; z: number };
export type Vec2 = { x: number; y: number };
export type Axis = "x" | "y" | "z";
export type OpResult = { design: Design; ids: string[] } | { error: OpError };
export type OpError = "unsupported" | "too-many-parts" | "too-small" | "outside" | "hole-on-cut" | "too-many-holes" | "invalid";

const DEG = Math.PI / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const vec = (x: number, y: number, z: number): Vec3 => ({ x: r2(x), y: r2(y), z: r2(z) });

/* ------------------------------ Repères ------------------------------ */

export function quatOf(r: Vec3): Quaternion {
  return new Quaternion().setFromEuler(new Euler(r.x * DEG, r.y * DEG, r.z * DEG, "XYZ"));
}
export function eulerOf(q: Quaternion): Vec3 {
  const e = new Euler().setFromQuaternion(q, "XYZ");
  const d = (a: number) => r2(Math.abs(a) < 1e-9 ? 0 : a / DEG);
  return { x: d(e.x), y: d(e.y), z: d(e.z) };
}
/** Point exprimé dans le repère de la pièce → position dans la scène. */
export function localToWorld(part: Part, local: Vec3): Vec3 {
  const v = new Vector3(local.x, local.y, local.z).applyQuaternion(quatOf(part.rotation));
  return vec(part.position.x + v.x, part.position.y + v.y, part.position.z + v.z);
}
/** Rotation de la pièce composée avec une rotation locale supplémentaire (ex. extrusion couchée). */
function composeRotation(part: Part, local: Vec3): Vec3 {
  return eulerOf(quatOf(part.rotation).multiply(quatOf(local)));
}

/** Demi-dimensions de la pièce dans son repère (formes de révolution : diamètre = x). */
export function partHalfExtents(part: Part): Vec3 {
  const { x, y, z } = part.size;
  switch (part.shape) {
    case "cylinder":
    case "cone":
    case "tube":
    case "capsule":
      return { x: x / 2, y: y / 2, z: x / 2 };
    case "sphere":
      return { x: x / 2, y: x / 2, z: x / 2 };
    case "torus":
      return { x: x / 2, y: y / 2, z: x / 2 };
    case "extrusion": {
      const b = polygonBounds(part.profile);
      return { x: Math.max(Math.abs(b.minX), Math.abs(b.maxX)), y: Math.max(Math.abs(b.minY), Math.abs(b.maxY)), z: Math.max(z, 0.5) / 2 };
    }
    default:
      return { x: x / 2, y: y / 2, z: z / 2 };
  }
}

/** Boîte englobante approchée (tient compte de la rotation), sans moteur 3D. */
export function designBounds(design: Design): { min: Vec3; max: Vec3; size: Vec3; center: Vec3 } {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const part of design.model.parts) {
    const h = partHalfExtents(part);
    const q = quatOf(part.rotation);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const v = new Vector3(sx * h.x, sy * h.y, sz * h.z).applyQuaternion(q);
          const p = { x: part.position.x + v.x, y: part.position.y + v.y, z: part.position.z + v.z };
          (["x", "y", "z"] as const).forEach((a) => {
            min[a] = Math.min(min[a], p[a]);
            max[a] = Math.max(max[a], p[a]);
          });
        }
  }
  if (!Number.isFinite(min.x)) return { min: vec(0, 0, 0), max: vec(0, 0, 0), size: vec(0, 0, 0), center: vec(0, 0, 0) };
  return {
    min,
    max,
    size: vec(max.x - min.x, max.y - min.y, max.z - min.z),
    center: vec((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2),
  };
}

export function polygonBounds(points: Vec2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

export function polygonArea(points: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function circle(radius: number, n: number, cx = 0, cy = 0): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: r2(cx + Math.cos(a) * radius), y: r2(cy + Math.sin(a) * radius) };
  });
}

/** Simplification d'un tracé (Ramer–Douglas–Peucker), puis plafonnement au nombre de points autorisé. */
export function simplifyPath(points: Vec2[], tolerance: number, max = LIMITS.maxProfilePoints): Vec2[] {
  if (points.length <= 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1;
    let dist = 0;
    const A = points[a];
    const B = points[b];
    const len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    for (let i = a + 1; i < b; i++) {
      const P = points[i];
      const d = Math.abs((B.x - A.x) * (A.y - P.y) - (A.x - P.x) * (B.y - A.y)) / len;
      if (d > dist) {
        dist = d;
        best = i;
      }
    }
    if (best >= 0 && dist > tolerance) {
      keep[best] = true;
      stack.push([a, best], [best, b]);
    }
  }
  let out = points.filter((_, i) => keep[i]);
  if (out.length > max) {
    const step = out.length / max;
    out = Array.from({ length: max }, (_, i) => out[Math.floor(i * step)]);
  }
  return out.map((p) => ({ x: r2(p.x), y: r2(p.y) }));
}

/* ------------------------------ Outils internes ------------------------------ */

/** Identifiant libre : `base`, sinon `base-2`, `base-3`… */
export function freshId(base: string, taken: Set<string>): string {
  const stem = base.slice(0, 36) || "piece";
  if (!taken.has(stem)) return stem;
  let n = 2;
  while (taken.has(`${stem}-${n}`)) n++;
  return `${stem}-${n}`;
}
function freshGroup(design: Design, base: string): string {
  const existing = new Set(design.model.parts.map((p) => p.group).filter((g): g is string => Boolean(g)));
  return freshId(base, existing);
}

function takenIds(design: Design) {
  return new Set(design.model.parts.map((p) => p.id));
}
function withParts(design: Design, parts: Part[]): Design {
  return { ...design, model: { ...design.model, parts } };
}
function findPart(design: Design, id: string) {
  const index = design.model.parts.findIndex((p) => p.id === id);
  return index < 0 ? null : { index, part: design.model.parts[index] };
}
function copyPart(part: Part, id: string, patch: Partial<Part> = {}): Part {
  return {
    ...part,
    id,
    size: { ...part.size },
    position: { ...part.position },
    rotation: { ...part.rotation },
    profile: part.profile.map((p) => ({ ...p })),
    holes: part.holes.map((ring) => ring.map((p) => ({ ...p }))),
    ...patch,
  };
}
function room(design: Design, extra: number) {
  return design.model.parts.length + extra <= LIMITS.maxParts;
}

/* ------------------------------ Ajout de formes ------------------------------ */

export type NewShape = "box" | "cylinder" | "sphere" | "cone" | "torus" | "tube";

const DEFAULT_SIZES: Record<NewShape, Vec3> = {
  box: { x: 40, y: 40, z: 40 },
  cylinder: { x: 40, y: 40, z: 40 },
  sphere: { x: 40, y: 40, z: 40 },
  cone: { x: 40, y: 50, z: 40 },
  torus: { x: 50, y: 10, z: 50 },
  tube: { x: 40, y: 40, z: 3 },
};

export function makePart(id: string, shape: Shape, size: Vec3, position: Vec3, opts: Partial<Part> = {}): Part {
  return {
    id,
    name: id,
    role: "",
    shape,
    size: { ...size },
    position: { ...position },
    rotation: { x: 0, y: 0, z: 0 },
    cornerRadius: 0,
    profile: [],
    holes: [],
    color: "#2f6bff",
    material: "plastic",
    ...opts,
  };
}

/** Ajoute une forme simple, posée au sol à côté du modèle. */
export function addShape(design: Design, shape: NewShape, name: string, color = "#2f6bff"): OpResult {
  if (!room(design, 1)) return { error: "too-many-parts" };
  const b = designBounds(design);
  const size = DEFAULT_SIZES[shape];
  const half = partHalfExtents(makePart("x", shape, size, vec(0, 0, 0)));
  const id = freshId(shape, takenIds(design));
  const part = makePart(id, shape, size, vec(b.max.x + 15 + half.x, half.y, b.center.z), { name, color });
  return { design: withParts(design, [...design.model.parts, part]), ids: [id] };
}

/* ------------------------------ Échelle ------------------------------ */

/** Mise à l'échelle uniforme de tout le modèle (positions, tailles, profils, trous, cotes annoncées). */
export function scaleDesign(design: Design, factor: number): Design {
  const k = clamp(factor, 0.01, 100);
  const s = (v: number, min: number, max: number) => r2(clamp(v * k, min, max));
  const parts = design.model.parts.map((p) => ({
    ...p,
    size: { x: s(p.size.x, LIMITS.minSize, LIMITS.maxSize), y: s(p.size.y, LIMITS.minSize, LIMITS.maxSize), z: s(p.size.z, LIMITS.minSize, LIMITS.maxSize) },
    position: { x: s(p.position.x, -LIMITS.maxCoord, LIMITS.maxCoord), y: s(p.position.y, -LIMITS.maxCoord, LIMITS.maxCoord), z: s(p.position.z, -LIMITS.maxCoord, LIMITS.maxCoord) },
    cornerRadius: r2(p.cornerRadius * k),
    profile: p.profile.map((q) => ({ x: r2(q.x * k), y: r2(q.y * k) })),
    holes: p.holes.map((ring) => ring.map((q) => ({ x: r2(q.x * k), y: r2(q.y * k) }))),
  }));
  return {
    ...withParts(design, parts),
    dimensions: {
      ...design.dimensions,
      width: r2(design.dimensions.width * k),
      depth: r2(design.dimensions.depth * k),
      height: r2(design.dimensions.height * k),
      weightGrams: Math.round(design.dimensions.weightGrams * k * k * k),
    },
  };
}

/**
 * Redimensionnement d'une pièce par facteurs (poignées d'échelle) : chaque forme interprète les facteurs à sa façon
 * (diamètre des formes de révolution, profil des extrusions, épaisseur de paroi des tubes conservée).
 */
export function scalePartBy(design: Design, id: string, s: Vec3): Design {
  const found = findPart(design, id);
  if (!found) return design;
  const p = found.part;
  const k = (v: number) => clamp(Math.abs(v) || 1, 0.01, 100);
  const sx = k(s.x);
  const sy = k(s.y);
  const sz = k(s.z);
  const lim = (v: number) => r2(clamp(v, LIMITS.minSize, LIMITS.maxSize));
  let next: Part;
  switch (p.shape) {
    case "sphere": {
      const u = Math.max(sx, sy, sz) !== 1 ? [sx, sy, sz].reduce((a, b) => (Math.abs(b - 1) > Math.abs(a - 1) ? b : a), 1) : 1;
      next = { ...p, size: { x: lim(p.size.x * u), y: lim(p.size.y * u), z: lim(p.size.z * u) } };
      break;
    }
    case "cylinder":
    case "cone":
    case "capsule":
    case "torus": {
      const r = Math.abs(sx - 1) >= Math.abs(sz - 1) ? sx : sz;
      next = { ...p, size: { x: lim(p.size.x * r), y: lim(p.size.y * sy), z: p.size.z } };
      break;
    }
    case "tube": {
      const r = Math.abs(sx - 1) >= Math.abs(sz - 1) ? sx : sz;
      next = { ...p, size: { x: lim(p.size.x * r), y: lim(p.size.y * sy), z: p.size.z } };
      break;
    }
    case "extrusion":
      next = {
        ...p,
        size: { x: lim(p.size.x * sx), y: lim(p.size.y * sy), z: lim(p.size.z * sz) },
        profile: p.profile.map((q) => ({ x: r2(q.x * sx), y: r2(q.y * sy) })),
        holes: p.holes.map((ring) => ring.map((q) => ({ x: r2(q.x * sx), y: r2(q.y * sy) }))),
      };
      break;
    default:
      next = { ...p, size: { x: lim(p.size.x * sx), y: lim(p.size.y * sy), z: lim(p.size.z * sz) }, cornerRadius: r2(p.cornerRadius * Math.min(sx, sy, sz)) };
  }
  const parts = [...design.model.parts];
  parts[found.index] = next;
  return withParts(design, parts);
}

/** « Mettre à l'échelle réelle » : la plus grande dimension (ou une dimension choisie) prend la valeur donnée en mm. */
export function scaleToSize(design: Design, mm: number, along: "longest" | Axis = "longest"): Design {
  const b = designBounds(design).size;
  const current = along === "longest" ? Math.max(b.x, b.y, b.z) : b[along];
  if (!(current > 0) || !(mm > 0)) return design;
  return scaleDesign(design, mm / current);
}

/* ------------------------------ Miroir et répétition ------------------------------ */

/** Copie symétrique d'une pièce par rapport au plan médian du modèle (normal à l'axe choisi). */
export function mirrorPart(design: Design, id: string, axis: Axis): OpResult {
  const found = findPart(design, id);
  if (!found) return { error: "invalid" };
  if (!room(design, 1)) return { error: "too-many-parts" };
  const { part } = found;
  const center = designBounds(design).center;
  const position = { ...part.position, [axis]: r2(2 * center[axis] - part.position[axis]) };
  const rotation =
    axis === "x"
      ? { x: part.rotation.x, y: -part.rotation.y, z: -part.rotation.z }
      : axis === "y"
        ? { x: -part.rotation.x, y: part.rotation.y, z: -part.rotation.z }
        : { x: -part.rotation.x, y: -part.rotation.y, z: part.rotation.z };
  const flip = (p: Vec2) => (axis === "x" ? { x: -p.x, y: p.y } : axis === "y" ? { x: p.x, y: -p.y } : p);
  const copyId = uniqueId(part.id, takenIds(design));
  const copy = copyPart(part, copyId, {
    name: `${part.name} (miroir)`.slice(0, 80),
    position,
    rotation,
    profile: part.profile.map(flip),
    holes: part.holes.map((ring) => ring.map(flip)),
  });
  const parts = [...design.model.parts];
  parts.splice(found.index + 1, 0, copy);
  return { design: withParts(design, parts), ids: [copyId] };
}

/** Répétition en ligne : `count` exemplaires au total, espacés de `spacing` mm selon l'axe. */
export function arrayLinear(design: Design, id: string, count: number, spacing: number, axis: Axis): OpResult {
  const found = findPart(design, id);
  const n = Math.round(clamp(count, 2, 30));
  if (!found) return { error: "invalid" };
  if (!room(design, n - 1)) return { error: "too-many-parts" };
  const taken = takenIds(design);
  const copies: Part[] = [];
  for (let i = 1; i < n; i++) {
    const copyId = uniqueId(found.part.id, taken);
    taken.add(copyId);
    const position = { ...found.part.position, [axis]: r2(clamp(found.part.position[axis] + spacing * i, -LIMITS.maxCoord, LIMITS.maxCoord)) };
    copies.push(copyPart(found.part, copyId, { name: `${found.part.name} ${i + 1}`.slice(0, 80), position }));
  }
  const parts = [...design.model.parts];
  parts.splice(found.index + 1, 0, ...copies);
  return { design: withParts(design, parts), ids: copies.map((c) => c.id) };
}

/** Répétition en cercle autour de l'axe vertical passant par le centre du modèle. */
export function arrayCircular(design: Design, id: string, count: number): OpResult {
  const found = findPart(design, id);
  const n = Math.round(clamp(count, 2, 36));
  if (!found) return { error: "invalid" };
  if (!room(design, n - 1)) return { error: "too-many-parts" };
  const center = designBounds(design).center;
  const taken = takenIds(design);
  const copies: Part[] = [];
  for (let i = 1; i < n; i++) {
    const angle = (360 / n) * i;
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle * DEG);
    const rel = new Vector3(found.part.position.x - center.x, 0, found.part.position.z - center.z).applyQuaternion(q);
    const copyId = uniqueId(found.part.id, taken);
    taken.add(copyId);
    copies.push(
      copyPart(found.part, copyId, {
        name: `${found.part.name} ${i + 1}`.slice(0, 80),
        position: vec(center.x + rel.x, found.part.position.y, center.z + rel.z),
        rotation: eulerOf(q.multiply(quatOf(found.part.rotation))),
      }),
    );
  }
  const parts = [...design.model.parts];
  parts.splice(found.index + 1, 0, ...copies);
  return { design: withParts(design, parts), ids: copies.map((c) => c.id) };
}

/* ------------------------------ Couper en deux ------------------------------ */

/** Découpe d'un polygone par le demi-plan (coordonnée `axis` du profil ≥ 0 si `positive`). */
function clipHalf(points: Vec2[], axis: "x" | "y", positive: boolean): Vec2[] {
  const inside = (p: Vec2) => (positive ? p[axis] >= 0 : p[axis] <= 0);
  const out: Vec2[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = a[axis] / (a[axis] - b[axis]);
      out.push({ x: r2(a.x + (b.x - a.x) * t), y: r2(a.y + (b.y - a.y) * t) });
    }
  }
  return out;
}

/** Coupe une pièce en deux moitiés selon un axe de la pièce (pavé, cylindre ou tube en hauteur, profilé). */
export function cutInHalf(design: Design, id: string, axis: Axis): OpResult {
  const found = findPart(design, id);
  if (!found) return { error: "invalid" };
  if (!room(design, 1)) return { error: "too-many-parts" };
  const { part } = found;
  const taken = takenIds(design);
  const idA = freshId(`${part.id}-a`, taken);
  taken.add(idA);
  const idB = freshId(`${part.id}-b`, taken);
  const named = (i: 1 | 2) => `${part.name} (${i}/2)`.slice(0, 80);
  let halves: [Part, Part] | null = null;

  const splitAlong = (size: Vec3, sizeAxis: Axis, offsetAxis: Axis) => {
    const half = size[sizeAxis] / 2;
    if (half < LIMITS.minSize) return null;
    const off = { x: 0, y: 0, z: 0, [offsetAxis]: half / 2 };
    const neg = { x: 0, y: 0, z: 0, [offsetAxis]: -half / 2 };
    const sz = { ...size, [sizeAxis]: r2(half) };
    return [
      copyPart(part, idA, { name: named(1), size: sz, position: localToWorld(part, off) }),
      copyPart(part, idB, { name: named(2), size: { ...sz }, position: localToWorld(part, neg) }),
    ] as [Part, Part];
  };

  if (part.shape === "box") halves = splitAlong(part.size, axis, axis);
  else if ((part.shape === "cylinder" || part.shape === "tube") && axis === "y") halves = splitAlong(part.size, "y", "y");
  else if (part.shape === "extrusion") {
    if (axis === "z") halves = splitAlong(part.size, "z", "z");
    else {
      const a = axis as "x" | "y";
      if (part.holes.some((ring) => ring.some((p) => p[a] > 0) && ring.some((p) => p[a] < 0))) return { error: "hole-on-cut" };
      const pos = clipHalf(part.profile, a, true);
      const negP = clipHalf(part.profile, a, false);
      if (pos.length < 3 || negP.length < 3) return { error: "too-small" };
      halves = [
        copyPart(part, idA, { name: named(1), profile: pos, holes: part.holes.filter((r) => r.every((p) => p[a] >= 0)) }),
        copyPart(part, idB, { name: named(2), profile: negP, holes: part.holes.filter((r) => r.every((p) => p[a] <= 0)) }),
      ];
    }
  } else return { error: "unsupported" };
  if (!halves) return { error: "too-small" };
  const parts = [...design.model.parts];
  parts.splice(found.index, 1, ...halves);
  return { design: withParts(design, parts), ids: [idA, idB] };
}

/* ------------------------------ Évider ------------------------------ */

/**
 * Évide une pièce avec une épaisseur de paroi : pavé → boîte ouverte (fond + 4 parois), cylindre → tube avec fond,
 * tube → nouvelle épaisseur. Les morceaux restent assemblés (même groupe).
 */
export function hollowPart(design: Design, id: string, thickness: number): OpResult {
  const found = findPart(design, id);
  if (!found) return { error: "invalid" };
  const { part } = found;
  const t = r2(clamp(thickness, 0.4, 200));
  const group = part.group || freshGroup(design, `assemblage-${part.id}`.slice(0, 30));
  const taken = takenIds(design);
  const next = (suffix: string) => {
    const v = freshId(`${part.id}-${suffix}`, taken);
    taken.add(v);
    return v;
  };
  let pieces: Part[];
  if (part.shape === "box") {
    const { x, y, z } = part.size;
    if (2 * t >= Math.min(x, z) || t >= y) return { error: "too-small" };
    if (!room(design, 4)) return { error: "too-many-parts" };
    const wallH = y - t;
    const yWall = -y / 2 + t + wallH / 2;
    const piece = (suffix: string, name: string, size: Vec3, local: Vec3): Part =>
      copyPart(part, next(suffix), { name: `${part.name} · ${name}`.slice(0, 80), size: vec(size.x, size.y, size.z), position: localToWorld(part, local), cornerRadius: 0, group });
    pieces = [
      piece("fond", "fond", { x, y: t, z }, { x: 0, y: -y / 2 + t / 2, z: 0 }),
      piece("avant", "paroi avant", { x, y: wallH, z: t }, { x: 0, y: yWall, z: z / 2 - t / 2 }),
      piece("arriere", "paroi arrière", { x, y: wallH, z: t }, { x: 0, y: yWall, z: -z / 2 + t / 2 }),
      piece("gauche", "paroi gauche", { x: t, y: wallH, z: z - 2 * t }, { x: -x / 2 + t / 2, y: yWall, z: 0 }),
      piece("droite", "paroi droite", { x: t, y: wallH, z: z - 2 * t }, { x: x / 2 - t / 2, y: yWall, z: 0 }),
    ];
  } else if (part.shape === "cylinder") {
    const { x, y } = part.size;
    if (2 * t >= x || t >= y) return { error: "too-small" };
    if (!room(design, 1)) return { error: "too-many-parts" };
    pieces = [
      copyPart(part, next("fond"), { name: `${part.name} · fond`.slice(0, 80), size: vec(x, t, x), position: localToWorld(part, { x: 0, y: -y / 2 + t / 2, z: 0 }), group }),
      copyPart(part, next("paroi"), {
        name: `${part.name} · paroi`.slice(0, 80),
        shape: "tube",
        size: vec(x, y - t, t),
        position: localToWorld(part, { x: 0, y: t / 2, z: 0 }),
        group,
      }),
    ];
  } else if (part.shape === "tube") {
    if (2 * t >= part.size.x) return { error: "too-small" };
    pieces = [copyPart(part, part.id, { size: { ...part.size, z: t } })];
  } else return { error: "unsupported" };
  const parts = [...design.model.parts];
  parts.splice(found.index, 1, ...pieces);
  return { design: withParts(design, parts), ids: pieces.map((p) => p.id) };
}

/* ------------------------------ Percer, congé, chanfrein ------------------------------ */

function roundedRect(w: number, h: number, r: number): Vec2[] {
  const rr = clamp(r, 0, Math.min(w, h) / 2 - 0.01);
  if (rr < 0.3) return [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }].map((p) => ({ x: r2(p.x), y: r2(p.y) }));
  const pts: Vec2[] = [];
  const corners = [
    { cx: w / 2 - rr, cy: -h / 2 + rr, a0: -90 },
    { cx: w / 2 - rr, cy: h / 2 - rr, a0: 0 },
    { cx: -w / 2 + rr, cy: h / 2 - rr, a0: 90 },
    { cx: -w / 2 + rr, cy: -h / 2 + rr, a0: 180 },
  ];
  for (const c of corners) for (let i = 0; i <= 6; i++) {
    const a = (c.a0 + (90 * i) / 6) * DEG;
    pts.push({ x: r2(c.cx + Math.cos(a) * rr), y: r2(c.cy + Math.sin(a) * rr) });
  }
  return pts;
}

/**
 * Perce un trou de diamètre exact, traversant la pièce, à la position (u, v) en mm depuis son centre.
 * `along` = axe du perçage dans le repère de la pièce : « y » (vertical) ou « z ».
 * Pavés et cylindres sont convertis en profilés ; un profilé reçoit simplement un trou de plus (selon Z).
 */
export function drillHole(design: Design, id: string, diameter: number, u: number, v: number, along: "y" | "z"): OpResult {
  const found = findPart(design, id);
  if (!found) return { error: "invalid" };
  const { part } = found;
  const d = clamp(diameter, 0.5, 2000);
  let profile: Vec2[];
  let depth: number;
  let rotation = part.rotation;
  let holes = part.holes;
  // Coordonnées du trou dans le plan du profil.
  const hx = u;
  let hy = v;
  if (part.shape === "extrusion") {
    if (along !== "z") return { error: "unsupported" };
    profile = part.profile;
    depth = part.size.z;
  } else if (part.shape === "box" || part.shape === "cylinder") {
    const round = part.shape === "cylinder";
    const w = part.size.x;
    if (along === "z" && !round) {
      profile = roundedRect(w, part.size.y, part.cornerRadius);
      depth = part.size.z;
    } else {
      // Perçage vertical : profil dans le plan X-Z de la pièce, extrudé selon son Y (profil couché : rotation -90° sur X).
      const deep = round ? part.size.x : part.size.z;
      profile = round ? circle(w / 2, 48) : roundedRect(w, deep, part.cornerRadius);
      depth = part.size.y;
      rotation = composeRotation(part, { x: -90, y: 0, z: 0 });
      hy = -v;
      if (round && along === "z") return { error: "unsupported" };
    }
    holes = [];
  } else return { error: "unsupported" };
  if (holes.length >= LIMITS.maxHoles) return { error: "too-many-holes" };
  const b = polygonBounds(profile);
  if (hx - d / 2 < b.minX || hx + d / 2 > b.maxX || hy - d / 2 < b.minY || hy + d / 2 > b.maxY) return { error: "outside" };
  const hole = circle(d / 2, 32, hx, hy);
  const next: Part = {
    ...part,
    shape: "extrusion",
    profile,
    holes: [...holes.map((r) => r.map((p) => ({ ...p }))), hole],
    rotation,
    size: vec(b.maxX - b.minX, b.maxY - b.minY, depth),
    cornerRadius: 0,
  };
  const parts = [...design.model.parts];
  parts[found.index] = next;
  return { design: withParts(design, parts), ids: [part.id] };
}

/** Congé : arrondit toutes les arêtes d'un pavé (rayon en mm). */
export function filletPart(design: Design, id: string, radius: number): OpResult {
  const found = findPart(design, id);
  if (!found || found.part.shape !== "box") return { error: found ? "unsupported" : "invalid" };
  const { size } = found.part;
  const parts = [...design.model.parts];
  parts[found.index] = { ...found.part, cornerRadius: r2(clamp(radius, 0, Math.min(size.x, size.y, size.z) / 2 - 0.01)) };
  return { design: withParts(design, parts), ids: [id] };
}

/** Chanfrein : coupe à 45° les 4 arêtes verticales d'un pavé (devient un profilé couché). */
export function chamferPart(design: Design, id: string, size: number): OpResult {
  const found = findPart(design, id);
  if (!found || found.part.shape !== "box") return { error: found ? "unsupported" : "invalid" };
  const { part } = found;
  const w = part.size.x;
  const dz = part.size.z;
  const c = clamp(size, 0.2, Math.min(w, dz) / 2 - 0.1);
  if (c <= 0.2 && Math.min(w, dz) < 1) return { error: "too-small" };
  const hw = w / 2;
  const hd = dz / 2;
  // Profil dans le plan X-Z de la pièce (y du profil = -z), extrudé selon Y.
  const profile = [
    { x: -hw + c, y: -hd }, { x: hw - c, y: -hd }, { x: hw, y: -hd + c }, { x: hw, y: hd - c },
    { x: hw - c, y: hd }, { x: -hw + c, y: hd }, { x: -hw, y: hd - c }, { x: -hw, y: -hd + c },
  ].map((p) => ({ x: r2(p.x), y: r2(p.y) }));
  const parts = [...design.model.parts];
  parts[found.index] = {
    ...part,
    shape: "extrusion",
    profile,
    holes: [],
    rotation: composeRotation(part, { x: -90, y: 0, z: 0 }),
    size: vec(w, dz, part.size.y),
    cornerRadius: 0,
  };
  return { design: withParts(design, parts), ids: [id] };
}

/* ------------------------------ Assembler, verrouiller ------------------------------ */

/** Assemble des pièces (même groupe : elles se sélectionnent et se déplacent ensemble). */
export function groupParts(design: Design, ids: string[]): OpResult {
  if (ids.length < 2) return { error: "invalid" };
  const group = freshGroup(design, "assemblage");
  return { design: withParts(design, design.model.parts.map((p) => (ids.includes(p.id) ? { ...p, group } : p))), ids };
}

/** Sépare des pièces de leur assemblage. */
export function ungroupParts(design: Design, ids: string[]): OpResult {
  const parts = design.model.parts.map((p) => {
    if (!ids.includes(p.id) || !p.group) return p;
    const { group: _g, ...rest } = p;
    void _g;
    return rest as Part;
  });
  return { design: withParts(design, parts), ids };
}

/** Pièces d'un même assemblage que `id` (elle-même incluse). */
export function groupMembers(design: Design, id: string): string[] {
  const part = design.model.parts.find((p) => p.id === id);
  if (!part?.group) return part ? [id] : [];
  return design.model.parts.filter((p) => p.group === part.group).map((p) => p.id);
}

/** Déplace plusieurs pièces d'un même décalage (assemblage, sélection multiple). */
export function translateParts(design: Design, ids: string[], delta: Vec3): Design {
  const m = LIMITS.maxCoord;
  return withParts(
    design,
    design.model.parts.map((p) =>
      ids.includes(p.id) && !p.locked
        ? { ...p, position: vec(clamp(p.position.x + delta.x, -m, m), clamp(p.position.y + delta.y, -m, m), clamp(p.position.z + delta.z, -m, m)) }
        : p,
    ),
  );
}

/** Supprime plusieurs pièces (le modèle garde au moins une pièce). */
export function deleteParts(design: Design, ids: string[]): Design {
  const parts = design.model.parts.filter((p) => !ids.includes(p.id));
  return parts.length ? withParts(design, parts) : design;
}

/* ------------------------------ Forme libre et texte ------------------------------ */

/**
 * Forme libre : un tracé fermé (en mm, dans le plan du sol) extrudé vers le haut de `thickness` mm.
 * Le tracé est simplifié ; la pièce est posée au sol à côté du modèle (ou au centre si le modèle est vide).
 */
export function freeformPart(design: Design, path: Vec2[], thickness: number, name: string, color = "#ff6b4a"): OpResult {
  if (!room(design, 1)) return { error: "too-many-parts" };
  const simplified = simplifyPath(path, 0.6);
  if (simplified.length < 3 || Math.abs(polygonArea(simplified)) < 4) return { error: "too-small" };
  const b = polygonBounds(simplified);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const profile = simplified.map((p) => ({ x: r2(p.x - cx), y: r2(p.y - cy) }));
  const t = r2(clamp(thickness, 0.5, 500));
  const bounds = designBounds(design);
  const w = b.maxX - b.minX;
  const id = freshId("forme-libre", takenIds(design));
  const part = makePart(id, "extrusion", vec(w, b.maxY - b.minY, t), vec(design.model.parts.length ? bounds.max.x + 15 + w / 2 : 0, t / 2, bounds.center.z), {
    name,
    color,
    profile,
    // Couchée : son axe d'extrusion devient la verticale.
    rotation: { x: -90, y: 0, z: 0 },
  });
  return { design: withParts(design, [...design.model.parts, part]), ids: [id] };
}

/** Contours d'un caractère (en mm), tels que produits par une police vectorielle. */
export interface GlyphShape {
  outer: Vec2[];
  holes: Vec2[][];
}

/**
 * Texte en relief (lettres posées sur la face supérieure de la pièce support, ou au sol) ou gravé
 * (creusé dans le dessus d'un pavé support : couche supérieure percée de la forme des lettres).
 */
export function addText(
  design: Design,
  shapes: GlyphShape[],
  opts: { mode: "relief" | "engrave"; depth: number; supportId: string | null; name: string; color: string },
): OpResult {
  const glyphs = shapes
    .map((s) => ({ outer: simplifyPath(s.outer, 0.15), holes: s.holes.map((h) => simplifyPath(h, 0.15)).filter((h) => h.length >= 3) }))
    .filter((s) => s.outer.length >= 3);
  if (!glyphs.length) return { error: "invalid" };
  const all = glyphs.flatMap((g) => g.outer);
  const tb = polygonBounds(all);
  const tcx = (tb.minX + tb.maxX) / 2;
  const tcy = (tb.minY + tb.maxY) / 2;
  const depth = r2(clamp(opts.depth, 0.4, 100));
  const support = opts.supportId ? design.model.parts.find((p) => p.id === opts.supportId) ?? null : null;
  const taken = takenIds(design);
  const nextId = (base: string) => {
    const v = freshId(base, taken);
    taken.add(v);
    return v;
  };

  if (opts.mode === "engrave") {
    if (!support || support.shape !== "box") return { error: "unsupported" };
    const { x, y, z } = support.size;
    if (depth >= y) return { error: "too-small" };
    if (tb.maxX - tb.minX > x || tb.maxY - tb.minY > z) return { error: "outside" };
    if (glyphs.length > LIMITS.maxHoles) return { error: "too-many-holes" };
    const islands = glyphs.flatMap((g) => g.holes);
    if (!room(design, 1 + islands.length)) return { error: "too-many-parts" };
    const group = support.group || freshGroup(design, `assemblage-${support.id}`.slice(0, 30));
    // Profil couché (Rx -90°) : son y correspond à -z de la pièce ; le haut des lettres part vers l'arrière, lisible de face.
    const toProfile = (p: Vec2) => ({ x: r2(p.x - tcx), y: r2(p.y - tcy) });
    const base = copyPart(support, support.id, {
      size: vec(x, y - depth, z),
      position: localToWorld(support, { x: 0, y: -depth / 2, z: 0 }),
      group,
    });
    const layerRot = composeRotation(support, { x: -90, y: 0, z: 0 });
    const layerPos = localToWorld(support, { x: 0, y: y / 2 - depth / 2, z: 0 });
    const layer = makePart(nextId(`${support.id}-gravure`), "extrusion", vec(x, z, depth), layerPos, {
      name: `${opts.name} (gravure)`.slice(0, 80),
      color: support.color,
      material: support.material,
      rotation: layerRot,
      profile: roundedRect(x, z, 0),
      holes: glyphs.map((g) => g.outer.map(toProfile)),
      group,
    });
    const islandParts = islands.map((ring, i) =>
      makePart(nextId(`${support.id}-ilot-${i + 1}`), "extrusion", vec(1, 1, depth), layerPos, {
        name: `${opts.name} (îlot ${i + 1})`.slice(0, 80),
        color: support.color,
        material: support.material,
        rotation: layerRot,
        profile: ring.map(toProfile),
        group,
      }),
    );
    const parts = design.model.parts.flatMap((p) => (p.id === support.id ? [base, layer, ...islandParts] : [p]));
    return { design: withParts(design, parts), ids: [layer.id] };
  }

  // Relief : une pièce par contour de lettre, couchée sur le dessus du support (ou au sol).
  if (!room(design, glyphs.length)) return { error: "too-many-parts" };
  const group = freshGroup(design, "texte");
  const top = support ? partHalfExtents(support).y : 0;
  const parts: Part[] = glyphs.map((g, i) => {
    const gb = polygonBounds(g.outer);
    const gcx = (gb.minX + gb.maxX) / 2;
    const gcy = (gb.minY + gb.maxY) / 2;
    const local = { x: gcx - tcx, y: top + depth / 2, z: -(gcy - tcy) };
    const position = support ? localToWorld(support, local) : vec(local.x, depth / 2, local.z + designBounds(design).max.z + 20);
    const shift = (p: Vec2) => ({ x: r2(p.x - gcx), y: r2(p.y - gcy) });
    return makePart(nextId(`lettre-${i + 1}`), "extrusion", vec(gb.maxX - gb.minX, gb.maxY - gb.minY, depth), position, {
      name: `${opts.name} ${i + 1}`.slice(0, 80),
      color: opts.color,
      rotation: support ? composeRotation(support, { x: -90, y: 0, z: 0 }) : { x: -90, y: 0, z: 0 },
      profile: g.outer.map(shift),
      holes: g.holes.slice(0, LIMITS.maxHoles).map((h) => h.map(shift)),
      group,
    });
  });
  return { design: withParts(design, [...design.model.parts, ...parts]), ids: parts.map((p) => p.id) };
}

/* ------------------------------ Modifications proposées par l'IA ------------------------------ */

export type AiOp = { op: "replace"; part: Part } | { op: "add"; part: Part } | { op: "delete"; id: string };

/** Applique les changements proposés par l'IA (« Modifie la pièce ») ; les identifiants inconnus sont ignorés. */
export function applyAiOps(design: Design, ops: AiOp[]): { design: Design; ids: string[] } {
  let parts = [...design.model.parts];
  const ids: string[] = [];
  for (const o of ops) {
    if (o.op === "replace") {
      const i = parts.findIndex((p) => p.id === o.part.id);
      if (i >= 0) {
        parts[i] = { ...o.part, group: parts[i].group, locked: parts[i].locked, finish: o.part.finish ?? parts[i].finish };
        ids.push(o.part.id);
      }
    } else if (o.op === "add") {
      if (parts.length >= LIMITS.maxParts) continue;
      const taken = new Set(parts.map((p) => p.id));
      const id = taken.has(o.part.id) ? uniqueId(o.part.id, taken) : o.part.id;
      parts.push({ ...o.part, id });
      ids.push(id);
    } else if (o.op === "delete" && parts.length > 1) {
      parts = parts.filter((p) => p.id !== o.id);
    }
  }
  return { design: withParts(design, parts), ids };
}
