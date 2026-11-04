"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { DESIGN_SECTIONS, type StreamProgress } from "@/lib/design/partial-json";
import { detectAr, type ArMode } from "@/lib/ar-detect";
import type { Design } from "@/lib/design/schema";
import type { RequestItem } from "@/lib/requests";
import { downloadBlob, exportGlb, exportStl, fileBaseName } from "@/lib/three/export";
import { viewerBackgroundCss, viewerBackgroundStops, type ViewerHandle, type ViewerSettings } from "../viewer/settings";
import type { TransformChange, TransformMode } from "../viewer/ModelViewer";
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
import { Portal } from "../Portal";
import { usePreferences, useT } from "../app/Preferences";
import type { StudioFeatures } from "./types";

const ModelViewer = dynamic(() => import("../viewer/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-white/80">
      <Spinner size={22} />
    </div>
  ),
});

const STAGES = ["stage.analysis", "stage.design", "stage.check", "stage.ready"] as const;

export function ViewerPanel({
  item,
  settings,
  onSettings,
  features,
  onNew,
  onShowJson,
  onToast,
  selection,
  onSelection,
  handleRef,
  hiddenIds = [],
  showAxes = false,
  showRuler = false,
  editor = false,
  className,
  selectedIds,
  transformMode = null,
  snap = null,
  uniformScale = false,
  onTransform,
  measure = false,
  meshControl,
}: {
  item: RequestItem | null;
  settings: ViewerSettings;
  onSettings(patch: Partial<ViewerSettings>): void;
  features: StudioFeatures;
  onNew(): void;
  onShowJson(): void;
  onToast(message: string): void;
  /** Pièce sélectionnée, partagée avec l'arborescence et le panneau de propriétés (éditeur). */
  selection?: string | null;
  onSelection?: (id: string | null, additive?: boolean) => void;
  selectedIds?: string[];
  transformMode?: TransformMode | null;
  snap?: { translate: number; rotate: number; scale: number } | null;
  uniformScale?: boolean;
  onTransform?: (id: string, change: TransformChange) => void;
  measure?: boolean;
  /** Maillage Meshy affiché (piloté par l'éditeur) : affichage et version choisie. */
  meshControl?: { show: boolean; key: string | null; onShow(v: boolean): void };
  /** Commandes de la vue (export PNG, recadrage) utilisées par la barre du haut de l'éditeur. */
  handleRef?: React.RefObject<ViewerHandle | null>;
  hiddenIds?: string[];
  showAxes?: boolean;
  showRuler?: boolean;
  /** Dans l'éditeur : export et grille sont dans les barres d'outils, la vue remplit sa zone. */
  editor?: boolean;
  className?: string;
}) {
  const { t, dark } = usePreferences();
  const ownHandle = useRef<ViewerHandle>(null);
  const handle = handleRef ?? ownHandle;
  const wrap = useRef<HTMLDivElement>(null);
  // Chargement différé : le moteur 3D (le plus lourd du site) n'est téléchargé qu'une fois la zone visible et le navigateur au repos.
  const [armed, setArmed] = useState(false);
  const [ownFocus, setOwnFocus] = useState<string | null>(null);
  const focusId = selection !== undefined ? selection : ownFocus;
  const setFocusId = (id: string | null, additive = false) => (onSelection ? onSelection(id, additive) : setOwnFocus(id));
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ownShowMesh, setOwnShowMesh] = useState(false);
  const showMesh = meshControl ? meshControl.show : ownShowMesh;
  const setShowMesh = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(showMesh) : v;
    if (meshControl) meshControl.onShow(next);
    else setOwnShowMesh(next);
  };
  const design = item?.design ?? null;
  const parts = design?.model.parts ?? [];
  const focusIndex = focusId ? parts.findIndex((p) => p.id === focusId) : -1;
  const meshReady = item?.asset?.status === "succeeded" && !item.sample;
  // Fond clair en mode réaliste : boutons et pastilles foncés pour rester lisibles.
  const light = Boolean(design) && (settings.background === "light" || ((settings.background ?? "auto") === "auto" && settings.mode === "real" && !dark));
  const chip = light ? "bg-ink/10 text-ink" : "bg-white/20 text-white";

  useEffect(() => {
    setOwnFocus(null);
    setOwnShowMesh(false);
  }, [item?.id]);

  useEffect(() => {
    const el = wrap.current;
    if (armed || !el) return;
    let cancelled = false;
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (!cancelled) setArmed(true);
    };
    // Priorité à l'affichage de la page : le moteur 3D n'est demandé qu'une fois la page chargée, le navigateur au repos
    // et la zone visible (ou dès que l'utilisateur touche à la page).
    let visible = typeof IntersectionObserver === "undefined";
    let loaded = document.readyState === "complete";
    const schedule = () => {
      if (!visible || !loaded || cancelled) return;
      if ("requestIdleCallback" in window) idle = window.requestIdleCallback(arm, { timeout: 1500 });
      else timer = setTimeout(arm, 200);
    };
    const onLoad = () => {
      loaded = true;
      schedule();
    };
    if (!loaded) window.addEventListener("load", onLoad, { once: true });
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (!entries.some((e) => e.isIntersecting)) return;
              observer?.disconnect();
              visible = true;
              schedule();
            },
            { rootMargin: "300px" },
          );
    observer?.observe(el);
    // Un clic, un toucher ou une touche : l'utilisateur est là, on charge tout de suite.
    const wake = () => arm();
    window.addEventListener("pointerdown", wake, { once: true, passive: true });
    window.addEventListener("keydown", wake, { once: true });
    schedule();
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener("load", onLoad);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      if (idle !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idle);
      if (timer) clearTimeout(timer);
    };
  }, [armed]);

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
      onToast(t("viewer.failed", { label }));
    } finally {
      setBusy(false);
    }
  };

  const exportItems = design && !editor
    ? [
        features.exportGlb && {
          kind: "file",
          label: t("viewer.exportGlb"),
          run: () =>
            run("Export GLB", async () => {
              const buffer = await exportGlb(design);
              downloadBlob(new Blob([buffer], { type: "model/gltf-binary" }), `${fileBaseName(design)}.glb`);
            }),
        },
        features.exportStl && {
          kind: "file",
          label: t("viewer.exportStl"),
          run: () =>
            run("Export STL", async () => {
              const buffer = exportStl(design);
              downloadBlob(new Blob([buffer], { type: "model/stl" }), `${fileBaseName(design)}.stl`);
            }),
        },
        features.exportPng && {
          kind: "capture",
          label: t("viewer.capture"),
          run: () =>
            run("Capture", async () => {
              const blob = await handle.current?.capturePng();
              if (!blob) throw new Error("Capture vide");
              downloadBlob(blob, `${fileBaseName(design)}.png`);
            }),
        },
      ].filter(Boolean) as { kind: "file" | "capture"; label: string; run(): void }[]
    : [];

  return (
    <div
      ref={wrap}
      className={className ?? "relative h-[52dvh] min-h-[300px] overflow-hidden rounded-[24px] shadow-card md:h-[62dvh] lg:h-full lg:min-h-0"}
      style={{ background: viewerBackgroundCss(design ? settings.mode : "neon", dark, settings.background) }}
    >
      {/* Halo décoratif */}
      <div className="pointer-events-none absolute -left-1/4 top-1/3 h-2/3 w-[150%] rounded-[100%] border border-white/15" />

      {design && !armed && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80">
          <Spinner size={22} />
        </div>
      )}
      {design && armed && (
        <ModelViewer
          design={design}
          settings={settings}
          focusId={focusId}
          onFocusChange={setFocusId}
          handleRef={handle}
          meshUrl={showMesh && meshReady && item ? `/api/requests/${item.id}/asset/file?k=${meshControl?.key ?? item.asset?.key ?? ""}` : null}
          hiddenIds={hiddenIds}
          showAxes={showAxes}
          showRuler={showRuler}
          selectedIds={selectedIds}
          transformMode={transformMode}
          snap={snap}
          uniformScale={uniformScale}
          onTransform={onTransform}
          measure={measure}
          backgroundStops={viewerBackgroundStops(settings.mode, dark, settings.background)}
        />
      )}

      {/* Barre d'outils verticale */}
      {design && (
        <div className="absolute right-3 top-3 flex flex-col gap-1.5">
          <ToolButton light={light} label={t("viewer.zoomIn")} onClick={() => handle.current?.zoomIn()}>
            <IconPlus size={15} />
          </ToolButton>
          <ToolButton light={light} label={t("viewer.zoomOut")} onClick={() => handle.current?.zoomOut()}>
            <IconMinus size={15} />
          </ToolButton>
          <ToolButton light={light} label={t("viewer.recenter")} onClick={() => handle.current?.resetView()}>
            <IconRefocus size={15} />
          </ToolButton>
          <ToolButton
            light={light}
            label={settings.autoRotate ? t("viewer.stopRotate") : t("viewer.autoRotate")}
            active={settings.autoRotate}
            onClick={() => onSettings({ autoRotate: !settings.autoRotate })}
          >
            <IconRotate size={15} />
          </ToolButton>
          {!editor && (
            <ToolButton light={light} label={t("viewer.grid")} active={settings.showGrid} onClick={() => onSettings({ showGrid: !settings.showGrid })}>
              <IconGrid size={15} />
            </ToolButton>
          )}
          {exportItems.length > 0 && (
            <div className="relative">
              <ToolButton light={light} label={t("viewer.export")} onClick={() => setExportOpen((o) => !o)} active={exportOpen}>
                {busy ? <Spinner size={14} /> : <IconDownload size={15} />}
              </ToolButton>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 6 }}
                    className="absolute right-10 top-0 z-10 w-48 rounded-2xl bg-surface/95 p-1.5 shadow-float backdrop-blur"
                  >
                    {exportItems.map((e) => (
                      <button
                        key={e.label}
                        type="button"
                        onClick={e.run}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-paper"
                      >
                        {e.kind === "capture" ? <IconCamera size={14} /> : <IconDownload size={14} />}
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
            <IconCube size={12} /> {t("viewer.parts", { n: parts.length })}
          </span>
          {meshReady && (
            <button type="button" onClick={() => setShowMesh((s) => !s)} className="chip bg-surface/90 text-brand-accent">
              {showMesh ? t("meshy.showParts") : t("meshy.showMesh")}
            </button>
          )}
          {item?.asset && !meshReady && item.asset.status !== "failed" && (
            <span className={`chip ${chip}`}>
              <Spinner size={11} /> {t("meshy.progress", { n: item.asset.progress })}
            </span>
          )}
          {armed && <ArButton design={design} onToast={onToast} />}
          {features.devMode && (
            <button type="button" onClick={onShowJson} className="chip bg-black/40 text-white hover:bg-black/60">
              <IconCode size={12} /> JSON
            </button>
          )}
        </div>
      )}

      {design && armed && <GestureHint />}

      {/* Navigation entre les pièces */}
      {design && parts.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 rounded-full bg-surface px-1 py-1 shadow-float">
          <button type="button" aria-label={t("viewer.prevPart")} onClick={() => stepPart(-1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-paper">
            <IconChevronLeft size={15} />
          </button>
          <span className="min-w-0 truncate px-1 text-[11px] font-semibold text-ink-soft">
            {focusIndex >= 0 ? `${focusIndex + 1}/${parts.length} · ${parts[focusIndex].name}` : t("viewer.allParts")}
          </span>
          <button type="button" aria-label={t("viewer.nextPart")} onClick={() => stepPart(1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-paper">
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
      <AnimatePresence>{item?.status === "processing" && <Processing key="processing" startedAt={item.createdAt} stream={item.stream ?? null} />}</AnimatePresence>

      {/* États vides / erreur */}
      {!item && (
        <Centered>
          <p className="text-sm font-semibold text-white">{t("viewer.empty")}</p>
          <p className="mt-1 text-xs text-white/75">{t("viewer.emptyHint")}</p>
          <button type="button" onClick={onNew} className="btn mt-4 bg-surface !text-xs text-brand-accent">
            <IconPlus size={14} /> {t("left.newRequest")}
          </button>
        </Centered>
      )}
      {item?.status === "error" && !design && (
        <Centered>
          <p className="text-sm font-semibold text-white">{t("viewer.noModel")}</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-white/80">{item.error}</p>
          <button type="button" onClick={onNew} className="btn mt-4 bg-surface !text-xs text-brand-accent">
            {t("viewer.retry")}
          </button>
        </Centered>
      )}
    </div>
  );
}

/** « Voir chez moi » : réalité augmentée à taille réelle (masqué si l'appareil ne la prend pas en charge). */
function ArButton({ design, onToast }: { design: Design; onToast(message: string): void }) {
  const t = useT();
  const [mode, setMode] = useState<ArMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    detectAr()
      .then((m) => !cancelled && setMode(m))
      .catch(() => {});
    return () => {
      cancelled = true;
      stop.current?.();
    };
  }, []);

  // Session WebXR : démarrée une fois le calque (DOM overlay) affiché.
  useEffect(() => {
    if (!session || !overlay.current) return;
    let cancelled = false;
    import("@/lib/ar")
      .then((ar) => ar.startWebXr(design, overlay.current!, () => setSession(false)))
      .then((end) => {
        if (cancelled) end();
        else stop.current = end;
      })
      .catch((err) => {
        console.error(err);
        setSession(false);
        onToast(t("ar.failed"));
      });
    return () => {
      cancelled = true;
    };
  }, [session, design, onToast, t]);

  if (!mode) return null;

  const open = async () => {
    if (mode === "webxr") {
      setSession(true);
      return;
    }
    setBusy(true);
    try {
      const ar = await import("@/lib/ar");
      await ar.openQuickLook(design);
    } catch (err) {
      console.error(err);
      onToast(t("ar.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={open} disabled={busy} className="chip bg-surface/90 text-brand-accent" title={t("ar.title")}>
        {busy ? <Spinner size={11} /> : <IconCube size={12} />} {t("ar.button")}
      </button>
      {session && (
        <Portal>
          <div ref={overlay} className="fixed inset-0 z-[70] flex flex-col items-center justify-between p-6 text-white">
            <p className="mt-10 rounded-full bg-black/55 px-4 py-2 text-sm font-medium">{t("ar.place")}</p>
            <button
              type="button"
              onClick={() => (stop.current ? stop.current() : setSession(false))}
              className="mb-8 rounded-full bg-surface px-6 py-3 text-sm font-semibold text-ink"
            >
              {t("ar.close")}
            </button>
          </div>
        </Portal>
      )}
    </>
  );
}

/** Rappel des gestes tactiles, affiché quelques secondes la première fois sur écran tactile. */
function GestureHint() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem("forma3d:gesture-hint") === "1";
    } catch {
      // stockage indisponible : on affiche quand même
    }
    if (seen || !window.matchMedia?.("(pointer: coarse)").matches) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      try {
        localStorage.setItem("forma3d:gesture-hint", "1");
      } catch {
        // ignoré
      }
    }, 7000);
    return () => clearTimeout(timer);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="status"
          className="pointer-events-none absolute left-3 right-14 top-12 rounded-2xl bg-black/45 px-3 py-2 text-center text-[11px] font-medium text-white backdrop-blur"
        >
          {t("viewer.gestures")}
        </motion.p>
      )}
    </AnimatePresence>
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
            : "bg-surface text-brand-accent"
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

/** Écran de chargement : Analyse → Conception → Contrôle → Prêt, d'après le flux de l'IA (ou le temps écoulé). */
function Processing({ startedAt, stream }: { startedAt: string; stream: StreamProgress | null }) {
  const t = useT();
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - start) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const done = stream?.done ?? [];
  const current = DESIGN_SECTIONS.findIndex((s) => !done.includes(s.key));
  // Étape principale (0 Analyse, 1 Conception, 2 Contrôle) ; sans flux, avancement selon le temps.
  const stage = !stream
    ? Math.min(2, Math.floor(elapsed / 25))
    : stream.stage === "saving"
      ? 2
      : stream.stage === "writing" && current > 0
        ? 1
        : 0;
  const label = !stream
    ? `${t(STAGES[stage])}…`
    : stream.stage === "checking"
      ? t("stage.checking")
      : stream.stage === "saving"
        ? t("stage.saving")
        : stream.stage === "thinking" || current < 0
          ? t("stage.thinking")
          : t("stage.writing", { section: t(`section.${DESIGN_SECTIONS[current].key}`) });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-4"
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
      <ol className="mt-6 flex items-center gap-1.5" aria-label={label}>
        {STAGES.map((key, i) => (
          <li key={key} className="flex items-center gap-1.5">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                i < stage ? "bg-white text-brand-accent" : i === stage ? "bg-white/40 text-white ring-1 ring-white/70" : "bg-white/15 text-white/70"
              }`}
            >
              {i < stage ? "✓ " : ""}
              {t(key)}
            </span>
            {i < STAGES.length - 1 && <span className="text-white/60" aria-hidden>→</span>}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm font-semibold text-white" role="status">
        {label}
      </p>
      <p className="mt-1 text-xs text-white/75">{t("stage.elapsed", { s: elapsed })}</p>
    </motion.div>
  );
}
