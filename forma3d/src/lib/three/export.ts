import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import type { Design } from "../design/schema";
import { buildDesignGroup, disposeGroup } from "./geometry";

/** Nom de fichier sûr à partir du titre. */
export function fileBaseName(design: Design): string {
  const base = design.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || "forma3d";
}

/** STL binaire en millimètres (unité attendue par les trancheurs d'impression 3D). */
export function exportStl(design: Design): ArrayBuffer {
  const group = buildDesignGroup(design, 1);
  const view = new STLExporter().parse(group, { binary: true }) as DataView;
  disposeGroup(group);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

/** GLB en mètres (convention glTF), avec couleurs et matériaux PBR. */
export async function exportGlb(design: Design): Promise<ArrayBuffer> {
  const group = buildDesignGroup(design, 0.001);
  try {
    const result = await new GLTFExporter().parseAsync(group, { binary: true });
    if (!(result instanceof ArrayBuffer)) throw new Error("Export GLB inattendu.");
    return result;
  } finally {
    disposeGroup(group);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
