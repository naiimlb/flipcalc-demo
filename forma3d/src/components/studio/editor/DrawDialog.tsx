"use client";

import { useEffect, useRef, useState } from "react";
import type { Vec2 } from "@/lib/design/ops";
import { useT } from "../../app/Preferences";
import { NumInput, Sheet } from "./Sheet";

/**
 * Forme libre : on trace un contour fermé au doigt, à l'Apple Pencil ou à la souris, puis il est extrudé.
 * Le cadre représente `width` mm de large ; le tracé est lissé et simplifié à l'ajout.
 */
export function DrawDialog({ onClose, onSubmit }: { onClose(): void; onSubmit(path: Vec2[], thickness: number): string | null }) {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Vec2[]>([]);
  const drawing = useRef(false);
  const [width, setWidth] = useState(100);
  const [thickness, setThickness] = useState(5);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    // Quadrillage de 10 mm.
    ctx.strokeStyle = "rgba(127,135,170,0.25)";
    ctx.lineWidth = 1;
    const step = rect.width / (width / 10);
    for (let x = 0; x <= rect.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y <= rect.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }
    if (points.length > 1) {
      ctx.strokeStyle = "#ff6b4a";
      ctx.fillStyle = "rgba(255,107,74,0.18)";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (!drawing.current) ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }, [points, width]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const submit = () => {
    const c = canvas.current;
    if (!c || points.length < 8) {
      setError(t("draw.tooShort"));
      return;
    }
    const rect = c.getBoundingClientRect();
    const mm = width / rect.width;
    // Repère de la forme : x vers la droite, y vers le haut (l'arrière de la pièce).
    const path = points.map((p) => ({ x: p.x * mm, y: (rect.height - p.y) * mm }));
    const problem = onSubmit(path, Math.max(0.5, Math.min(200, thickness)));
    if (problem) setError(problem);
    else onClose();
  };

  return (
    <Sheet title={t("add.drawTitle")} onClose={onClose} wide>
      <p className="mb-2 text-xs text-ink-mute">{t("draw.hint")}</p>
      <canvas
        ref={canvas}
        aria-label={t("draw.canvas")}
        className="aspect-square w-full touch-none rounded-2xl bg-paper ring-1 ring-line"
        onPointerDown={(e) => {
          drawing.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setError(null);
          setPoints([at(e)]);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
          const rect = e.currentTarget.getBoundingClientRect();
          const next = events.length ? events.map((ev) => ({ x: ev.clientX - rect.left, y: ev.clientY - rect.top })) : [at(e)];
          setPoints((pts) => (pts.length > 4000 ? pts : [...pts, ...next]));
        }}
        onPointerUp={() => {
          drawing.current = false;
          setPoints((pts) => [...pts]);
        }}
        onPointerCancel={() => (drawing.current = false)}
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <NumInput label={t("draw.width")} value={width} onChange={setWidth} unit="mm" min={10} max={1000} />
        <NumInput label={t("draw.thickness")} value={thickness} onChange={setThickness} unit="mm" min={0.5} max={200} step={0.5} />
      </div>
      {error && <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={() => setPoints([])}>
          {t("draw.clear")}
        </button>
        <button type="button" className="btn-neon flex-1" onClick={submit}>
          {t("draw.add")}
        </button>
      </div>
    </Sheet>
  );
}
