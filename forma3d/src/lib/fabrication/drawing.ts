"use client";

import * as THREE from "three";
import type { Design } from "../design/schema";
import { buildDesignGroup, disposeGroup } from "../three/geometry";
import { jpegToPdf } from "./pdf";
import { planLayout, type Rect } from "./plan-layout";

/**
 * Plan coté (navigateur uniquement) : trois vues orthographiques rendues avec Three.js
 * (faces claires + arêtes), puis cotes, nomenclature et cartouche dessinées en 2D.
 */

const INK = "#23253a";
const FILL = "#eef0fb";
const ACCENT = "#5b6ee1";

type View = "front" | "side" | "top";

function makeScene(design: Design) {
  const group = buildDesignGroup(design, 1);
  const scene = new THREE.Scene();
  const fills: THREE.Material[] = [];
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const old = mesh.material as THREE.Material;
    old.dispose();
    const fill = new THREE.MeshBasicMaterial({ color: FILL, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    fills.push(fill);
    mesh.material = fill;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), new THREE.LineBasicMaterial({ color: INK }));
    mesh.add(edges);
  });
  scene.add(group);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  return { scene, group, box, fills };
}

function cameraFor(view: View, box: THREE.Box3): THREE.OrthographicCamera {
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const far = Math.max(size.x, size.y, size.z) * 4 + 1000;
  let cam: THREE.OrthographicCamera;
  if (view === "front") {
    cam = new THREE.OrthographicCamera(-size.x / 2, size.x / 2, size.y / 2, -size.y / 2, 0.1, far);
    cam.position.set(c.x, c.y, box.max.z + far / 2);
    cam.up.set(0, 1, 0);
  } else if (view === "side") {
    cam = new THREE.OrthographicCamera(-size.z / 2, size.z / 2, size.y / 2, -size.y / 2, 0.1, far);
    cam.position.set(box.max.x + far / 2, c.y, c.z);
    cam.up.set(0, 1, 0);
  } else {
    cam = new THREE.OrthographicCamera(-size.x / 2, size.x / 2, size.z / 2, -size.z / 2, 0.1, far);
    cam.position.set(c.x, box.max.y + far / 2, c.z);
    cam.up.set(0, 0, -1);
  }
  cam.lookAt(c);
  cam.updateProjectionMatrix();
  return cam;
}

const fmt = (mm: number) => `${(Math.round(mm * 10) / 10).toLocaleString("fr-FR")}`;

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  const s = 14;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - s * Math.cos(angle - 0.35), y - s * Math.sin(angle - 0.35));
  ctx.lineTo(x - s * Math.cos(angle + 0.35), y - s * Math.sin(angle + 0.35));
  ctx.closePath();
  ctx.fill();
}

/** Cote horizontale (sous la vue) ou verticale (à gauche de la vue). */
function dimension(ctx: CanvasRenderingContext2D, r: Rect, value: number, orientation: "h" | "v") {
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.fillStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.font = "600 30px Helvetica, Arial, sans-serif";
  if (orientation === "h") {
    const y = r.y + r.h + 45;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h + 8);
    ctx.lineTo(r.x, y + 12);
    ctx.moveTo(r.x + r.w, r.y + r.h + 8);
    ctx.lineTo(r.x + r.w, y + 12);
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
    ctx.stroke();
    arrow(ctx, r.x, y, Math.PI);
    arrow(ctx, r.x + r.w, y, 0);
    const label = `${fmt(value)}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(r.x + r.w / 2 - tw / 2 - 8, y - 22, tw + 16, 30);
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "center";
    ctx.fillText(label, r.x + r.w / 2, y + 2);
  } else {
    const x = r.x - 45;
    ctx.beginPath();
    ctx.moveTo(r.x - 8, r.y);
    ctx.lineTo(x - 12, r.y);
    ctx.moveTo(r.x - 8, r.y + r.h);
    ctx.lineTo(x - 12, r.y + r.h);
    ctx.moveTo(x, r.y);
    ctx.lineTo(x, r.y + r.h);
    ctx.stroke();
    arrow(ctx, x, r.y, -Math.PI / 2);
    arrow(ctx, x, r.y + r.h, Math.PI / 2);
    ctx.translate(x, r.y + r.h / 2);
    ctx.rotate(-Math.PI / 2);
    const label = `${fmt(value)}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-tw / 2 - 8, -22, tw + 16, 30);
    ctx.fillStyle = ACCENT;
    ctx.textAlign = "center";
    ctx.fillText(label, 0, 2);
  }
  ctx.restore();
}

function viewTitle(ctx: CanvasRenderingContext2D, r: Rect, text: string) {
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = "700 30px Helvetica, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(text, r.x, r.y - 22);
  ctx.restore();
}

