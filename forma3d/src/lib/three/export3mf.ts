import * as THREE from "three";
import type { Design } from "../design/schema";
import { buildPartMeshes, meshesBounds, ORIENTATIONS } from "../fabrication/mesh";
import { checkPrintability } from "../fabrication/printability";
import { DEFAULT_PRINTER, type PrinterVolume } from "../fabrication/printer";
import { createZip } from "../files/zip";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number) => (Math.round(n * 1000) / 1000).toString();

/**
 * Fichier 3MF prêt pour le trancheur : millimètres, pièce posée dans l'orientation conseillée (la moins de supports),
 * centrée sur le plateau de l'imprimante choisie, axe Z vers le haut (convention 3MF).
 * Les métadonnées indiquent que la pièce a été générée par IA avec Forma3D.
 */
export function export3mf(design: Design, options: { stretch?: { x: number; y: number; z: number }; printer?: PrinterVolume } = {}): Uint8Array {
  const printer = options.printer ?? DEFAULT_PRINTER;
  const stretch = options.stretch ?? { x: 1, y: 1, z: 1 };
  const best = checkPrintability(design, printer).best;
  const orientation = ORIENTATIONS.find((o) => o.id === best.id) ?? ORIENTATIONS[0];
  const matrix = orientation.matrix().multiply(new THREE.Matrix4().makeScale(stretch.x, stretch.y, stretch.z));
  const meshes = buildPartMeshes(design, matrix, "high");
  const box = meshesBounds(meshes);
  // Centre sur le plateau (X, Z du monde → X, Y du 3MF), posé à Z = 0.
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const toPlate = (x: number, y: number, z: number): [number, number, number] => [x - cx + printer.x / 2, -(z - cz) + printer.y / 2, y - box.min.y];

  const vertices: string[] = [];
  const triangles: string[] = [];
  const index = new Map<string, number>();
  const vertex = (x: number, y: number, z: number) => {
    const [a, b, c] = toPlate(x, y, z);
    const key = `${num(a)} ${num(b)} ${num(c)}`;
    let i = index.get(key);
    if (i === undefined) {
      i = vertices.length;
      index.set(key, i);
      vertices.push(`<vertex x="${num(a)}" y="${num(b)}" z="${num(c)}"/>`);
    }
    return i;
  };
  for (const m of meshes) {
    const p = m.positions;
    for (let t = 0; t < p.length; t += 9) {
      const v1 = vertex(p[t], p[t + 1], p[t + 2]);
      const v2 = vertex(p[t + 3], p[t + 4], p[t + 5]);
      const v3 = vertex(p[t + 6], p[t + 7], p[t + 8]);
      if (v1 === v2 || v2 === v3 || v1 === v3) continue;
      // Passage de Y-haut à Z-haut par (x, -z, y) : changement de repère direct, l'ordre des sommets est conservé.
      triangles.push(`<triangle v1="${v1}" v2="${v2}" v3="${v3}"/>`);
    }
  }

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="fr-FR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${xml(design.title)}</metadata>
<metadata name="Application">Forma3D</metadata>
<metadata name="Description">${xml(`Pièce générée par IA avec Forma3D. Orientation conseillée : ${best.label}. Vérifiez-la dans votre trancheur avant d'imprimer.`)}</metadata>
<resources>
<object id="1" type="model" name="${xml(design.title)}">
<mesh>
<vertices>${vertices.join("")}</vertices>
<triangles>${triangles.join("")}</triangles>
</mesh>
</object>
</resources>
<build>
<item objectid="1"/>
</build>
</model>`;
  return createZip([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`,
    },
    { name: "3D/3dmodel.model", data: model },
  ]);
}
