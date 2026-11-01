"use client";

import type { Design, MaterialKind, RecommendedMaterial } from "@/lib/design/schema";
import { MATERIAL_LABELS } from "@/lib/three/geometry";
import type { ViewerSettings } from "../viewer/settings";
import { IconBulb, IconCheck, IconCoin, IconExplode, IconHeart, IconLayers, IconRuler, IconSparkles, IconSteps, IconWire, IconCube } from "../icons";
import { formatDuration, formatLength, formatMoney, formatWeight, type LengthUnit } from "./format";
import { BulletList, Panel } from "./ui";

const SWATCHES = ["#5b6ee1", "#ff5fb5", "#2fd3c5", "#f5b13d", "#22232b", "#f2f2f5"];
const MATERIAL_CHOICES: (MaterialKind | null)[] = [null, "plastic", "metal", "wood", "glass"];

export function RightColumn({
  design,
  settings,
  onSettings,
  unit,
  favoriteMaterials,
  onToggleFavoriteMaterial,
}: {
  design: Design | null;
  settings: ViewerSettings;
  onSettings(patch: Partial<ViewerSettings>): void;
  unit: LengthUnit;
  favoriteMaterials: string[];
  onToggleFavoriteMaterial(name: string): void;
}) {
  const totalMinutes = design?.fabrication.reduce((s, f) => s + f.durationMin, 0) ?? 0;
  const maxItem = Math.max(1, ...(design?.cost.items.map((i) => i.amount) ?? [1]));

  return (
    <div className="flex min-h-0 flex-col gap-3 scrollbar-thin md:h-full md:overflow-y-auto lg:pl-0.5 [&>*]:shrink-0">
      {/* Modes d'affichage (grille 2×2) */}
      <section className="panel grid grid-cols-2 gap-1.5 p-1.5" aria-label="Modes d'affichage">
        <ModeButton active={settings.mode === "neon"} onClick={() => onSettings({ mode: "neon" })} icon={<IconSparkles size={14} />}>
          Néon
        </ModeButton>
        <ModeButton active={settings.mode === "real"} onClick={() => onSettings({ mode: "real" })} icon={<IconCube size={14} />}>
          Réaliste
        </ModeButton>
        <ModeButton active={settings.wireframe} onClick={() => onSettings({ wireframe: !settings.wireframe })} icon={<IconWire size={14} />}>
          Fil de fer
        </ModeButton>
        <ModeButton active={settings.exploded} onClick={() => onSettings({ exploded: !settings.exploded })} icon={<IconExplode size={14} />}>
          Éclaté
        </ModeButton>
      </section>

      <Panel icon={<IconRuler size={15} />} title="Dimensions">
        {design ? (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["L", design.dimensions.width],
                  ["P", design.dimensions.depth],
                  ["H", design.dimensions.height],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-brand-accent/[0.07] px-2 py-2 text-center">
                  <p className="text-[10px] font-semibold text-brand-accent">{label}</p>
                  <p className="text-[12px] font-semibold tabular-nums">{formatLength(value, unit)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 flex justify-between text-[11.5px] text-ink-soft">
              <span>Masse estimée</span>
              <span className="font-semibold text-ink">{formatWeight(design.dimensions.weightGrams)}</span>
            </p>
            <p className="mt-1 flex justify-between text-[11.5px] text-ink-soft">
              <span>Pièces</span>
              <span className="font-semibold text-ink">{design.model.parts.length}</span>
            </p>
            {design.dimensions.notes && <p className="mt-2 text-[11px] leading-snug text-ink-mute">{design.dimensions.notes}</p>}
          </>
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel icon={<IconLayers size={15} />} title="Matériaux">
        {design ? (
          <>
            {design.materiaux_conseilles.length > 0 && (
              <RecommendedMaterials
                design={design}
                settings={settings}
                onSettings={onSettings}
                favoriteMaterials={favoriteMaterials}
                onToggleFavorite={onToggleFavoriteMaterial}
              />
            )}
            <p className="mb-1.5 mt-3 text-[10.5px] font-medium text-ink-mute">Nomenclature du modèle</p>
            <ul className="space-y-2">
              {design.materials.map((m, i) => (
                <li key={i} className="rounded-xl border border-line/80 p-2.5">
                  <p className="flex items-center gap-2 text-[12px] font-semibold">
                    <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: m.color }} />
                    {m.name}
                    <span className="ml-auto text-[10.5px] font-medium text-ink-mute">{m.quantity}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-mute">{m.usage}</p>
                </li>
              ))}
            </ul>
            <p className="mb-1.5 mt-3 text-[10.5px] font-medium text-ink-mute">Aperçu matière</p>
            <div className="flex flex-wrap gap-1">
              {MATERIAL_CHOICES.map((kind) => (
                <button
                  key={kind ?? "origine"}
                  type="button"
                  onClick={() => onSettings({ materialOverride: kind, mode: kind ? "real" : settings.mode })}
                  className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition ${
                    settings.materialOverride === kind ? "bg-brand-accent text-white" : "bg-paper text-ink-soft hover:text-ink"
                  }`}
                >
                  {kind ? MATERIAL_LABELS[kind] : "Origine"}
                </button>
              ))}
            </div>
            <p className="mb-1.5 mt-2.5 text-[10.5px] font-medium text-ink-mute">Couleur</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onSettings({ colorOverride: null })}
                className={`h-6 rounded-full px-2 text-[10px] font-semibold ${
                  settings.colorOverride === null ? "bg-ink text-white" : "bg-paper text-ink-soft"
                }`}
              >
                Origine
              </button>
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Couleur ${c}`}
                  onClick={() => onSettings({ colorOverride: c })}
                  className={`h-6 w-6 rounded-full ring-1 ring-black/10 transition ${
                    settings.colorOverride === c ? "scale-110 outline outline-2 outline-offset-2 outline-brand-accent" : ""
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </>
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel
        icon={<IconSteps size={15} />}
        title="Fabrication"
        defaultOpen={false}
        aside={design ? <span className="text-[10.5px] font-semibold text-ink-mute">{formatDuration(totalMinutes)}</span> : null}
      >
        {design ? (
          <ol className="space-y-2">
            {design.fabrication.map((step, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-accent text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-tight">{step.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-mute">{step.detail}</p>
                  <p className="mt-0.5 text-[10.5px] text-brand-accent">
                    {step.tool} · {formatDuration(step.durationMin)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel icon={<IconCoin size={15} />} title="Coût estimé" defaultOpen={false}>
        {design ? (
          <>
            <p className="text-lg font-bold tracking-tight">
              {formatMoney(design.cost.min, design.cost.currency)}
              {design.cost.max > design.cost.min && (
                <span className="text-ink-mute"> – {formatMoney(design.cost.max, design.cost.currency)}</span>
              )}
            </p>
            <ul className="mt-2 space-y-1.5">
              {design.cost.items.map((it, i) => (
                <li key={i}>
                  <p className="flex justify-between text-[11px] text-ink-soft">
                    <span className="truncate pr-2">{it.label}</span>
                    <span className="font-semibold tabular-nums text-ink">{formatMoney(it.amount, design.cost.currency)}</span>
                  </p>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-paper">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-from to-brand-to"
                      style={{ width: `${Math.max(4, (it.amount / maxItem) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {design.cost.notes && <p className="mt-2 text-[11px] text-ink-mute">{design.cost.notes}</p>}
          </>
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel icon={<IconBulb size={15} />} title="Recommandations" defaultOpen={false}>
        {design ? (
          <div className="space-y-2.5">
            <BulletList items={design.recommendations} />
            {design.solution.keyFeatures.length > 0 && (
              <div className="rounded-xl bg-paper p-2.5">
                <p className="mb-1 text-[10.5px] font-medium text-ink-mute">Points forts</p>
                <BulletList items={design.solution.keyFeatures} />
              </div>
            )}
          </div>
        ) : (
          <Empty />
        )}
      </Panel>
    </div>
  );
}

/** Matières conseillées par l'IA, de la plus à la moins recommandée ; un clic les applique au modèle 3D. */
function RecommendedMaterials({
  design,
  settings,
  onSettings,
  favoriteMaterials,
  onToggleFavorite,
}: {
  design: Design;
  settings: ViewerSettings;
  onSettings(patch: Partial<ViewerSettings>): void;
  favoriteMaterials: string[];
  onToggleFavorite(name: string): void;
}) {
  const criteria = design.criteres_materiaux;
  const isActive = (m: RecommendedMaterial) => settings.colorOverride === m.couleur && settings.materialOverride === m.aspect;
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-medium text-ink-mute">Matières conseillées pour votre demande</p>
      {criteria && (
        <div className="mb-2 flex flex-wrap gap-1">
          {[criteria.usage, criteria.charge, criteria.chaleur, criteria.contact_alimentaire ? "Contact alimentaire" : "", criteria.budget, criteria.fabrication]
            .filter(Boolean)
            .map((c) => (
              <span key={c} className="rounded-full bg-paper px-2 py-0.5 text-[10px] text-ink-soft">
                {c}
              </span>
            ))}
        </div>
      )}
      <ol className="space-y-2">
        {design.materiaux_conseilles.map((m, i) => {
          const active = isActive(m);
          const favorite = favoriteMaterials.includes(m.nom);
          return (
            <li key={`${m.nom}-${i}`}>
              <div
                className={`rounded-xl border p-2.5 transition ${
                  active ? "border-brand-accent bg-brand-accent/[0.06] ring-2 ring-brand-accent/20" : "border-line/80 hover:border-brand-accent/40"
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onSettings(
                        active
                          ? { colorOverride: null, materialOverride: null }
                          : { colorOverride: m.couleur, materialOverride: m.aspect, mode: "real" },
                      )
                    }
                    aria-pressed={active}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                    title="Appliquer cette matière au modèle 3D"
                  >
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-black/10"
                      style={{ background: m.couleur }}
                    >
                      {active && <IconCheck size={11} strokeWidth={3} className="text-white mix-blend-difference" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1">
                        <span className="text-[12.5px] font-semibold">
                          {i + 1}. {m.nom}
                        </span>
                        {i === 0 && <span className="chip !px-1.5 !py-0.5 !text-[9.5px] bg-brand-accent text-white">Recommandé</span>}
                        {m.alternative_economique && (
                          <span className="chip !px-1.5 !py-0.5 !text-[9.5px] bg-emerald-100 text-emerald-700">Économique</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-soft">{m.pourquoi}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(m.nom)}
                    aria-pressed={favorite}
                    aria-label={favorite ? `Retirer ${m.nom} des matières préférées` : `Ajouter ${m.nom} aux matières préférées`}
                    className={`shrink-0 rounded-full p-1 transition ${favorite ? "text-rose-500" : "text-ink-mute hover:text-rose-500"}`}
                  >
                    <IconHeart size={14} fill={favorite ? "currentColor" : "none"} />
                  </button>
                </div>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 pl-7 text-[10.5px] leading-snug">
                  <dt className="text-ink-mute">Limites</dt>
                  <dd className="text-ink-soft">{m.limites}</dd>
                  <dt className="text-ink-mute">Coût</dt>
                  <dd className="font-semibold text-ink">{m.cout_approx}</dd>
                  <dt className="text-ink-mute">Procédé</dt>
                  <dd className="text-brand-accent">{m.procede}</dd>
                </dl>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick(): void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11.5px] font-semibold transition ${
        active
          ? "border-brand-accent/60 bg-brand-accent/[0.08] text-brand-accent"
          : "border-transparent bg-paper/70 text-ink-soft hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Empty() {
  return <p className="text-xs text-ink-mute">Disponible une fois la conception prête.</p>;
}
