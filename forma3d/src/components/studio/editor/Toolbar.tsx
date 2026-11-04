"use client";

import { IconAxes, IconGrid, IconLayers, IconMove, IconPlus, IconPointer, IconRefocus, IconRotate, IconRuler, IconScale, IconSettings, IconView1, IconView2, IconView4 } from "../../icons";
import { Tooltip } from "../../ui/Tooltip";
import { useT } from "../../app/Preferences";

export type EditorTool = "select" | "move" | "rotate" | "scale" | "measure";
export type ViewLayout = 1 | 2 | 4;

const LAYOUT_ICON: Record<ViewLayout, React.ReactNode> = { 1: <IconView1 />, 2: <IconView2 />, 4: <IconView4 /> };

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
  onAdd,
  addOpen = false,
  canAdd = true,
}: {
  onAdd(): void;
  addOpen?: boolean;
  canAdd?: boolean;
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
    { id: "select", key: "V", icon: <IconPointer /> },
    { id: "move", key: "W", icon: <IconMove /> },
    { id: "rotate", key: "E", icon: <IconRotate /> },
    { id: "scale", key: "R", icon: <IconScale /> },
    { id: "measure", key: "U", icon: <IconRuler /> },
  ];
  return (
    <div role="toolbar" aria-orientation="vertical" aria-label={t("editor.toolbar")} className="flex w-11 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-e border-line bg-surface py-2 scrollbar-none">
      <Btn label={t("editor.parts")} active={partsOpen} onClick={onToggleParts}>
        <IconLayers />
      </Btn>
      <Btn label={t("editor.add")} active={addOpen} onClick={onAdd} disabled={!canAdd} dataAddToggle>
        <IconPlus />
      </Btn>
      <Sep />
      {tools.map((x) => (
        <Btn key={x.id} label={t(`editor.tool.${x.id}`)} shortcut={x.key} active={tool === x.id} onClick={() => onTool(x.id)} pressed>
          {x.icon}
        </Btn>
      ))}
      <Sep />
      {([1, 2, 4] as ViewLayout[]).map((n) => (
        <Btn key={n} label={t("editor.views", { n })} active={layout === n} onClick={() => onLayout(n)} pressed>
          {LAYOUT_ICON[n]}
        </Btn>
      ))}
      <Sep />
      <Btn label={t("viewer.grid")} shortcut="G" active={showGrid} onClick={onGrid} pressed>
        <IconGrid />
      </Btn>
      <Btn label={t("editor.axes")} active={showAxes} onClick={onAxes} pressed>
        <IconAxes />
      </Btn>
      <Btn label={t("editor.ruler")} shortcut="M" active={showRuler} onClick={onRuler} pressed>
        <IconRuler />
      </Btn>
      <Btn label={t("editor.frame")} shortcut="F" onClick={onFrame}>
        <IconRefocus />
      </Btn>
      <span className="flex-1" />
      <Btn label={t("editor.properties")} active={propsOpen} onClick={onToggleProps}>
        <IconSettings />
      </Btn>
    </div>
  );
}

function Sep() {
  return <span aria-hidden className="my-1 h-px w-6 shrink-0 bg-line" />;
}

function Btn({
  label,
  shortcut,
  active = false,
  pressed = false,
  disabled = false,
  dataAddToggle = false,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  dataAddToggle?: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut} side="right">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-add-toggle={dataAddToggle || undefined}
        aria-label={shortcut ? `${label} (${shortcut})` : label}
        aria-pressed={pressed ? active : undefined}
        className={`tap flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
          active ? "bg-accent/15 text-accent" : "text-ink-soft hover:bg-paper hover:text-ink"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