/** Dessine la feuille complète et la renvoie (canvas 2339 × 1654 px, A4 paysage à 200 dpi). */
export function renderPlanSheet(design: Design): HTMLCanvasElement {
  const { scene, group, box, fills } = makeScene(design);
  const size = box.getSize(new THREE.Vector3());
  const real = { width: size.x, depth: size.z, height: size.y };
  const layout = planLayout(real);

  const sheet = document.createElement("canvas");
  sheet.width = layout.sheet.w;
  sheet.height = layout.sheet.h;
  const ctx = sheet.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, sheet.width - 60, sheet.height - 60);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0xffffff, 0);
  try {
    const views: [View, Rect, string][] = [
      ["front", layout.front, "Vue de face"],
      ["side", layout.side, "Vue de droite"],
      ["top", layout.top, "Vue de dessus"],
    ];
    for (const [view, rect, title] of views) {
      const w = Math.max(2, Math.round(rect.w));
      const h = Math.max(2, Math.round(rect.h));
      renderer.setSize(w, h, false);
      renderer.render(scene, cameraFor(view, box));
      ctx.drawImage(renderer.domElement, rect.x, rect.y, w, h);
      viewTitle(ctx, rect, title);
    }
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
    fills.forEach((m) => m.dispose());
    group.traverse((obj) => {
      const line = obj as THREE.LineSegments;
      if (line.isLineSegments) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    });
    disposeGroup(group);
  }

  // Cotes hors-tout (mm).
  dimension(ctx, layout.front, real.width, "h");
  dimension(ctx, layout.front, real.height, "v");
  dimension(ctx, layout.side, real.depth, "h");
  dimension(ctx, layout.top, real.depth, "v");
  dimension(ctx, layout.top, real.width, "h");

  // Nomenclature.
  const info = layout.info;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = "700 30px Helvetica, Arial, sans-serif";
  ctx.fillText("Pièces (L × H × P, mm)", info.x, info.y + 10);
  ctx.font = "400 24px Helvetica, Arial, sans-serif";
  const lineH = 34;
  const max = Math.max(1, Math.floor((info.h - 40) / lineH));
  design.model.parts.slice(0, max).forEach((p, i) => {
    // Pièce profilée : largeur et hauteur du profil, épaisseur d'extrusion.
    let [x, y, z] = [p.size.x, p.size.y, p.size.z];
    if (p.shape === "extrusion" && p.profile.length >= 3) {
      const xs = p.profile.map((pt) => pt.x);
      const ys = p.profile.map((pt) => pt.y);
      [x, y, z] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(p.size.z, 0.5)];
    }
    const text = `${i + 1}. ${p.name} — ${fmt(x)} × ${fmt(y)} × ${fmt(z)}`;
    ctx.fillText(text.length > 60 ? `${text.slice(0, 59)}…` : text, info.x, info.y + 50 + i * lineH);
  });
  if (design.model.parts.length > max) ctx.fillText(`… et ${design.model.parts.length - max} autres pièces`, info.x, info.y + 50 + max * lineH);
  ctx.restore();

  // Cartouche.
  const t = layout.titleBlock;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(t.x, t.y, t.w, t.h);
  ctx.beginPath();
  ctx.moveTo(t.x + t.w * 0.62, t.y);
  ctx.lineTo(t.x + t.w * 0.62, t.y + t.h);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = "800 46px Helvetica, Arial, sans-serif";
  const title = design.title.length > 48 ? `${design.title.slice(0, 47)}…` : design.title;
  ctx.fillText(title, t.x + 30, t.y + 66);
  ctx.font = "400 26px Helvetica, Arial, sans-serif";
  ctx.fillText(
    `Hors-tout : ${fmt(real.width)} × ${fmt(real.depth)} × ${fmt(real.height)} mm (L × P × H) · ${design.model.parts.length} pièce(s)`,
    t.x + 30,
    t.y + 112,
  );
  ctx.fillStyle = "#6b6e85";
  ctx.font = "italic 22px Helvetica, Arial, sans-serif";
  ctx.fillText("Plan indicatif généré par Forma3D : vérifiez les cotes avant fabrication.", t.x + 30, t.y + 148);
  ctx.fillStyle = INK;
  ctx.font = "700 28px Helvetica, Arial, sans-serif";
  const col = t.x + t.w * 0.62 + 30;
  ctx.fillText(`Échelle ${layout.scaleLabel} (A4)`, col, t.y + 56);
  ctx.font = "400 26px Helvetica, Arial, sans-serif";
  ctx.fillText("Cotes en millimètres", col, t.y + 98);
  ctx.fillText(new Date().toLocaleDateString("fr-FR"), col, t.y + 140);
  ctx.restore();

  return sheet;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function canvasToPdfBlob(canvas: HTMLCanvasElement, title: string): Promise<Blob> {
  const jpegBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!jpegBlob) throw new Error("Conversion JPEG impossible.");
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdf = jpegToPdf(jpeg, canvas.width, canvas.height, 842, 595, title);
  return new Blob([pdf as BlobPart], { type: "application/pdf" });
}

/** Image 3D en perspective (fond blanc), sans passer par la visionneuse : export PNG depuis n'importe quel écran. */
export function renderSnapshot(design: Design, width = 1600, height = 1200): HTMLCanvasElement {
  const group = buildDesignGroup(design, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f6f7ff");
  scene.add(new THREE.HemisphereLight("#ffffff", "#b9bde6", 1.6));
  const sun = new THREE.DirectionalLight("#ffffff", 1.8);
  sun.position.set(1, 2, 1.5);
  scene.add(sun);
  scene.add(group);
  const box = new THREE.Box3().setFromObject(group);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, sphere.radius * 50 + 1000);
  const dir = new THREE.Vector3(0.95, 0.6, 1.3).normalize();
  camera.position.copy(sphere.center).addScaledVector(dir, (sphere.radius / Math.sin((35 * Math.PI) / 360)) * 1.1);
  camera.lookAt(sphere.center);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  try {
    renderer.render(scene, camera);
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    out.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
    return out;
  } finally {
    renderer.dispose();
    renderer.forceContextLoss();
    disposeGroup(group);
  }
}
