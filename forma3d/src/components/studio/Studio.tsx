"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { deleteRequest } from "@/app/actions";
import { REQUEST_COLUMNS, toRequestItem, type RequestItem } from "@/lib/requests";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { DEFAULT_VIEWER_SETTINGS, type ViewerSettings } from "../viewer/settings";
import { IconChevronLeft, IconChevronRight } from "../icons";
import { HistoryTab } from "./HistoryTab";
import { JsonDrawer } from "./JsonDrawer";
import { LeftColumn } from "./LeftColumn";
import { NewRequestDialog, type ImagePayload } from "./NewRequestDialog";
import { RecentCard } from "./RecentCard";
import { RightColumn } from "./RightColumn";
import { SettingsTab } from "./SettingsTab";
import { TopBar } from "./TopBar";
import type { StudioFeatures, StudioTab, StudioViewer } from "./types";
import { usePrefs } from "./usePrefs";
import { ViewerPanel } from "./ViewerPanel";

export interface StudioProps {
  initialItems: RequestItem[];
  samples: RequestItem[];
  viewer: StudioViewer | null;
  features: StudioFeatures;
  demoMode: boolean;
  siteName: string;
  logoDataUrl: string | null;
}

const TEMP_PREFIX = "tmp-";

export function Studio({ initialItems, samples, viewer, features, demoMode, siteName, logoDataUrl }: StudioProps) {
  const router = useRouter();
  const [userItems, setUserItems] = useState<RequestItem[]>(initialItems);
  const items = useMemo(
    () => (demoMode ? [...userItems, ...samples] : userItems.length ? userItems : samples),
    [demoMode, userItems, samples],
  );
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
  const selectedIndex = selected ? items.indexOf(selected) : -1;

  const [tab, setTab] = useState<StudioTab>("overview");
  const [prefs, updatePrefs] = usePrefs();
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_VIEWER_SETTINGS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [rawById, setRawById] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Les préférences (onglet Paramètres) pilotent les réglages par défaut de la visionneuse.
  useEffect(() => {
    setSettings((s) => ({ ...s, mode: prefs.mode, autoRotate: prefs.autoRotate, showGrid: prefs.showGrid }));
  }, [prefs.mode, prefs.autoRotate, prefs.showGrid]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setTab("overview");
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!items.length) return;
      const next = (Math.max(0, selectedIndex) + dir + items.length) % items.length;
      setSelectedId(items[next].id);
    },
    [items, selectedIndex],
  );

  // Flèches du clavier : projet précédent / suivant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialogOpen || jsonOpen || tab !== "overview") return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen, jsonOpen, tab, step]);

  /* ---------------- Synchronisation avec la base ---------------- */

  const refreshFromDb = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !viewer) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("design_requests")
      .select(REQUEST_COLUMNS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (data) {
      setUserItems((prev) => [...prev.filter((i) => i.id.startsWith(TEMP_PREFIX)), ...data.map(toRequestItem)]);
    }
  }, [viewer]);

  // Demandes encore « en cours » côté serveur (après un rechargement) : sondage toutes les 5 s.
  const hasRemoteProcessing = userItems.some((i) => i.status === "processing" && !i.id.startsWith(TEMP_PREFIX));
  useEffect(() => {
    if (demoMode || !hasRemoteProcessing) return;
    const t = setInterval(refreshFromDb, 5000);
    return () => clearInterval(t);
  }, [demoMode, hasRemoteProcessing, refreshFromDb]);

  // Maillage externe en cours (fournisseur text-to-3D) : sondage de la demande affichée.
  const assetPending =
    selected && !selected.sample && selected.asset && (selected.asset.status === "pending" || selected.asset.status === "running");
  const selectedRealId = selected?.id;
  useEffect(() => {
    if (!assetPending || !selectedRealId) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/requests/${selectedRealId}/asset`, { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { request?: RequestItem };
      if (body.request) setUserItems((prev) => prev.map((i) => (i.id === body.request!.id ? body.request! : i)));
    }, 6000);
    return () => clearInterval(t);
  }, [assetPending, selectedRealId]);

  /* ---------------- Création d'une demande ---------------- */

  const create = useCallback(
    async (prompt: string, image: ImagePayload | null) => {
      setDialogOpen(false);
      const tempId = `${TEMP_PREFIX}${Date.now()}`;
      const placeholder: RequestItem = {
        id: tempId,
        prompt,
        status: "processing",
        title: null,
        design: null,
        error: null,
        provider: null,
        model: null,
        hasImage: Boolean(image),
        createdAt: new Date().toISOString(),
        durationMs: null,
        asset: null,
      };
      const previousId = selectedId;
      setUserItems((prev) => [placeholder, ...prev]);
      setSelectedId(tempId);
      setTab("overview");

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, image: image ? { mediaType: image.mediaType, data: image.data } : null }),
        });
        const body = (await res.json().catch(() => ({}))) as { request?: RequestItem; raw?: string; error?: string };
        if (!res.ok || !body.request) {
          setUserItems((prev) => prev.filter((i) => i.id !== tempId));
          setSelectedId(previousId);
          if (res.status === 401) {
            router.push("/connexion");
            return;
          }
          if (res.status === 504) {
            showToast("La génération prend plus de temps que prévu : elle apparaîtra dans l'historique.");
            void refreshFromDb();
            return;
          }
          showToast(body.error ?? "La génération a échoué. Réessayez.");
          return;
        }
        const item = body.request;
        setUserItems((prev) => prev.map((i) => (i.id === tempId ? item : i)));
        setSelectedId((current) => (current === tempId ? item.id : current));
        if (body.raw) setRawById((prev) => ({ ...prev, [item.id]: body.raw! }));
        showToast(item.status === "ready" ? `Conception prête : ${item.title ?? "nouveau modèle"}` : item.error ?? "Échec de la génération.");
      } catch {
        setUserItems((prev) =>
          prev.map((i) =>
            i.id === tempId ? { ...i, status: "error", error: "Connexion interrompue pendant la génération." } : i,
          ),
        );
        void refreshFromDb();
      }
    },
    [router, selectedId, showToast, refreshFromDb],
  );

  const remove = useCallback(
    async (id: string) => {
      if (demoMode || id.startsWith(TEMP_PREFIX)) {
        setUserItems((prev) => prev.filter((i) => i.id !== id));
        return;
      }
      const result = await deleteRequest(id);
      if (!result.ok) {
        showToast(result.error ?? "Suppression impossible.");
        return;
      }
      setUserItems((prev) => prev.filter((i) => i.id !== id));
      showToast("Demande supprimée.");
    },
    [demoMode, showToast],
  );

  const patchSettings = useCallback((patch: Partial<ViewerSettings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const canCreate = demoMode || Boolean(viewer);

  return (
    <>
      <div className="relative mt-8 sm:mt-10 lg:mx-16">
        <NavArrow dir="left" onClick={() => step(-1)} disabled={items.length < 2} />
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Cadre de tablette */}
          <div className="relative rounded-[26px] bg-[#111114] p-[5px] shadow-[0_50px_90px_-35px_rgba(25,15,80,0.65)] ring-1 ring-black/60 sm:rounded-[40px] sm:p-3">
            <span className="absolute left-[3px] top-1/2 hidden h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#2a2a33] sm:block" />
            <span className="absolute -top-[3px] left-16 hidden h-[3px] w-10 rounded-t bg-[#2a2a33] sm:block" />
            <span className="absolute -top-[3px] left-28 hidden h-[3px] w-10 rounded-t bg-[#2a2a33] sm:block" />
            <div className="overflow-hidden rounded-[21px] bg-[#fbfbfd] sm:rounded-[30px]">
              <TopBar
                siteName={siteName}
                logoDataUrl={logoDataUrl}
                tab={tab}
                onTab={setTab}
                items={items}
                onSelect={select}
                viewer={viewer}
                demoMode={demoMode}
              />
              <div className="flex items-center gap-2 px-3 pb-2 pt-3 text-[11px] font-medium text-ink-soft sm:px-5">
                <button type="button" onClick={() => setTab("history")} className="hover:text-brand-accent">
                  Projets
                </button>
                <IconChevronRight size={12} />
                <span className="truncate text-ink">
                  {tab === "overview" ? (selected?.title ?? selected?.prompt ?? "—") : tab === "history" ? "Historique" : "Paramètres"}
                </span>
                {tab === "overview" && items.length > 1 && (
                  <span className="ml-auto flex items-center gap-1 lg:hidden">
                    <button type="button" className="icon-btn !h-7 !w-7" aria-label="Projet précédent" onClick={() => step(-1)}>
                      <IconChevronLeft size={14} />
                    </button>
                    <span className="tabular-nums">
                      {selectedIndex + 1}/{items.length}
                    </span>
                    <button type="button" className="icon-btn !h-7 !w-7" aria-label="Projet suivant" onClick={() => step(1)}>
                      <IconChevronRight size={14} />
                    </button>
                  </span>
                )}
              </div>

              <div className="px-3 pb-3 sm:px-5 sm:pb-5 lg:h-[600px]">
                {tab === "overview" && (
                  <div className="grid gap-3 lg:h-full lg:grid-cols-[236px_minmax(0,1fr)_236px] xl:grid-cols-[252px_minmax(0,1fr)_252px]">
                    <div className="order-2 min-h-0 lg:order-1 lg:h-full">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={selected?.id ?? "vide"}
                          className="lg:h-full"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={{ duration: 0.22 }}
                        >
                          <LeftColumn item={selected} onNew={() => setDialogOpen(true)} demoMode={demoMode} signedIn={Boolean(viewer)} />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <div className="order-1 min-h-0 lg:order-2 lg:h-full">
                      <ViewerPanel
                        item={selected}
                        settings={settings}
                        onSettings={patchSettings}
                        features={features}
                        onNew={() => setDialogOpen(true)}
                        onShowJson={() => setJsonOpen(true)}
                        onToast={showToast}
                      />
                    </div>
                    <div className="order-3 min-h-0 lg:h-full">
                      <RightColumn design={selected?.design ?? null} settings={settings} onSettings={patchSettings} unit={prefs.unit} />
                    </div>
                  </div>
                )}
                {tab === "history" && (
                  <HistoryTab
                    items={items}
                    selectedId={selected?.id ?? null}
                    onOpen={select}
                    onDelete={remove}
                    canDelete={demoMode || Boolean(viewer)}
                  />
                )}
                {tab === "settings" && <SettingsTab prefs={prefs} onPrefs={updatePrefs} viewer={viewer} demoMode={demoMode} />}
              </div>
            </div>
          </div>
        </motion.div>
        <NavArrow dir="right" onClick={() => step(1)} disabled={items.length < 2} />
      </div>

      <RecentCard
        items={items}
        selectedId={selected?.id ?? null}
        onSelect={select}
        className="mt-6 xl:absolute xl:-bottom-32 xl:-right-14 xl:mt-0 xl:w-[460px]"
      />

      <NewRequestDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={create}
        allowImage={features.imageUpload}
        canCreate={canCreate}
        paused={!features.newRequests && viewer?.role !== "admin"}
      />
      <JsonDrawer item={jsonOpen ? selected : null} localRaw={selected ? rawById[selected.id] ?? null : null} onClose={() => setJsonOpen(false)} />

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-float"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function NavArrow({ dir, onClick, disabled }: { dir: "left" | "right"; onClick(): void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Projet précédent" : "Projet suivant"}
      className={`absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink transition hover:bg-white hover:shadow-soft disabled:opacity-30 lg:flex ${
        dir === "left" ? "-left-16" : "-right-16"
      }`}
    >
      {dir === "left" ? <IconChevronLeft size={26} strokeWidth={1.6} /> : <IconChevronRight size={26} strokeWidth={1.6} />}
    </button>
  );
}
