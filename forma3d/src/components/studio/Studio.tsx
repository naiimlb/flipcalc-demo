"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { deleteRequest } from "@/app/actions";
import { REQUEST_COLUMNS, toRequestItem, type RequestItem } from "@/lib/requests";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { DEFAULT_VIEWER_SETTINGS, type ViewerSettings } from "../viewer/settings";
import { IconChevronLeft, IconChevronRight } from "../icons";
import { Portal } from "../Portal";
import { AuthPrompt } from "./AuthPrompt";
import { readPending, savePending } from "./draft";
import { readGuestItems, saveGuestItems } from "./guest";
import { HistoryTab } from "./HistoryTab";
import type { ImagePayload } from "./image";
import { JsonDrawer } from "./JsonDrawer";
import { LeftColumn } from "./LeftColumn";
import { PromptBar } from "./PromptBar";
import { RightColumn } from "./RightColumn";
import { SettingsTab } from "./SettingsTab";
import { Notifications, SearchBox, TABS } from "./TopBar";
import type { StudioFeatures, StudioTab, StudioViewer } from "./types";
import { useModelAutosave } from "./useModelAutosave";
import { usePrefs } from "./usePrefs";
import { ViewerPanel } from "./ViewerPanel";

export interface StudioProps {
  initialItems: RequestItem[];
  samples: RequestItem[];
  viewer: StudioViewer | null;
  features: StudioFeatures;
  demoMode: boolean;
  /** Projet à ouvrir (lien « Ouvrir » depuis Mon espace : /?p=<id>). */
  initialSelectedId: string | null;
}

const TEMP_PREFIX = "tmp-";
const SELECTED_KEY = "forma3d:selected";
/** Signalé au bouton « Mettre à jour » : on ne recharge pas pendant une génération. */
export const BUSY_EVENT = "forma3d:busy";

