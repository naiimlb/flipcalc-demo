"use client";

import { useEffect, useRef } from "react";
import type { Design } from "@/lib/design/schema";
import { buildPartMeshes, meshesBounds } from "@/lib/fabrication/mesh";

/**
 * Miniature d'une conception, dessinée en 2D (vue isométrique, ombrage simple) à partir du modèle lui-même :
 * aucun WebGL, aucun fichier stocké, rien à migrer. Les triangles sont triés du plus lointain au plus proche.
 */
export function DesignThumbnail({ design, className = "" }: { design: Design; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    el.width = w;
    el.height = h;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const meshes = buildPartMeshes(design);
    const box = meshesBounds(meshes);
    const c = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2, z: (box.min.z + box.max.z) / 2 };
    // Vue isométrique : rotation de 45° autour de Y puis d'environ 30° autour de X.
    const cy = Math.cos(Math.PI / 4), sy = Math.sin(Math.PI / 4);
    const cx = Math.cos(Math.PI / 6), sx = Math.sin(Math.PI / 6);
    const project = (x: number, y: number, z: number) => {
      const X = (x - c.x) * cy - (z - c.z) * sy;
      const Z1 = (x - c.x) * sy + (z - c.z) * cy;
      const Y = (y - c.y) * cx - Z1 * sx;
      const depth = (y - c.y) * sx + Z1 * cx;
      return [X, -Y, depth] as const;
    };
    const tris: { pts: number[]; depth: number; color: string; light: number }[] = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const m of meshes) {
      const p = m.positions;
      for (let t = 0; t < p.length; t += 9) {
        const a = project(p[t], p[t + 1], p[t + 2]);
        const b = project(p[t + 3], p[t + 4], p[t + 5]);
        const d = project(p[t + 6], p[t + 7], p[t + 8]);
        // Normale dans l'espace de vue : on ne dessine que les faces tournées vers l'observateur.
        const nz = (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]);
        if (nz >= 0) continue;
        const ux = p[t + 3] - p[t], uy = p[t + 4] - p[t + 1], uz = p[t + 5] - p[t + 2];
        const vx = p[t + 6] - p[t], vy = p[t + 7] - p[t + 1], vz = p[t + 8] - p[t + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nzw = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nzw) || 1;
        const light = 0.55 + 0.45 * Math.max(0, (nx * 0.3 + ny * 0.85 + nzw * 0.4) / len);
        tris.push({ pts: [a[0], a[1], b[0], b[1], d[0], d[1]], depth: (a[2] + b[2] + d[2]) / 3, color: m.part.color, light });
        for (const [x, y] of [a, b, d]) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (!tris.length) return;
    tris.sort((u, v) => u.depth - v.depth);
    const scale = 0.86 * Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1));
    const ox = w / 2 - ((minX + maxX) / 2) * scale;
    const oy = h / 2 - ((minY + maxY) / 2) * scale;
    for (const t of tris) {
      const r = parseInt(t.color.slice(1, 3), 16), g = parseInt(t.color.slice(3, 5), 16), b = parseInt(t.color.slice(5, 7), 16);
      ctx.fillStyle = `rgb(${Math.round(r * t.light)} ${Math.round(g * t.light)} ${Math.round(b * t.light)})`;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(ox + t.pts[0] * scale, oy + t.pts[1] * scale);
      ctx.lineTo(ox + t.pts[2] * scale, oy + t.pts[3] * scale);
      ctx.lineTo(ox + t.pts[4] * scale, oy + t.pts[5] * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }, [design]);

  return <canvas ref={canvas} role="img" aria-label={`Aperçu : ${design.title}`} className={className} />;
}
