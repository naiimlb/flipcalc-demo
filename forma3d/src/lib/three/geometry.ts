import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Design, MaterialKind, Part } from "../design/schema";

/** 1 unité de scène = 100 mm (les conceptions sont en millimètres). */
export const SCENE_SCALE = 0.01;

const DEG = Math.PI / 180;

export const MATERIAL_PRESETS: Record<MaterialKind, { metalness: number; roughness: number; opacity: number }> = {
  plastic: { metalness: 0, roughness: 0.42, opacity: 1 },
  metal: { metalness: 0.9, roughness: 0.28, opacity: 1 },
  wood: { metalness: 0, roughness: 0.78, opacity: 1 },
  glass: { metalness: 0.1, roughness: 0.05, opacity: 0.45 },
  rubber: { metalness: 0, roughness: 0.95, opacity: 1 },
  fabric: { metalness: 0, roughness: 1, opacity: 1 },
  ceramic: { metalness: 0.05, roughness: 0.22, opacity: 1 },
};

export const MATERIAL_LABELS: Record<MaterialKind, string> = {
  plastic: "Plastique",
  metal: "Métal",
  wood: "Bois",
  glass: "Verre",
  rubber: "Caoutchouc",
  fabric: "Tissu",
  ceramic: "Céramique",
};

function shapeFromPoints(points: { x: number; y: number }[]): THREE.Shape {
  return new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)));
}

/** Niveau de détail : « low » divise par deux le nombre de facettes (affichage sur mobile), « high » sert aux exports. */
export type GeometryDetail = "high" | "low";

/** Géométrie d'une pièce, en millimètres, centrée sur son origine. */
export function createPartGeometry(part: Part, detail: GeometryDetail = "high"): THREE.BufferGeometry {
  const { x, y, z } = part.size;
  const seg = (n: number) => (detail === "low" ? Math.max(8, Math.round(n / 2)) : n);
  try {
    switch (part.shape) {
      case "box": {
        const r = Math.min(part.cornerRadius, x / 2 - 0.01, y / 2 - 0.01, z / 2 - 0.01);
        return r > 0.3 ? new RoundedBoxGeometry(x, y, z, detail === "low" ? 2 : 3, r) : new THREE.BoxGeometry(x, y, z);
      }
      case "cylinder":
        return new THREE.CylinderGeometry(x / 2, x / 2, y, seg(48));
      case "cone":
        return new THREE.ConeGeometry(x / 2, y, seg(48));
      case "sphere":
        return new THREE.SphereGeometry(x / 2, seg(48), seg(32));
      case "capsule": {
        const radius = x / 2;
        return new THREE.CapsuleGeometry(radius, Math.max(0.01, y - x), seg(10), seg(28));
      }
      case "torus": {
        // Anneau couché à plat (plan XZ) : x = diamètre extérieur, y = épaisseur du boudin.
        const tube = Math.max(0.25, Math.min(y / 2, x / 4));
        const radius = Math.max(tube * 1.05, x / 2 - tube);
        const geometry = new THREE.TorusGeometry(radius, tube, seg(24), seg(72));
        geometry.rotateX(-Math.PI / 2);
        return geometry;
      }
      case "tube": {
        // Cylindre creux vertical : x = diamètre extérieur, y = hauteur, z = épaisseur de paroi.
        const outer = x / 2;
        const wall = Math.min(Math.max(z, 0.4), outer * 0.95);
        const shape = new THREE.Shape().absarc(0, 0, outer, 0, Math.PI * 2, false);
        shape.holes.push(new THREE.Path().absarc(0, 0, outer - wall, 0, Math.PI * 2, true));
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: y, bevelEnabled: false, curveSegments: seg(48) });
        geometry.translate(0, 0, -y / 2);
        geometry.rotateX(-Math.PI / 2);
        return geometry;
      }
      case "extrusion": {
        if (part.profile.length < 3) return new THREE.BoxGeometry(x, y, z);
        const shape = shapeFromPoints(part.profile);
        for (const hole of part.holes) shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, p.y))));
        const depth = Math.max(z, 0.5);
        const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: seg(24) });
        geometry.translate(0, 0, -depth / 2);
        return geometry;
      }
    }
  } catch {
    // Profil dégénéré : on retombe sur un pavé.
  }
  return new THREE.BoxGeometry(Math.max(x, 1), Math.max(y, 1), Math.max(z, 1));
}

export function applyPartTransform(object: THREE.Object3D, part: Part) {
  object.position.set(part.position.x, part.position.y, part.position.z);
  object.rotation.set(part.rotation.x * DEG, part.rotation.y * DEG, part.rotation.z * DEG);
}

export function partRotation(part: Part): [number, number, number] {
  return [part.rotation.x * DEG, part.rotation.y * DEG, part.rotation.z * DEG];
}

/** Matériau « réaliste » d'une pièce (aussi utilisé pour les exports GLB). */
export function createStandardMaterial(color: string, kind: MaterialKind): THREE.MeshStandardMaterial {
  const preset = MATERIAL_PRESETS[kind];
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness: preset.metalness,
    roughness: preset.roughness,
    transparent: preset.opacity < 1,
    opacity: preset.opacity,
    name: kind,
  });
}

/**
 * Groupe Three.js « propre » (uniquement des maillages) pour les exports.
 * @param unitScale facteur appliqué aux millimètres (1 = mm pour STL, 0.001 = m pour GLB)
 */
export function buildDesignGroup(design: Design, unitScale: number): THREE.Group {
  const group = new THREE.Group();
  group.name = design.title || "Forma3D";
  for (const part of design.model.parts) {
    const mesh = new THREE.Mesh(createPartGeometry(part), createStandardMaterial(part.color, part.material));
    mesh.name = part.name;
    applyPartTransform(mesh, part);
    group.add(mesh);
  }
  group.scale.setScalar(unitScale);
  group.updateMatrixWorld(true);
  return group;
}

/** Boîte englobante réelle du modèle, en millimètres. */
export function computeDesignBounds(design: Design): THREE.Box3 {
  const group = buildDesignGroup(design, 1);
  const box = new THREE.Box3().setFromObject(group);
  disposeGroup(group);
  return box;
}

/**
 * Décalages de la vue éclatée (en mm) : chaque pièce s'éloigne du centre du modèle,
 * proportionnellement à sa position ; les pièces centrales montent ou descendent.
 */
export function computeExplodeOffsets(design: Design, bounds: THREE.Box3): Map<string, THREE.Vector3> {
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2 || 1;
  const offsets = new Map<string, THREE.Vector3>();
  design.model.parts.forEach((part, i) => {
    const dir = new THREE.Vector3(part.position.x, part.position.y, part.position.z).sub(center);
    if (dir.length() < radius * 0.12) dir.set(0, i % 2 === 0 ? 1 : -1, 0).multiplyScalar(radius * 0.35);
    offsets.set(part.id, dir.multiplyScalar(0.9));
  });
  return offsets;
}

export function disposeGroup(group: THREE.Object3D) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
