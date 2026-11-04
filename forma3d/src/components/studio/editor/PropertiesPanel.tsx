"use client";

import { useEffect, useMemo, useState } from "react";
import { MATERIALS, type Design, type MaterialKind, type Part } from "@/lib/design/schema";
import type { PartPatch } from "@/lib/design/edit";
import type { RequestItem } from "@/lib/requests";
import { computeDesignBounds } from "@/lib/three/geometry";
import { useT } from "../../app/Preferences";
import { formatLength, type LengthUnit } from "../format";
import { Field } from "../ui";
import type { EditorTool } from "./Toolbar";

export type PropsTab = "object" | "material" | "dimensions" | "analysis" | "fabrication";
export const PROPS_TABS: PropsTab[] = ["object", "material", "dimensions", "analysis", "fabrication"];

const PALETTE = ["#2f6bff", "#ff6b4a", "#8b5cf6", "#22c55e", "#f5b13d", "#eceef6", "#9aa3b8", "#14151c"];

/**
 * Panneau de propriétés de l'éditeur, en onglets. Chaque onglet reçoit son contenu
 * (fiche, matières, cotes, analyse, fabrication) ; l'onglet Objet modifie la pièce sélectionnée.
 */
export function PropertiesPanel({
  tab,
  onTab,
  children,
}: {
  tab: PropsTab;
  onTab(tab: PropsTab): void;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <div role="tablist" aria-label={t("editor.properties")} className="flex gap-0.5 overflow-x-auto rounded-2xl bg-surface p-1 ring-1 ring-line scrollbar-none">
        {PROPS_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`props-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="props-panel"
            onClick={() => onTab(id)}
            className={`tap flex-1 whitespace-nowrap rounded-xl px-2 py-1.5 text-[11px] font-semibold transition ${tab === id ? "bg-fg text-canvas" : "text-ink-soft hover:text-ink"}`}
          >
            {t(`props.${id}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="props-panel" aria-labelledby={`props-tab-${tab}`} className="flex min-h-0 flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

/** Champ numérique en millimètres / degrés : la valeur tapée est appliquée dès qu'elle est valide. */
function NumberField({ label, value, unit, onCommit, highlight }: { label: string; value: number; unit: string; onCommit(v: number): void; highlight?: boolean }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  // Pendant la frappe, le texte n'est pas réécrit (valeur bornée affichée en sortant du champ).
  useEffect(() => {
    if (!focused) setText(String(Math.round(value * 100) / 100));
  }, [value, focused]);
  return (
    <label className={`flex min-w-0 items-center gap-1 rounded-lg px-1.5 ring-1 ${highlight ? "bg-neon-blue/10 ring-neon-blue/40" : "bg-paper ring-transparent"}`}>
      <span className="w-3 shrink-0 text-[10px] font-bold text-ink-mute">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value.replace(",", "."));
          if (e.target.value.trim() !== "" && Number.isFinite(n)) onCommit(n);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="h-9 w-full min-w-0 bg-transparent text-end font-mono text-[12px] tabular-nums text-ink outline-none"
      />
      <span className="shrink-0 text-[10px] text-ink-mute">{unit}</span>
    </label>
  );
}

function VecRow({
  title,
  value,
  unit,
  field,
  onPatch,
  highlight,
}: {
  title: string;
  value: { x: number; y: number; z: number };
  unit: string;
  field: "position" | "rotation" | "size";
  onPatch(patch: PartPatch, key: string): void;
  highlight: boolean;
}) {
  return (
    <div>
      <p className={`mb-1 text-[10.5px] font-semibold ${highlight ? "text-neon-blue" : "text-ink-mute"}`}>{title}</p>
      <div className="grid grid-cols-3 gap-1">
        {(["x", "y", "z"] as const).map((axis) => (
          <NumberField
            key={axis}
            label={axis.toUpperCase()}
            value={value[axis]}
            unit={unit}
            highlight={highlight}
            onCommit={(v) => onPatch({ [field]: { ...value, [axis]: v } }, `${field}.${axis}`)}
          />
        ))}
      </div>
    </div>
  );
}

/** Onglet Objet, pièce sélectionnée : nom, position, rotation, taille (saisie en mm et en degrés). */
export function PartInspector({ part, onPatch, tool, editable }: { part: Part; onPatch(patch: PartPatch, key: string): void; tool: EditorTool; editable: boolean }) {
  const t = useT();
  return (
    <section className="panel space-y-3 p-3">
      <label className="block">
        <span className="label !mb-1">{t("editor.partName")}</span>
        <input
          className="input !py-2"
          value={part.name}
          disabled={!editable}
          onChange={(e) => onPatch({ name: e.target.value }, "name")}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </label>
      {part.role && <p className="text-[11px] leading-snug text-ink-mute">{part.role}</p>}
      <p className="text-[11px] text-ink-soft">
        {t("editor.shape")} : <span className="font-semibold text-ink">{t(`shape.${part.shape}`)}</span>
      </p>
      <fieldset disabled={!editable} className="space-y-2.5 disabled:opacity-60">
        <VecRow title={t("editor.position")} value={part.position} unit="mm" field="position" onPatch={onPatch} highlight={tool === "move"} />
        <VecRow title={t("editor.rotation")} value={part.rotation} unit="°" field="rotation" onPatch={onPatch} highlight={tool === "rotate"} />
        <VecRow title={t("editor.size")} value={part.size} unit="mm" field="size" onPatch={onPatch} highlight={tool === "scale"} />
      </fieldset>
      {!editable && <p className="text-[11px] text-ink-mute">{t("editor.readOnly")}</p>}
    </section>
  );
}

/** Onglet Matière, pièce sélectionnée : couleur et matière de la pièce. */
export function PartMaterial({ part, onPatch, editable }: { part: Part; onPatch(patch: PartPatch, key: string): void; editable: boolean }) {
  const t = useT();
  return (
    <section className="panel space-y-2.5 p-3">
      <p className="text-[12.5px] font-semibold text-ink">{t("editor.partMaterial", { name: part.name })}</p>
      <fieldset disabled={!editable} className="space-y-2.5 disabled:opacity-60">
        <div className="flex flex-wrap items-center gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={t("editor.color", { c })}
              aria-pressed={part.color === c}
              onClick={() => onPatch({ color: c }, "color")}
              className={`tap h-7 w-7 rounded-full ring-1 ring-black/10 ${part.color === c ? "outline outline-2 outline-offset-2 outline-neon-blue" : ""}`}
              style={{ background: c }}
            />
          ))}
          <label className="tap relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-line" title={t("editor.customColor")}>
            <span className="sr-only">{t("editor.customColor")}</span>
            <input type="color" value={part.color} onChange={(e) => onPatch({ color: e.target.value }, "color")} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            <span aria-hidden className="h-full w-full" style={{ background: "conic-gradient(#ff6b4a,#f5b13d,#22c55e,#2f6bff,#8b5cf6,#ff6b4a)" }} />
          </label>
        </div>
        <label className="block">
          <span className="label !mb-1">{t("editor.materialKind")}</span>
          <select className="input !py-2" value={part.material} onChange={(e) => onPatch({ material: e.target.value as MaterialKind }, "material")}>
            {MATERIALS.map((m) => (
              <option key={m} value={m}>
                {t(`kind.${m}`)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
    </section>
  );
}

/** Onglet Dimensions : encombrement mesuré sur le modèle (mis à jour à chaque modification) et taille de chaque pièce. */
export function MeasuredDimensions({ design, unit, selection, onSelect }: { design: Design; unit: LengthUnit; selection: string | null; onSelect(id: string): void }) {
  const t = useT();
  const size = useMemo(() => {
    const box = computeDesignBounds(design);
    return box.isEmpty() ? null : { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z };
  }, [design]);
  return (
    <section className="panel p-3">
      <p className="mb-2 text-[12.5px] font-semibold text-ink">{t("editor.measured")}</p>
      {size && (
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ["L", size.x],
              ["P", size.z],
              ["H", size.y],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-neon-blue/10 px-2 py-2 text-center">
              <p className="text-[10px] font-semibold text-neon-blue">{k}</p>
              <p className="text-[12px] font-semibold tabular-nums">{formatLength(v, unit)}</p>
            </div>
          ))}
        </div>
      )}
      <ul className="mt-2.5 space-y-0.5">
        {design.model.parts.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[11px] ${p.id === selection ? "bg-neon-blue/15 text-ink" : "text-ink-soft hover:bg-paper"}`}
            >
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="shrink-0 font-mono tabular-nums">
                {Math.round(p.size.x)} × {Math.round(p.size.z)} × {Math.round(p.size.y)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Onglet Objet sans sélection : la demande et la solution retenue. */
export function ProjectSummary({ item }: { item: RequestItem }) {
  const t = useT();
  return (
    <section className="panel space-y-2 p-3">
      <Field label={t("left.request")}>
        <span className="line-clamp-4">« {item.prompt} »</span>
      </Field>
      {item.design && <Field label={t("left.solution")}>{item.design.solution.concept}</Field>}
      <p className="rounded-xl bg-paper px-2.5 py-2 text-[11px] leading-snug text-ink-mute">{t("editor.selectHint")}</p>
    </section>
  );
}

/** « Mettre à l'échelle réelle » : la plus grande dimension du modèle prend la valeur saisie (mm). */
export function RealScaleBox({ longest, editable, onApply }: { longest: number; editable: boolean; onApply(mm: number): void }) {
  const t = useT();
  const [mm, setMm] = useState(Math.round(longest));
  useEffect(() => setMm(Math.round(longest)), [longest]);
  return (
    <section className="panel space-y-2 p-3">
      <p className="text-[12.5px] font-semibold text-ink">{t("scale.title")}</p>
      <p className="text-[11px] text-ink-mute">{t("scale.hint", { n: Math.round(longest) })}</p>
      <div className="flex gap-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-1 rounded-xl bg-paper px-2.5 ring-1 ring-line">
          <span className="sr-only">{t("scale.target")}</span>
          <input
            type="number"
            inputMode="decimal"
            value={mm}
            min={1}
            onChange={(e) => setMm(Number(e.target.value))}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-10 w-full min-w-0 bg-transparent font-mono text-sm outline-none"
            aria-label={t("scale.target")}
          />
          <span className="text-[11px] text-ink-mute">mm</span>
        </label>
        <button type="button" className="btn-neon tap shrink-0 !rounded-xl !px-3 !text-xs" disabled={!editable || !(mm > 0) || Math.round(mm) === Math.round(longest)} onClick={() => onApply(mm)}>
          {t("scale.apply")}
        </button>
      </div>
    </section>
  );
}
