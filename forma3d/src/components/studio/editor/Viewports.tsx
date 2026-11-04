"use client";

import dynamic from "next/dynamic";
import type { Design } from "@/lib/design/schema";
import type { OrthoSide } from "../../viewer/OrthoViewer";
import { Spinner } from "../../icons";
import { useT } from "../../app/Preferences";
import type { ViewLayout } from "./Toolbar";

const OrthoViewer = dynamic(() => import("../../viewer/OrthoViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-fg/50">
      <Spinner size={18} />
    </div>
  ),
});

const SIDES: Record<ViewLayout, OrthoSide[]> = { 1: [], 2: ["front"], 4: ["top", "front", "right"] };

/**
 * Zone de vue de l'éditeur : la vue 3D principale (perspective) et, en 2 ou 4 vues,
 * des vues orthographiques (dessus, face, droite) qui partagent la sélection.
 */
export function Viewports({
  layout,
  design,
  selection,
  onSelect,
  hiddenIds,
  showGrid,
  showAxes,
  children,
}: {
  layout: ViewLayout;
  design: Design | null;
  selection: string | null;
  onSelect(id: string | null): void;
  hiddenIds: string[];
  showGrid: boolean;
  showAxes: boolean;
  /** Vue principale (perspective). */
  children: React.ReactNode;
}) {
  const t = useT();
  const sides = design ? SIDES[layout] : [];
  const grid = sides.length === 0 ? "grid-cols-1" : sides.length === 1 ? "grid-cols-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1" : "grid-cols-2 grid-rows-2";
  return (
    <div className={`grid h-full min-h-0 gap-1.5 ${grid}`}>
      <div className="relative min-h-0 min-w-0">{children}</div>
      {design &&
        sides.map((side) => (
          <div key={side} className="relative min-h-0 min-w-0 overflow-hidden rounded-lg bg-paper ring-1 ring-fg/10">
            <OrthoViewer design={design} side={side} selection={selection} hiddenIds={hiddenIds} showGrid={showGrid} showAxes={showAxes} onSelect={onSelect} />
            <span className="chip pointer-events-none absolute start-2.5 top-2.5 bg-night/70 text-white">{t(`editor.view.${side}`)}</span>
          </div>
        ))}
    </div>
  );
}
