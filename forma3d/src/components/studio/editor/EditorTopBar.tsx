"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, m as motion } from "framer-motion";
import type { RequestItem } from "@/lib/requests";
import { downloadBlob, exportGlb, exportStl, fileBaseName } from "@/lib/three/export";
import type { ViewerHandle } from "../../viewer/settings";
import { IconCamera, IconCheck, IconDownload, IconPencil, IconRedo, IconUndo, LogoMark, Spinner } from "../../icons";
import { Tooltip } from "../../ui/Tooltip";
import { CreditsBadge, type CreditsSnapshot } from "../../app/CreditsBadge";
import { PreferenceMenuButton } from "../../app/PreferencePicker";
import { useT } from "../../app/Preferences";
import { AccountMenu, Notifications, SearchBox, TABS, dropdown, useOutsideClose } from "../TopBar";
import type { StudioFeatures, StudioTab, StudioViewer } from "../types";
import type { SaveState } from "../useDesignEditor";

/**
 * Barre du haut de l'éditeur : accueil, nom du projet (renommable), annuler / rétablir, enregistrer, exporter,
 * onglets, recherche, notifications, crédits, thème / langue et compte.
 */
export function EditorTopBar({
  siteName,
  logoDataUrl,
  item,
  items,
  onSelect,
  tab,
  onTab,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveState,
  onSave,
  onRename,
  editable,
  features,
  viewerHandle,
  onToast,
  viewer,
  demoMode,
  credits,
}: {
  siteName: string;
  logoDataUrl: string | null;
  item: RequestItem | null;
  items: RequestItem[];
  onSelect(id: string): void;
  tab: StudioTab;
  onTab(tab: StudioTab): void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo(): void;
  onRedo(): void;
  saveState: SaveState;
  onSave(): void;
  onRename(title: string): void;
  editable: boolean;
  features: StudioFeatures;
  viewerHandle: React.RefObject<ViewerHandle | null>;
  onToast(message: string): void;
  viewer: StudioViewer | null;
  demoMode: boolean;
  credits: CreditsSnapshot | null;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useOutsideClose(exportOpen, () => setExportOpen(false));
  const design = item?.design ?? null;
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const mod = mac ? "⌘" : "Ctrl+";

  const run = async (label: string, task: () => Promise<void>) => {
    setExporting(true);
    setExportOpen(false);
    try {
      await task();
    } catch (err) {
      console.error(err);
      onToast(t("viewer.failed", { label }));
    } finally {
      setExporting(false);
    }
  };
  const exportItems = design
    ? ([
        features.exportStl && {
          icon: <IconDownload size={14} />,
          label: t("viewer.exportStl"),
          run: () =>
            run("Export STL", async () => {
              downloadBlob(new Blob([exportStl(design)], { type: "model/stl" }), `${fileBaseName(design)}.stl`);
            }),
        },
        features.exportGlb && {
          icon: <IconDownload size={14} />,
          label: t("viewer.exportGlb"),
          run: () =>
            run("Export GLB", async () => {
              const buffer = await exportGlb(design);
              downloadBlob(new Blob([buffer], { type: "model/gltf-binary" }), `${fileBaseName(design)}.glb`);
            }),
        },
        features.exportPng && {
          icon: <IconCamera size={14} />,
          label: t("viewer.capture"),
          run: () =>
            run("Capture", async () => {
              const blob = await viewerHandle.current?.capturePng();
              if (!blob) throw new Error("Capture vide");
              downloadBlob(blob, `${fileBaseName(design)}.png`);
            }),
        },
      ].filter(Boolean) as { icon: React.ReactNode; label: string; run(): void }[])
    : [];

  const saveLabel =
    saveState === "saving" || saveState === "pending"
      ? t("editor.saving")
      : saveState === "saved"
        ? t("editor.saved")
        : saveState === "local"
          ? t("editor.savedLocal")
          : saveState === "error"
            ? t("editor.saveRetry")
            : t("editor.save");
  const title = item ? item.title ?? t("left.newRequest") : t("left.none");

  return (
    <header className="relative z-30 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-b border-line bg-surface px-2 py-1 sm:px-3">
      <Link href="/" aria-label={`${siteName} · ${t("nav.home")}`} title={t("nav.home")} className="tap flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink hover:bg-paper">
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoDataUrl} alt="" className="h-6 w-6 rounded object-contain" />
        ) : (
          <LogoMark size={22} />
        )}
      </Link>

      {/* Nom du projet */}
      <div className="flex min-w-0 max-w-[46vw] items-center gap-1 sm:max-w-[34vw] lg:max-w-[28vw]">
        {renaming && item?.design ? (
          <input
            autoFocus
            defaultValue={title}
            aria-label={t("editor.renameProject")}
            className="input !min-h-7 !py-0.5 !text-sm"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                onRename(e.currentTarget.value);
                setRenaming(false);
              } else if (e.key === "Escape") setRenaming(false);
            }}
            onBlur={(e) => {
              onRename(e.currentTarget.value);
              setRenaming(false);
            }}
          />
        ) : (
          <>
            <h2 className="truncate text-sm font-medium text-ink" title={title}>
              {title}
            </h2>
            {editable && (
              <Tooltip label={t("editor.renameProject")}>
                <button type="button" onClick={() => setRenaming(true)} aria-label={t("editor.renameProject")} className="icon-btn tap">
                  <IconPencil />
                </button>
              </Tooltip>
            )}
          </>
        )}
      </div>

      {/* Annuler / rétablir / enregistrer */}
      <div className="flex shrink-0 items-center gap-0.5 border-s border-line ps-1.5">
        <Tooltip label={t("editor.undo")} shortcut={`${mod}Z`}>
          <button type="button" onClick={onUndo} disabled={!canUndo} aria-label={`${t("editor.undo")} (${mod}Z)`} className="icon-btn tap">
            <IconUndo />
          </button>
        </Tooltip>
        <Tooltip label={t("editor.redo")} shortcut={`⇧${mod}Z`}>
          <button type="button" onClick={onRedo} disabled={!canRedo} aria-label={`${t("editor.redo")} (⇧${mod}Z)`} className="icon-btn tap">
            <IconRedo />
          </button>
        </Tooltip>
        {editable && (
          <button
            type="button"
            onClick={onSave}
            title={`${t("editor.save")} (${mod}S)`}
            aria-live="polite"
            className={`tap flex h-8 items-center gap-1 rounded-md px-2 text-xs ${saveState === "error" ? "text-danger" : "text-ink-mute"} hover:bg-paper hover:text-ink`}
          >
            {saveState === "saving" || saveState === "pending" ? <Spinner size={12} /> : saveState === "saved" || saveState === "local" ? <IconCheck size={13} /> : null}
            <span className="hidden sm:inline">{saveLabel}</span>
          </button>
        )}
      </div>

      {/* Onglets */}
      <nav aria-label={t("tabs.label")} className="order-last flex w-full gap-0.5 overflow-x-auto scrollbar-none md:order-none md:mx-auto md:w-auto">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => onTab(x.id)}
            aria-current={tab === x.id ? "page" : undefined}
            className={`tap flex-1 whitespace-nowrap rounded-md px-2.5 py-1 text-sm transition-colors md:flex-none ${tab === x.id ? "bg-paper font-medium text-ink" : "text-ink-mute hover:text-ink"}`}
          >
            {t(x.label)}
          </button>
        ))}
      </nav>

      <div className="ms-auto flex shrink-0 items-center gap-1 md:ms-0">
        <span className="hidden items-center gap-1 lg:flex">
          <SearchBox items={items} onSelect={onSelect} />
          <Notifications items={items} onSelect={onSelect} />
        </span>
        {exportItems.length > 0 && (
          <div ref={exportRef} className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              aria-expanded={exportOpen}
              className="btn-primary tap"
            >
              {exporting ? <Spinner size={16} /> : <IconDownload />}
              <span className="hidden sm:inline">{t("viewer.export")}</span>
            </button>
            <AnimatePresence>
              {exportOpen && (
                <motion.div {...dropdown} className="menu absolute end-0 top-10 z-40 w-56">
                  {exportItems.map((e) => (
                    <button key={e.label} type="button" onClick={e.run} className="list-item">
                      {e.icon}
                      {e.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {credits && <CreditsBadge initial={credits} />}
        <Link href="/galerie" className="btn-subtle tap hidden xl:inline-flex">
          {t("nav.gallery")}
        </Link>
        <PreferenceMenuButton />
        <AccountMenu viewer={viewer} demoMode={demoMode} />
      </div>
    </header>
  );
}
