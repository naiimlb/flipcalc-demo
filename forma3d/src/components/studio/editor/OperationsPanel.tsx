"use client";

import { useState } from "react";
import type { Axis } from "@/lib/design/ops";
import type { Part } from "@/lib/design/schema";
import { useT } from "../../app/Preferences";
import { Choice, NumInput } from "./Sheet";

export type OpRequest =
  | { type: "duplicate" }
  | { type: "delete" }
  | { type: "mirror"; axis: Axis }
  | { type: "array-line"; count: number; spacing: number; axis: Axis }
  | { type: "array-circle"; count: number }
  | { type: "cut"; axis: Axis }
  | { type: "hollow"; thickness: number }
  | { type: "drill"; diameter: number; u: number; v: number; along: "y" | "z" }
  | { type: "fillet"; radius: number }
  | { type: "chamfer"; size: number }
  | { type: "group" }
  | { type: "ungroup" }
  | { type: "lock"; locked: boolean };

type Kind = "mirror" | "array-line" | "array-circle" | "cut" | "hollow" | "drill" | "fillet" | "chamfer";

export interface SnapSettings {
  on: boolean;
  step: number;
  angle: number;
}

/**
 * Onglet Objet : réglages des poignées (magnétisme, échelle uniforme) et opérations sur la pièce sélectionnée
 * (miroir, répétition, couper, évider, percer, congé, chanfrein, assembler, verrouiller).
 */
