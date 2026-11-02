import * as THREE from "three";
import type { Design, Part } from "../design/schema";
import { createPartGeometry, type GeometryDetail } from "../three/geometry";

/**
 * Maillage « monde » de chaque pièce (triangles en millimètres, Y vers le haut), pour les calculs
 * de fabrication : volume, surface, porte-à-faux, encombrement. Fonctionne sans navigateur (tests).
 */
export interface PartMesh {
  part: Part;
  /** Triangles à plat : 9 nombres par triangle (x, y, z de chaque sommet), en mm. */
  positions: Float32Array;
  box: THREE.Box3;
}

const DEG = Math.PI / 180;

export function partMatrix(part: Part): THREE.Matrix4 {
  const rotation = new THREE.Euler(part.rotation.x * DEG, part.rotation.y * DEG, part.rotation.z * DEG, "XYZ");
  return new THREE.Matrix4().compose(
    new THREE.Vector3(part.position.x, part.position.y, part.position.z),
    new THREE.Quaternion().setFromEuler(rotation),
    new THREE.Vector3(1, 1, 1),
  );
}

/**
 * @param orientation rotation appliquée à tout l'objet (orientation d'impression), puis l'objet est reposé sur le plateau (y = 0).
 */
export function buildPartMeshes(design: Design, orientation?: THREE.Matrix4, detail: GeometryDetail = "low"): PartMesh[] {
  const meshes: PartMesh[] = [];
  for (const part of design.model.parts) {
    const source = createPartGeometry(part, detail);
    const geometry = source.index ? source.toNonIndexed() : source;
    const matrix = partMatrix(part);
    if (orientation) matrix.premultiply(orientation);
    geometry.applyMatrix4(matrix);
    const positions = Float32Array.from(geometry.getAttribute("position").array as ArrayLike<number>);
    geometry.computeBoundingBox();
    meshes.push({ part, positions, box: geometry.boundingBox!.clone() });
    geometry.dispose();
    if (geometry !== source) source.dispose();
  }
  // Pose sur le plateau : le point le plus bas à y = 0.
  const minY = Math.min(...meshes.map((m) => m.box.min.y));
  if (Number.isFinite(minY) && Math.abs(minY) > 1e-6) {
    for (const m of meshes) {
      for (let i = 1; i < m.positions.length; i += 3) m.positions[i] -= minY;
      m.box.min.y -= minY;
      m.box.max.y -= minY;
    }
  }
  return meshes;
}

export function meshesBounds(meshes: PartMesh[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const m of meshes) box.union(m.box);
  return box;
}

/** Volume (mm³, théorème de la divergence) et surface (mm²) d'un maillage fermé. */
export function volumeAndArea(positions: Float32Array): { volume: number; area: number } {
  let volume = 0;
  let area = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
    const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5];
    const cx = positions[i + 6], cy = positions[i + 7], cz = positions[i + 8];
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    area += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
  }
  return { volume: Math.abs(volume), area };
}

/** Les 6 orientations d'impression testées (objet couché sur chacune de ses faces principales). */
export const ORIENTATIONS: { id: string; label: string; matrix: () => THREE.Matrix4 }[] = [
  { id: "origine", label: "telle que dessinée", matrix: () => new THREE.Matrix4() },
  { id: "x+90", label: "basculée vers l'avant (90° autour de X)", matrix: () => new THREE.Matrix4().makeRotationX(Math.PI / 2) },
  { id: "x-90", label: "basculée vers l'arrière (-90° autour de X)", matrix: () => new THREE.Matrix4().makeRotationX(-Math.PI / 2) },
  { id: "x180", label: "retournée (180°)", matrix: () => new THREE.Matrix4().makeRotationX(Math.PI) },
  { id: "z+90", label: "couchée sur le côté gauche (90° autour de Z)", matrix: () => new THREE.Matrix4().makeRotationZ(Math.PI / 2) },
  { id: "z-90", label: "couchée sur le côté droit (-90° autour de Z)", matrix: () => new THREE.Matrix4().makeRotationZ(-Math.PI / 2) },
];
