"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Champ numérique précis (cotes en mm, angles en °), en chasse fixe.
 * Glisser sur le libellé ajuste la valeur (souris, trackpad, doigt ou Apple Pencil) : 1 pas tous les 4 px,
 * ×10 avec Maj, ×0,1 avec Alt. Flèches haut / bas au clavier, saisie directe appliquée dès qu'elle est valide.
 */
export function NumberField({
  label,
  value,
  onCommit,
  unit,
  min,
  max,
  step = 1,
  precision = 2,
  highlight = false,
  layout = "inline",
  className = "",
}: {
  label: string;
  value: number;
  onCommit(v: number): void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  highlight?: boolean;
  /** « inline » : libellé court dans le champ (X, Y, Z) ; « stacked » : libellé au-dessus. */
  layout?: "inline" | "stacked";
  className?: string;
}) {
  const round = (n: number) => {
    const f = 10 ** precision;
    return Math.round(n * f) / f;
  };
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const [text, setText] = useState(String(round(value)));
  const [focused, setFocused] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null);
  // Pendant la frappe, le texte n'est pas réécrit (valeur bornée affichée en sortant du champ).
  useEffect(() => {
    if (!focused) setText(String(round(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const handle = (
    <span
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, start: value, moved: false };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        if (!d.moved && Math.abs(dx) < 3) return;
        if (!d.moved) {
          d.moved = true;
          setScrubbing(true);
        }
        const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
        const next = clamp(round(d.start + Math.round(dx / 4) * step * factor));
        if (next !== value) onCommit(next);
      }}
      onPointerUp={(e) => {
        // Un glissement ne doit pas donner le focus au champ (le clic simple, si).
        if (drag.current?.moved) e.preventDefault();
        drag.current = null;
        setScrubbing(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setScrubbing(false);
      }}
      onClick={(e) => drag.current === null && scrubbing && e.preventDefault()}
      className={`shrink-0 cursor-ew-resize touch-none select-none ${layout === "inline" ? "w-3 text-xs font-medium text-ink-mute" : "mb-1 block text-xs font-medium text-ink-mute"}`}
      title={layout === "inline" ? undefined : label}
    >
      {label}
    </span>
  );

  const field = (
    <span
      className={`flex min-h-8 min-w-0 items-center gap-1 rounded-md border px-2 transition-colors ${
        scrubbing ? "border-accent" : highlight ? "border-accent/50 bg-accent/5" : "border-line bg-surface hover:border-ink-mute/60"
      } focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25`}
    >
      {layout === "inline" && handle}
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={text}
        min={min}
        max={max}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(",", "."));
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onCommit(clamp(n));
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const factor = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
            const next = clamp(round(value + (e.key === "ArrowUp" ? 1 : -1) * step * factor));
            setText(String(next));
            onCommit(next);
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="num-plain h-7 w-full min-w-0 bg-transparent text-end font-mono text-sm text-ink outline-none"
      />
      {unit && <span className="shrink-0 font-mono text-xs text-ink-mute">{unit}</span>}
    </span>
  );

  return (
    <label className={`block min-w-0 ${className}`}>
      {layout === "stacked" && handle}
      {field}
    </label>
  );
}