export function OperationsPanel({
  part,
  count,
  grouped,
  editable,
  snap,
  onSnap,
  uniform,
  onUniform,
  onOp,
}: {
  part: Part;
  count: number;
  grouped: boolean;
  editable: boolean;
  snap: SnapSettings;
  onSnap(s: SnapSettings): void;
  uniform: boolean;
  onUniform(v: boolean): void;
  onOp(op: OpRequest): void;
}) {
  const t = useT();
  const [kind, setKind] = useState<Kind>("mirror");
  const [axis, setAxis] = useState<Axis>("x");
  const [n, setN] = useState(4);
  const [spacing, setSpacing] = useState(Math.round(Math.max(part.size.x, 10) + 5));
  const [thickness, setThickness] = useState(2);
  const [diameter, setDiameter] = useState(5);
  const [u, setU] = useState(0);
  const [v, setV] = useState(0);
  const [along, setAlong] = useState<"y" | "z">("y");
  const [radius, setRadius] = useState(2);
  const supports: Record<Kind, boolean> = {
    mirror: true,
    "array-line": true,
    "array-circle": true,
    cut: ["box", "extrusion", "cylinder", "tube"].includes(part.shape),
    hollow: ["box", "cylinder", "tube"].includes(part.shape),
    drill: ["box", "cylinder", "extrusion"].includes(part.shape),
    fillet: part.shape === "box",
    chamfer: part.shape === "box",
  };
  const axes = [
    { id: "x" as const, label: "X" },
    { id: "y" as const, label: "Y" },
    { id: "z" as const, label: "Z" },
  ];

  const apply = () => {
    if (kind === "mirror") onOp({ type: "mirror", axis });
    else if (kind === "array-line") onOp({ type: "array-line", count: n, spacing, axis });
    else if (kind === "array-circle") onOp({ type: "array-circle", count: n });
    else if (kind === "cut") onOp({ type: "cut", axis });
    else if (kind === "hollow") onOp({ type: "hollow", thickness });
    else if (kind === "drill") onOp({ type: "drill", diameter, u, v, along: part.shape === "extrusion" ? "z" : along });
    else if (kind === "fillet") onOp({ type: "fillet", radius });
    else onOp({ type: "chamfer", size: radius });
  };

  return (
    <section className="panel space-y-3 p-3" aria-label={t("ops.title")}>
      {/* Poignées */}
      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-ink">{t("ops.handles")}</p>
        <label className="flex items-center justify-between gap-2 text-[12px] text-ink-soft">
          {t("ops.snap")}
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--neon-blue))]" checked={snap.on} onChange={(e) => onSnap({ ...snap, on: e.target.checked })} />
        </label>
        {snap.on && (
          <div className="grid grid-cols-2 gap-2">
            <NumInput label={t("ops.snapStep")} value={snap.step} onChange={(step) => onSnap({ ...snap, step: Math.max(0.1, step || 1) })} unit="mm" min={0.1} step={0.5} />
            <NumInput label={t("ops.snapAngle")} value={snap.angle} onChange={(angle) => onSnap({ ...snap, angle: Math.max(1, angle || 15) })} unit="°" min={1} max={90} />
          </div>
        )}
        <label className="flex items-center justify-between gap-2 text-[12px] text-ink-soft">
          {t("ops.uniform")}
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--neon-blue))]" checked={uniform} onChange={(e) => onUniform(e.target.checked)} />
        </label>
      </div>

      <fieldset disabled={!editable} className="space-y-2 border-t border-line pt-3 disabled:opacity-60">
        <legend className="sr-only">{t("ops.title")}</legend>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn-ghost tap !px-2.5 !py-1.5 !text-[11px]" onClick={() => onOp({ type: "duplicate" })}>
            {t("editor.duplicate")}
          </button>
          {count > 1 && (
            <button type="button" className="btn-ghost tap !px-2.5 !py-1.5 !text-[11px]" onClick={() => onOp({ type: "group" })}>
              {t("ops.group")} ({count})
            </button>
          )}
          {grouped && (
            <button type="button" className="btn-ghost tap !px-2.5 !py-1.5 !text-[11px]" onClick={() => onOp({ type: "ungroup" })}>
              {t("ops.ungroup")}
            </button>
          )}
          <button type="button" className="btn-ghost tap !px-2.5 !py-1.5 !text-[11px]" aria-pressed={Boolean(part.locked)} onClick={() => onOp({ type: "lock", locked: !part.locked })}>
            {part.locked ? t("ops.unlock") : t("ops.lock")}
          </button>
          <button type="button" className="btn tap !px-2.5 !py-1.5 !text-[11px] text-rose-500 hover:bg-rose-500/10" onClick={() => onOp({ type: "delete" })}>
            {t("editor.delete")}
          </button>
        </div>

        <label className="block">
          <span className="label !mb-1">{t("ops.operation")}</span>
          <select className="input !py-2" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {(Object.keys(supports) as Kind[]).map((k) => (
              <option key={k} value={k} disabled={!supports[k]}>
                {t(`ops.${k}`)}
                {supports[k] ? "" : ` — ${t("ops.notForShape")}`}
              </option>
            ))}
          </select>
        </label>

        {(kind === "mirror" || kind === "cut" || kind === "array-line") && <Choice<Axis> label={t("ops.axis")} value={axis} onChange={setAxis} options={axes} />}
        {(kind === "array-line" || kind === "array-circle") && (
          <div className="grid grid-cols-2 gap-2">
            <NumInput label={t("ops.count")} value={n} onChange={(x) => setN(Math.round(x))} min={2} max={30} />
            {kind === "array-line" && <NumInput label={t("ops.spacing")} value={spacing} onChange={setSpacing} unit="mm" />}
          </div>
        )}
        {kind === "hollow" && <NumInput label={t("ops.wall")} value={thickness} onChange={setThickness} unit="mm" min={0.4} step={0.2} />}
        {kind === "drill" && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <NumInput label={t("ops.diameter")} value={diameter} onChange={setDiameter} unit="mm" min={0.5} step={0.1} />
              <NumInput label={t("ops.offsetU")} value={u} onChange={setU} unit="mm" />
              <NumInput label={t("ops.offsetV")} value={v} onChange={setV} unit="mm" />
            </div>
            {part.shape !== "extrusion" && (
              <Choice<"y" | "z">
                label={t("ops.drillAxis")}
                value={along}
                onChange={setAlong}
                options={[
                  { id: "y" as const, label: t("ops.vertical") },
                  ...(part.shape === "box" ? [{ id: "z" as const, label: t("ops.horizontal") }] : []),
                ]}
              />
            )}
          </div>
        )}
        {(kind === "fillet" || kind === "chamfer") && <NumInput label={kind === "fillet" ? t("ops.radius") : t("ops.chamferSize")} value={radius} onChange={setRadius} unit="mm" min={0.2} step={0.2} />}
        <p className="text-[11px] leading-snug text-ink-mute">{t(`ops.${kind}Hint`)}</p>
        <button type="button" className="btn-neon w-full !py-2 !text-xs" disabled={!supports[kind]} onClick={apply}>
          {t("ops.apply")}
        </button>
      </fieldset>
    </section>
  );
}
