"use client";

import { IconGrid, IconLayers, IconRefocus, IconRotate, IconRuler, IconSettings } from "../../icons";
import { useT } from "../../app/Preferences";

export type EditorTool = "select" | "move" | "rotate" | "scale";
export type ViewLayout = 1 | 2 | 4;

const svg = (d: string) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ICONS = {
  select: svg("M5 3l13 7-6 1.5L9.5 18z"),
  move: svg("M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"),
  scale: svg("M4 20h7v-7H4zM14 4h6v6M20 4l-8 8"),
  axes: svg("M5 19V5M5 19h14M5 19l9-9"),
};

function layoutIcon(n: ViewLayout) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      {n >= 2 && <path d="M12 4v16" />}
      {n === 4 && <path d="M3.5 12h17" />}
    </svg>
  );
}

/**
 * Barre d'outils verticale de l'éditeur : outils (raccourcis V, W, E, R), affichage (1, 2 ou 4 vues,
 * grille, axes, règle), recadrage (F) et panneaux. Boutons de 44 px sur écran tactile.
 */
export function Toolbar({
  tool,
  onTool,
  layout,
  onLayout,
  showGrid,
  onGrid,
  showAxes,
  onAxes,
  showRuler,
  onRuler,
  onFrame,
  onToggleParts,
  onToggleProps,
  partsOpen,
  propsOpen,
}: {
  tool: EditorTool;
  onTool(tool: EditorTool): void;
  layout: ViewLayout;
  onLayout(layout: ViewLayout): void;
  showGrid: boolean;
  onGrid(): void;
  showAxes: boolean;
  onAxes(): void;
  showRuler: boolean;
  onRuler(): void;
  onFrame(): void;
  onToggleParts(): void;
  onToggleProps(): void;
  partsOpen: boolean;
  propsOpen: boolean;
}) {
  const t = useT();
  const tools: { id: EditorTool; key: string; icon: React.ReactNode }[] = [
    { id: "select", key: "V", icon: ICONS.select },
    { id: "move", key: "W", icon: ICONS.move },
    { id: "rotate", key: "E", icon: <IconRotate size={17} /> },
    { id: "scale", key: "R", icon: ICONS.scale },
  ];
  return (
    <div role="toolbar" aria-orientation="vertical" aria-label={t("editor.toolbar")} className="flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto py-2 scrollbar-none sm:w-14">
      <Btn label={t("editor.parts")} active={partsOpen} onClick={onToggleParts}>
        <IconLayers size={17} />
      </Btn>
      <Sep />
      {tools.map((x) => (
        <Btn key={x.id} label={`${t(`editor.tool.${x.id}`)} (${x.key})`} active={tool === x.id} onClick={() => onTool(x.id)} pressed>
          {x.icon}
        </Btn>
      ))}
      <Sep />
      {([1, 2, 4] as ViewLayout[]).map((n) => (
        <Btn key={n} label={t("editor.views", { n })} active={layout === n} onClick={() => onLayout(n)} pressed>
          {layoutIcon(n)}
        </Btn>
      ))}
      <Sep />
      <Btn label={`${t("viewer.grid")} (G)`} active={showGrid} onClick={onGrid} pressed>
        <IconGrid size={17} />
      </Btn>
      <Btn label={t("editor.axes")} active={showAxes} onClick={onAxes} pressed>
        {ICONS.axes}
      </Btn>
      <Btn label={`${t("editor.ruler")} (M)`} active={showRuler} onClick={onRuler} pressed>
        <IconRuler size={17} />
      </Btn>
      <Btn label={`${t("editor.frame")} (F)`} onClick={onFrame}>
        <IconRefocus size={17} />
      </Btn>
      <span className="flex-1" />
      <Btn label={t("editor.properties")} active={propsOpen} onClick={onToggleProps}>
        <IconSettings size={17} />
      </Btn>
    </div>
  );
}

function Sep() {
  return <span aria-hidden className="my-1 h-px w-6 shrink-0 bg-fg/10" />;
}

function Btn({ label, active = false, pressed = false, onClick, children }: { label: string; active?: boolean; pressed?: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={pressed ? active : undefined}
      className={`tap flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition sm:h-10 sm:w-10 ${
        active ? "bg-neon-blue-strong text-white shadow-neon" : "text-fg/70 hover:bg-fg/10 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
