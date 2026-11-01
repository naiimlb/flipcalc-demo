"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import type { RequestItem } from "@/lib/requests";
import { downloadBlob, exportGlb, exportStl, fileBaseName } from "@/lib/three/export";
import { viewerBackgroundCss, type ViewerHandle, type ViewerSettings } from "../viewer/settings";
import {
  IconCamera,
  IconChevronLeft,
  IconChevronRight,
  IconCode,
  IconCube,
  IconDownload,
  IconGrid,
  IconMinus,
  IconPlus,
  IconRefocus,
  IconRotate,
  Spinner,
} from "../icons";
import type { StudioFeatures } from "./types";

const ModelViewer = dynamic(() => import("../viewer/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-white/80">
      <Spinner size={22} />
    </div>
  ),
});

const STEPS = ["Analyse du problème", "Recherche de solution", "Dimensionnement", "Modélisation 3D", "Chiffrage"];

export function ViewerPanel({
  item,
  settings,
  onSettings,
  features,
  onNew,
  onShowJson,
  onToast,
}: {
  item: RequestItem | null;
  settings: ViewerSettings;
  onSettings(patch: Partial<ViewerSettings>): void;
  features: StudioFeatures;
  onNew(): void;
  onShowJson(): void;
  onToast(message: string): void;
}) {
  const handle = useRef<ViewerHandle>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMesh, setShowMesh] = useState(false);
  const design = item?.design ?? null;
  const parts = design?.model.parts ?? [];
  const focusIndex = focusId ? parts.findIndex((p) => p.id === focusId) : -1;
  const meshReady = item?.asset?.status === "succeeded" && !item.sample;
  // Fond clair en mode réaliste : boutons et pastilles foncés pour rester lisibles.
  const light = Boolean(design) && settings.mode === "real";
  const chip = light ? "bg-ink/10 text-ink" : "bg-white/20 text-white";

  useEffect(() => {
    setFocusId(null);
    setShowMesh(false);
  }, [item?.id]);

  const stepPart = (dir: 1 | -1) => {
    if (!parts.length) return;
    const next = focusIndex < 0 ? (dir === 1 ? 0 : parts.length - 1) : (focusIndex + dir + parts.length) % parts.length;
    setFocusId(parts[next].id);
  };

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(true);
    setExportOpen(false);
    try {
      await task();
    } catch (err) {
      console.error(err);
      onToast(`${label} impossible.`);
    } finally {
      setBusy(false);
    }
  };

  const exportItems = design
    ? [
        features.exportGlb && {
          label: "GLB (3D, couleurs)",
          run: () =>
            run("Export GLB", async () => {
              const buffer = await exportGlb(design);
              downloadBlob(new Blob([buffer], { type: "model/gltf-binary" }), `${fileBaseName(design)}.glb`);
            }),
        },
        features.exportStl && {
          label: "STL (impression 3D, mm)",
          run: () =>
            run("Export STL", async () => {
              const buffer = exportStl(design);
              downloadBlob(new Blob([buffer], { type: "model/stl" }), `${fileBaseName(design)}.stl`);
            }),
        },
        features.exportPng && {
          label: "Capture PNG",
          run: () =>
            run("Capture", async () => {
              const blob = await handle.current?.capturePng();
              if (!blob) throw new Error("Capture vide");
              downloadBlob(blob, `${fileBaseName(design)}.png`);
            }),
        },
      ].filter(Boolean) as { label: string; run(): void }[]
    : [];

  return (
    <div
      className="relative h-[52dvh] min-h-[300px] overflow-hidden rounded-[24px] shadow-card md:h-[62dvh] lg:h-full lg:min-h-0"
      style={{ background: viewerBackgroundCss(design ? settings.mode : "neon") }}
    >
      {/* Halo décoratif */}
      <div className="pointer-events-none absolute -left-1/4 top-1/3 h-2/3 w-[150%] rounded-[100%] border border-white/15" />

      {design && (
        <ModelViewer
          design={design}
          settings={settings}
          focusId={focusId}
          onFocusChange={setFocusId}
          handleRef={handle}
          meshUrl={showMesh && meshReady && item ? `/api/requests/${item.id}/asset/file` : null}
        />
      )}

      {/* Barre d'outils verticale */}
      {design && (
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <ToolButton light={light} label="Zoom avant" onClick={() => handle.current?.zoomIn()}>
            <IconPlus size={15} />
          </ToolButton>
          <ToolButton light={light} label="Zoom arrière" onClick={() => handle.current?.zoomOut()}>
            <IconMinus size={15} />
          </ToolButton>
          <ToolButton light={light} label="Recentrer" onClick={() => handle.current?.resetView()}>
            <IconRefocus size={15} />
          </ToolButton>
          <ToolButton
            light={light}
            label={settings.autoRotate ? "Arrêter la rotation" : "Rotation automatique"}
            active={settings.autoRotate}
            onClick={() => onSettings({ autoRotate: !settings.autoRotate })}
          >
            <IconRotate size={15} />
          </ToolButton>
          <ToolButton light={light} label="Grille" active={settings.showGrid} onClick={() => onSettings({ showGrid: !settings.showGrid })}>
            <IconGrid size={15} />
          </ToolButton>
          {exportItems.length > 0 && (
            <div className="relative">
              <ToolButton light={light} label="Exporter" onClick={() => setExportOpen((o) => !o)} active={exportOpen}>
                {busy ? <Spinner size={14} /> : <IconDownload size={15} />}
              </ToolButton>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    className="absolute right-10 top-0 z-10 w-48 rounded-2xl bg-white/95 p-1.5 shadow-float backdrop-blur"
                  >
                    {exportItems.map((e) => (
                      <button
                        key={e.label}
                        type="button"
                        onClick={e.run}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-paper"
                      >
                        {e.label.startsWith("Capture") ? <IconCamera size={14} /> : <IconDownload size={14} />}
                        {e.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Infos en haut à gauche */}
      {design && (
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className={`chip backdrop-blur ${chip}`}>
            <IconCube size={12} /> {parts.length} pièces
          </span>
          {meshReady && (
            <button type="button" onClick={() => setShowMesh((s) => !s)} className="chip bg-white/90 text-brand-accent">
              {showMesh ? "Voir les primitives" : "Voir le maillage IA"}
            </button>
          )}
          {item?.asset && !meshReady && item.asset.status !== "failed" && (
            <span className={`chip ${chip}`}>
              <Spinner size={11} /> Maillage {item.asset.progress}%
            </span>
          )}
          {features.devMode && (
            <button type="button" onClick={onShowJson} className="chip bg-black/40 text-white hover:bg-black/60">
              <IconCode size={12} /> JSON
            </button>
          )}
        </div>
      )}

      {/* Navigation entre les pièces */}
      {design && parts.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 rounded-full bg-white px-1 py-1 shadow-float">
          <button type="button" aria-label="Pièce précédente" onClick={() => stepPart(-1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-paper">
            <IconChevronLeft size={15} />
          </button>
          <span className="min-w-0 truncate px-1 text-[11px] font-semibold text-ink-soft">
            {focusIndex >= 0 ? `${focusIndex + 1}/${parts.length} · ${parts[focusIndex].name}` : "Toutes les pièces"}
          </span>
          <button type="button" aria-label="Pièce suivante" onClick={() => stepPart(1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-paper">
            <IconChevronRight size={15} />
          </button>
        </div>
      )}
      {focusIndex >= 0 && parts[focusIndex].role && (
        <p className="pointer-events-none absolute bottom-14 left-1/2 w-max max-w-[80%] -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-center text-[11px] text-white backdrop-blur">
          {parts[focusIndex].role}
        </p>
      )}

      {/* Génération en cours */}
      <AnimatePresence>{item?.status === "processing" && <Processing key="processing" startedAt={item.createdAt} />}</AnimatePresence>

      {/* États vides / erreur */}
      {!item && (
        <Centered>
          <p className="text-sm font-semibold text-white">Aucun projet pour l&apos;instant</p>
          <p className="mt-1 text-xs text-white/75">Décrivez un problème ou un objet : Forma3D le modélise en 3D.</p>
          <button type="button" onClick={onNew} className="btn mt-4 bg-white !text-xs text-brand-accent">
            <IconPlus size={14} /> Nouvelle demande
          </button>
        </Centered>
      )}
      {item?.status === "error" && !design && (
        <Centered>
          <p className="text-sm font-semibold text-white">Pas de modèle pour cette demande</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-white/80">{item.error}</p>
          <button type="button" onClick={onNew} className="btn mt-4 bg-white !text-xs text-brand-accent">
            Réessayer
          </button>
        </Centered>
      )}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  active,
  light,
  children,
}: {
  label: string;
  onClick(): void;
  active?: boolean;
  light?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition ${
        active
          ? light
            ? "bg-brand-accent text-white"
            : "bg-white text-brand-accent"
          : light
            ? "bg-ink/[0.07] text-ink-soft hover:bg-ink/15"
            : "bg-white/25 text-white hover:bg-white/40"
      }`}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">{children}</div>;
}

function Processing({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  const step = Math.min(STEPS.length - 1, Math.floor(elapsed / 9));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
    >
      <motion.div
        className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-white/25 to-transparent"
        initial={{ top: "-20%" }}
        animate={{ top: "110%" }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="h-20 w-20 rounded-2xl border-2 border-white/70"
        animate={{ rotateX: [0, 180, 360], rotateY: [0, 180, 360] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: "0 0 40px rgba(255,120,220,.55), inset 0 0 30px rgba(120,200,255,.5)" }}
      />
      <p className="mt-6 text-sm font-semibold text-white">{STEPS[step]}…</p>
      <p className="mt-1 text-xs text-white/75">{elapsed} s · en général 30 à 90 s</p>
      <div className="mt-3 flex gap-1.5">
        {STEPS.map((s, i) => (
          <span key={s} className={`h-1.5 w-6 rounded-full transition ${i <= step ? "bg-white" : "bg-white/30"}`} />
        ))}
      </div>
    </motion.div>
  );
}