export function Studio({ initialItems, samples, viewer, features, demoMode, initialSelectedId }: StudioProps) {
  const [userItems, setUserItems] = useState<RequestItem[]>(initialItems);
  const [guestItems, setGuestItems] = useState<RequestItem[]>([]);
  const items = useMemo(() => {
    if (demoMode) return [...userItems, ...samples];
    if (viewer) return userItems.length ? userItems : samples;
    return [...userItems, ...guestItems, ...samples];
  }, [demoMode, viewer, userItems, guestItems, samples]);

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? items[0]?.id ?? null);
  const selected = items.find((i) => i.id === selectedId) ?? items[0] ?? null;
  const selectedIndex = selected ? items.indexOf(selected) : -1;

  const [tab, setTab] = useState<StudioTab>("overview");
  const [prefs, updatePrefs] = usePrefs(viewer?.units);
  const [settings, setSettings] = useState<ViewerSettings>(DEFAULT_VIEWER_SETTINGS);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [rawById, setRawById] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [restore, setRestore] = useState<{ prompt: string; image: ImagePayload | null } | null>(null);
  const [favoriteMaterials, setFavoriteMaterials] = useState<string[]>(viewer?.favoriteMaterials ?? []);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const busy = userItems.some((i) => i.id.startsWith(TEMP_PREFIX));
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(BUSY_EVENT, { detail: busy }));
  }, [busy]);

  useEffect(() => {
    setSettings((s) => ({ ...s, mode: prefs.mode, autoRotate: prefs.autoRotate, showGrid: prefs.showGrid }));
  }, [prefs.mode, prefs.autoRotate, prefs.showGrid]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  // Projet affiché mémorisé pour la session (retrouvé après une mise à jour du site).
  useEffect(() => {
    if (initialSelectedId) return;
    try {
      const saved = sessionStorage.getItem(SELECTED_KEY);
      if (saved) setSelectedId(saved);
    } catch {
      // ignoré
    }
  }, [initialSelectedId]);
  useEffect(() => {
    try {
      if (selected && !selected.id.startsWith(TEMP_PREFIX)) sessionStorage.setItem(SELECTED_KEY, selected.id);
    } catch {
      // ignoré
    }
  }, [selected]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (jsonOpen || authPrompt || tab !== "overview") return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jsonOpen, authPrompt, tab, step]);

  /* ---------------- Essai sans compte → import après inscription ---------------- */

  useEffect(() => {
    if (demoMode) return;
    const stored = readGuestItems();
    if (!stored.length) return;
    if (!viewer) {
      setGuestItems(stored);
      return;
    }
    (async () => {
      const imported: RequestItem[] = [];
      for (const item of stored) {
        const res = await fetch("/api/requests/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: item.prompt, design: item.design, provider: item.provider, model: item.model }),
        }).catch(() => null);
        if (res?.ok) imported.push(((await res.json()) as { request: RequestItem }).request);
      }
      if (imported.length) {
        saveGuestItems([]);
        setUserItems((prev) => [...imported, ...prev]);
        setSelectedId(imported[0].id);
        showToast(imported.length > 1 ? "Vos essais ont été ajoutés à votre espace." : "Votre essai a été ajouté à votre espace.");
      }
    })();
  }, [demoMode, viewer, showToast]);

  /* ---------------- Synchronisation avec la base ---------------- */

  const refreshFromDb = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase || !viewer) return;
    const { data } = await supabase
      .from("design_requests")
      .select(REQUEST_COLUMNS)
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (data) setUserItems((prev) => [...prev.filter((i) => i.id.startsWith(TEMP_PREFIX)), ...data.map(toRequestItem)]);
  }, [viewer]);

  const hasRemoteProcessing = userItems.some((i) => i.status === "processing" && !i.id.startsWith(TEMP_PREFIX));
  useEffect(() => {
    if (demoMode || !hasRemoteProcessing) return;
    const t = setInterval(refreshFromDb, 5000);
    return () => clearInterval(t);
  }, [demoMode, hasRemoteProcessing, refreshFromDb]);

  // Demande interrompue par un rechargement (mise à jour du site) : remise dans la barre.
  useEffect(() => {
    const pending = readPending();
    if (!pending) return;
    savePending(null);
    const recent = initialItems.some(
      (i) => i.prompt === pending.prompt && Date.now() - new Date(i.createdAt).getTime() < 15 * 60_000,
    );
    if (!recent) {
      setRestore(pending);
      showToast("Votre demande en cours a été remise dans la barre : relancez-la.");
    }
  }, [initialItems, showToast]);

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

  const patchItem = useCallback((id: string, patch: Partial<RequestItem>) => {
    setUserItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }, []);

  useModelAutosave(
    userItems,
    selected?.id ?? null,
    viewer && !demoMode ? viewer.id : null,
    useCallback((id: string, path: string) => patchItem(id, { modelPath: path }), [patchItem]),
  );

  /* ---------------- Création d'une demande ---------------- */

  const create = useCallback(
    async (prompt: string, image: ImagePayload | null) => {
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
        folderId: null,
        isFavorite: false,
        modelPath: null,
        source: "generated",
      };
      const previousId = selectedId;
      savePending({ prompt, image });
      setUserItems((prev) => [placeholder, ...prev]);
      setSelectedId(tempId);
      setTab("overview");

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, image: image ? { mediaType: image.mediaType, data: image.data } : null }),
        });
        const body = (await res.json().catch(() => ({}))) as { request?: RequestItem; raw?: string; error?: string; code?: string };
        if (!res.ok || !body.request) {
          setUserItems((prev) => prev.filter((i) => i.id !== tempId));
          setSelectedId(previousId);
          savePending(null);
          if (res.status === 401 || body.code === "guest_quota" || body.code === "guest_unavailable") {
            setRestore({ prompt, image });
            setAuthPrompt(body.error ?? "Créez un compte gratuit pour lancer vos demandes et les retrouver partout.");
            return;
          }
          if (res.status === 504) {
            showToast("La génération prend plus de temps que prévu : elle apparaîtra dans l'historique.");
            void refreshFromDb();
            return;
          }
          setRestore({ prompt, image });
          showToast(body.error ?? "La génération a échoué. Réessayez.");
          return;
        }
        savePending(null);
        const item = body.request;
        if (item.guest) {
          // Essai invité : affiché et gardé dans ce navigateur jusqu'à l'inscription.
          setUserItems((prev) => prev.filter((i) => i.id !== tempId));
          setGuestItems((prev) => {
            const next = [item, ...prev].slice(0, 5);
            saveGuestItems(next);
            return next;
          });
          setSelectedId(item.id);
          if (item.status === "ready") {
            setTimeout(
              () => setAuthPrompt("Votre conception est prête. Créez un compte pour la sauvegarder : elle sera ajoutée à votre espace."),
              2500,
            );
          }
          return;
        }
        setUserItems((prev) => prev.map((i) => (i.id === tempId ? item : i)));
        setSelectedId((current) => (current === tempId ? item.id : current));
        if (body.raw) setRawById((prev) => ({ ...prev, [item.id]: body.raw! }));
        showToast(item.status === "ready" ? `Conception prête : ${item.title ?? "nouveau modèle"}` : item.error ?? "Échec de la génération.");
      } catch {
        setUserItems((prev) =>
          prev.map((i) => (i.id === tempId ? { ...i, status: "error", error: "Connexion interrompue pendant la génération." } : i)),
        );
        void refreshFromDb();
      }
    },
    [selectedId, showToast, refreshFromDb],
  );

  const remove = useCallback(
    async (id: string) => {
      const guest = guestItems.some((i) => i.id === id);
      if (demoMode || guest || id.startsWith(TEMP_PREFIX)) {
        setUserItems((prev) => prev.filter((i) => i.id !== id));
        setGuestItems((prev) => {
          const next = prev.filter((i) => i.id !== id);
          saveGuestItems(next);
          return next;
        });
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
    [demoMode, guestItems, showToast],
  );

  const toggleFavorite = useCallback(
    async (item: RequestItem) => {
      const supabase = getBrowserSupabase();
      if (!supabase || !viewer || item.sample || item.guest) return;
      patchItem(item.id, { isFavorite: !item.isFavorite });
      const { error } = await supabase.from("design_requests").update({ is_favorite: !item.isFavorite }).eq("id", item.id);
      if (error) {
        patchItem(item.id, { isFavorite: item.isFavorite });
        showToast("Mise à jour impossible.");
      }
    },
    [viewer, patchItem, showToast],
  );

  const toggleFavoriteMaterial = useCallback(
    async (name: string) => {
      const supabase = getBrowserSupabase();
      if (!supabase || !viewer) {
        setAuthPrompt("Créez un compte pour enregistrer vos matières préférées.");
        return;
      }
      const next = favoriteMaterials.includes(name)
        ? favoriteMaterials.filter((m) => m !== name)
        : [...favoriteMaterials, name].slice(-50);
      setFavoriteMaterials(next);
      const { error } = await supabase.from("profiles").update({ favorite_materials: next }).eq("id", viewer.id);
      if (error) {
        setFavoriteMaterials(favoriteMaterials);
        showToast("Enregistrement impossible.");
      }
    },
    [viewer, favoriteMaterials, showToast],
  );

  const patchSettings = useCallback((patch: Partial<ViewerSettings>) => setSettings((s) => ({ ...s, ...patch })), []);

  // Unités : préférence du compte (Mon espace) quand on est connecté.
  const onPrefs = useCallback(
    (patch: Partial<typeof prefs>) => {
      updatePrefs(patch);
      const supabase = getBrowserSupabase();
      if (patch.unit && viewer && supabase) void supabase.from("profiles").update({ units: patch.unit }).eq("id", viewer.id);
    },
    [updatePrefs, viewer],
  );

  return (
    <>
      {/* Barre de demande + navigation */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <PromptBar onSubmit={create} busy={busy} allowImage={features.imageUpload} restore={restore} />
        </div>
        <div className="flex items-center gap-1.5">
          <nav aria-label="Sections" className="flex flex-1 gap-1 rounded-full bg-white/90 p-1 shadow-soft lg:flex-none">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`relative flex-1 rounded-full px-3.5 py-2 text-xs font-semibold transition lg:flex-none ${
                  tab === t.id ? "text-white" : "text-ink-soft hover:text-ink"
                }`}
              >
                {tab === t.id && (
                  <motion.span
                    layoutId="studio-tab"
                    className="absolute inset-0 rounded-full bg-brand-accent"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </nav>
          <span className="flex gap-1.5 rounded-full bg-white/90 p-1 shadow-soft">
            <SearchBox items={items} onSelect={select} />
            <Notifications items={items} onSelect={select} />
          </span>
        </div>
      </div>

      {/* Fil d'Ariane + projet précédent / suivant */}
      {tab === "overview" && (
        <div className="flex items-center gap-2 text-[12px] font-medium text-white/85">
          <button type="button" onClick={() => setTab("history")} className="hover:text-white">
            Projets
          </button>
          <IconChevronRight size={12} />
          <span className="min-w-0 truncate text-white">{selected?.title ?? selected?.prompt ?? "—"}</span>
          {items.length > 1 && (
            <span className="ml-auto flex items-center gap-1">
              <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Projet précédent" onClick={() => step(-1)}>
                <IconChevronLeft size={14} />
              </button>
              <span className="tabular-nums">
                {selectedIndex + 1}/{items.length}
              </span>
              <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Projet suivant" onClick={() => step(1)}>
                <IconChevronRight size={14} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Zone de travail */}
      <div className="min-h-0 flex-1">
        {tab === "overview" && (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_300px] lg:h-full lg:grid-cols-[272px_minmax(0,1fr)_300px] 2xl:grid-cols-[300px_minmax(0,1fr)_340px]">
            <div className="order-2 min-h-0 md:order-3 md:col-span-2 lg:order-1 lg:col-span-1 lg:h-full">
              <LeftColumn
                item={selected}
                items={items}
                onSelect={select}
                onNew={() => window.dispatchEvent(new Event("forma3d:focus-prompt"))}
                onToggleFavorite={toggleFavorite}
                onSignupPrompt={() => setAuthPrompt("Créez un compte pour sauvegarder ce résultat dans votre espace.")}
                demoMode={demoMode}
                signedIn={Boolean(viewer)}
              />
            </div>
            <div className="order-1 min-h-0 lg:order-2 lg:h-full">
              <ViewerPanel
                item={selected}
                settings={settings}
                onSettings={patchSettings}
                features={features}
                onNew={() => window.dispatchEvent(new Event("forma3d:focus-prompt"))}
                onShowJson={() => setJsonOpen(true)}
                onToast={showToast}
              />
            </div>
            <div className="order-3 min-h-0 md:order-2 md:h-[62dvh] lg:order-3 lg:h-full">
              <RightColumn
                design={selected?.design ?? null}
                settings={settings}
                onSettings={patchSettings}
                unit={prefs.unit}
                favoriteMaterials={favoriteMaterials}
                onToggleFavoriteMaterial={toggleFavoriteMaterial}
              />
            </div>
          </div>
        )}
        {tab === "history" && (
          <div className="h-full rounded-[24px] bg-paper/95 p-3 shadow-card sm:p-4">
            <HistoryTab
              items={items}
              selectedId={selected?.id ?? null}
              onOpen={select}
              onDelete={remove}
              canDelete={demoMode || Boolean(viewer) || guestItems.length > 0}
            />
          </div>
        )}
        {tab === "settings" && (
          <div className="h-full rounded-[24px] bg-paper/95 p-3 shadow-card sm:p-4">
            <SettingsTab prefs={prefs} onPrefs={onPrefs} viewer={viewer} demoMode={demoMode} />
          </div>
        )}
      </div>

      <JsonDrawer item={jsonOpen ? selected : null} localRaw={selected ? rawById[selected.id] ?? null : null} onClose={() => setJsonOpen(false)} />
      <AuthPrompt message={authPrompt} onClose={() => setAuthPrompt(null)} />

      <Portal>
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <AnimatePresence>
            {toast && (
              <motion.div
                role="status"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="pointer-events-auto max-w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-float"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Portal>
    </>
  );
}
