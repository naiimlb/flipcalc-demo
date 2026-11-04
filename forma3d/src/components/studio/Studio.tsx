"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { deleteRequest } from "@/app/actions";
import type { Answer, ClarifyQuestion } from "@/lib/clarify-types";
import type { Design, Finish } from "@/lib/design/schema";
import type { TransformChange } from "../viewer/ModelViewer";
import { deletePart, duplicatePart, renameDesign, updatePart, type PartPatch } from "@/lib/design/edit";
import { FINISH_PRESETS } from "@/lib/design/finishes";
import {
  addShape,
  addText,
  arrayCircular,
  arrayLinear,
  chamferPart,
  cutInHalf,
  deleteParts,
  designBounds,
  drillHole,
  filletPart,
  freeformPart,
  groupMembers,
  groupParts,
  hollowPart,
  mirrorPart,
  scalePartBy,
  scaleToSize,
  translateParts,
  ungroupParts,
  type NewShape,
  type OpError,
  type OpResult,
} from "@/lib/design/ops";
import { downloadBlob, fileBaseName } from "@/lib/three/export";
import type { VariantId, VariantIntensity } from "@/lib/design/variants";
import { REQUEST_COLUMNS, toRequestItem, type RequestItem } from "@/lib/requests";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { DEFAULT_VIEWER_SETTINGS, type ViewerHandle, type ViewerSettings } from "../viewer/settings";
import { IconSteps, Spinner } from "../icons";
import { Portal } from "../Portal";
import { useT } from "../app/Preferences";
import { AuthPrompt } from "./AuthPrompt";
import { ClarifyPanel } from "./ClarifyPanel";
import { ShareDialog } from "./ShareDialog";
import { CREDITS_EVENT, type CreditsSnapshot } from "../app/CreditsBadge";
import { readPending, savePending } from "./draft";
import { readGuestItems, saveGuestItems } from "./guest";
import { HistoryTab } from "./HistoryTab";
import type { ImagePayload } from "./image";
import { JsonDrawer } from "./JsonDrawer";
import { LeftColumn } from "./LeftColumn";
import { PromptBar } from "./PromptBar";
import { RightColumn } from "./RightColumn";
import { readEventStream } from "./stream";
import { SettingsTab } from "./SettingsTab";
import type { StudioFeatures, StudioTab, StudioViewer } from "./types";
import { BottomBar } from "./editor/BottomBar";
import { DockPanel } from "./editor/DockPanel";
import { EditorTopBar } from "./editor/EditorTopBar";
import { PartsTree } from "./editor/PartsTree";
import { MeasuredDimensions, PartInspector, PartMaterial, ProjectSummary, PropertiesPanel, RealScaleBox, type PropsTab } from "./editor/PropertiesPanel";
import { Toolbar, type EditorTool, type ViewLayout } from "./editor/Toolbar";
import { Viewports } from "./editor/Viewports";
import { AddMenu } from "./editor/AddMenu";
import { DrawDialog } from "./editor/DrawDialog";
import { AiEditBox, GuidedSliders } from "./editor/GuidedPanels";
import { MaterialLibrary, RenderPanel } from "./editor/LookPanels";
import { CostConfirm, MeshyModelPanel, MeshyPrintPanel, type MeshyRun, type MeshyStatus } from "./editor/MeshyPanels";
import { OperationsPanel, type OpRequest, type SnapSettings } from "./editor/OperationsPanel";
import { TextDialog } from "./editor/TextDialog";
import { useDesignEditor } from "./useDesignEditor";
import { useModelAutosave } from "./useModelAutosave";
import { usePrefs } from "./usePrefs";
import { ViewerPanel } from "./ViewerPanel";

// Onglet « Fabriquer » et comparaison : chargés à la demande (calculs 3D, plans), pas au premier affichage.
const FabricationTab = dynamic(() => import("./FabricationTab"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-ink-mute">
      <Spinner size={20} />
    </div>
  ),
});
const CompareDialog = dynamic(() => import("./CompareDialog"), { ssr: false });

export interface StudioProps {
  initialItems: RequestItem[];
  samples: RequestItem[];
  viewer: StudioViewer | null;
  features: StudioFeatures;
  demoMode: boolean;
  /** Projet à ouvrir (lien « Ouvrir » depuis Mon espace : /studio?p=<id>). */
  initialSelectedId: string | null;
  /** Conception de la galerie à reprendre comme point de départ (/studio?depart=<id>). */
  startFrom?: { prompt: string; design: unknown; title: string } | null;
  siteName?: string;
  logoDataUrl?: string | null;
  /** Solde de crédits (barre du haut), null sans compte ou sans le script SQL de la phase 5. */
  credits?: (CreditsSnapshot & { costs?: Record<string, number> }) | null;
}

const LAYOUT_KEY = "forma3d:editor-layout";

const TEMP_PREFIX = "tmp-";
const SELECTED_KEY = "forma3d:selected";
/** Signalé au bouton « Mettre à jour » : on ne recharge pas pendant une génération. */
export const BUSY_EVENT = "forma3d:busy";

export function Studio({
  initialItems,
  samples: baseSamples,
  viewer,
  features,
  demoMode,
  initialSelectedId,
  startFrom = null,
  siteName = "Forma3D",
  logoDataUrl = null,
  credits = null,
}: StudioProps) {
  const tr = useT();
  const [userItems, setUserItems] = useState<RequestItem[]>(initialItems);
  const [guestItems, setGuestItems] = useState<RequestItem[]>([]);
  // Exemples modifiés dans l'éditeur (gardés pour la session, et sur l'appareil).
  const [sampleEdits, setSampleEdits] = useState<Record<string, Design>>({});
  const samples = useMemo(
    () => baseSamples.map((s) => (sampleEdits[s.id] ? { ...s, design: sampleEdits[s.id], title: sampleEdits[s.id].title } : s)),
    [baseSamples, sampleEdits],
  );
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
  // Assistant de questions : la génération attend la réponse de l'utilisateur (ou « Passer »).
  const [clarify, setClarify] = useState<{ prompt: string; questions: ClarifyQuestion[]; resolve(answers: Answer[] | null): void } | null>(null);
  // Projet dont les panneaux viennent d'être remplis : ils apparaissent un par un.
  const [revealId, setRevealId] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ a: string; b: string } | null>(null);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------------- État de l'éditeur ---------------- */
  const viewerHandle = useRef<ViewerHandle>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [tool, setTool] = useState<EditorTool>("select");
  const [layout, setLayout] = useState<ViewLayout>(1);
  const [showAxes, setShowAxes] = useState(false);
  const [showRuler, setShowRuler] = useState(false);
  const [propsTab, setPropsTab] = useState<PropsTab>("object");
  // Grand écran : panneaux ancrés ; iPad et téléphone : tiroirs (fermés au départ).
  const [wide, setWide] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => {
      setWide(media.matches);
      setPartsOpen(media.matches);
      setPropsOpen(media.matches);
    };
    update();
    media.addEventListener("change", update);
    try {
      const saved = Number(localStorage.getItem(LAYOUT_KEY));
      if (saved === 1 || saved === 2 || saved === 4) setLayout(saved);
    } catch {
      // ignoré
    }
    return () => media.removeEventListener("change", update);
  }, []);
  const chooseLayout = useCallback((n: ViewLayout) => {
    setLayout(n);
    try {
      localStorage.setItem(LAYOUT_KEY, String(n));
    } catch {
      // ignoré
    }
  }, []);
  const toggleParts = useCallback(() => {
    setPartsOpen((o) => !o);
    if (!wide) setPropsOpen(false);
  }, [wide]);
  const toggleProps = useCallback(() => {
    setPropsOpen((o) => !o);
    if (!wide) setPartsOpen(false);
  }, [wide]);

  const busy = userItems.some((i) => i.id.startsWith(TEMP_PREFIX));

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
        showToast(imported.length > 1 ? tr("toast.importedMany") : tr("toast.imported"));
      }
    })();
  }, [demoMode, viewer, showToast]);

  /* ---------------- Point de départ venu de la galerie ---------------- */

  const startedRef = useRef(false);
  useEffect(() => {
    if (!startFrom || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      let item: RequestItem | null = null;
      if (viewer && !demoMode) {
        // Compte : la conception est copiée dans l'espace de l'utilisateur.
        const res = await fetch("/api/requests/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: startFrom.prompt, design: startFrom.design, provider: "gallery", model: null }),
        }).catch(() => null);
        if (res?.ok) item = ((await res.json()) as { request: RequestItem }).request;
        if (item) setUserItems((prev) => [item!, ...prev]);
      } else {
        // Visiteur : gardée dans ce navigateur, comme un essai.
        item = {
          id: `guest-${Date.now()}`,
          prompt: startFrom.prompt,
          status: "ready",
          title: startFrom.title,
          design: startFrom.design as Design,
          error: null,
          provider: "gallery",
          model: null,
          hasImage: false,
          createdAt: new Date().toISOString(),
          durationMs: null,
          asset: null,
          folderId: null,
          isFavorite: false,
          modelPath: null,
          source: "import",
          guest: true,
        };
        const guestItem = item;
        setGuestItems((prev) => {
          const next = [guestItem, ...prev].slice(0, 5);
          saveGuestItems(next);
          return next;
        });
      }
      if (item) {
        setSelectedId(item.id);
        showToast(tr("gallery.started"));
      }
      // Le lien ?depart= ne doit pas être rejoué au rechargement.
      window.history.replaceState(null, "", window.location.pathname);
    })();
  }, [startFrom, viewer, demoMode, showToast, tr]);

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
      showToast(tr("toast.restored"));
    }
  }, [initialItems, showToast]);

  const runningState = (s?: string) => s === "pending" || s === "running";
  const assetPending =
    selected && !selected.sample && selected.asset && (runningState(selected.asset.status) || runningState(selected.asset.analysis?.status));
  const selectedRealId = selected?.id;
  useEffect(() => {
    if (!assetPending || !selectedRealId) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/requests/${selectedRealId}/asset`, { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { request?: RequestItem; credits?: CreditsSnapshot | null };
      // Seul l'état Meshy change ici : la conception (peut-être modifiée dans l'éditeur) est conservée.
      if (body.request) setUserItems((prev) => prev.map((i) => (i.id === body.request!.id ? { ...i, asset: body.request!.asset } : i)));
      if (body.credits) window.dispatchEvent(new CustomEvent(CREDITS_EVENT, { detail: body.credits }));
    }, 5000);
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

  /* ---------------- Modifications dans l'éditeur ---------------- */

  const applyDesign = useCallback(
    (id: string, design: Design) => {
      const patch = (list: RequestItem[]) => list.map((i) => (i.id === id ? { ...i, design, title: design.title || i.title } : i));
      setUserItems((prev) => (prev.some((i) => i.id === id) ? patch(prev) : prev));
      setGuestItems((prev) => {
        if (!prev.some((i) => i.id === id)) return prev;
        const next = patch(prev);
        saveGuestItems(next);
        return next;
      });
      if (baseSamples.some((s) => s.id === id)) setSampleEdits((prev) => ({ ...prev, [id]: design }));
    },
    [baseSamples],
  );
  const canSaveOnline = useCallback(
    (i: RequestItem) => Boolean(viewer && !demoMode && !i.sample && !i.guest && !i.id.startsWith(TEMP_PREFIX) && i.status === "ready"),
    [viewer, demoMode],
  );
  const editor = useDesignEditor({
    item: selected,
    items,
    cloud: canSaveOnline,
    apply: applyDesign,
    onSaved: useCallback((id: string) => patchItem(id, { modelPath: null }), [patchItem]),
  });
  const editable = Boolean(selected?.design && selected.status === "ready");
  const selectedPart = selection ? selected?.design?.model.parts.find((p) => p.id === selection) ?? null : null;

  // Nouvelle pièce / nouveau projet : sélection et pièces masquées remises à zéro.
  useEffect(() => {
    setSelection(null);
    setHiddenIds([]);
  }, [selected?.id]);
  useEffect(() => {
    if (selection && !selected?.design?.model.parts.some((p) => p.id === selection)) setSelection(null);
  }, [selection, selected?.design]);

  const patchPart = useCallback(
    (patch: PartPatch, key: string) => {
      if (!selection) return;
      editor.edit((d) => updatePart(d, selection, patch), `${selection}:${key}`);
    },
    [editor, selection],
  );
  const renamePart = useCallback((id: string, name: string) => editor.edit((d) => updatePart(d, id, { name })), [editor]);
  const duplicateSelectedPart = useCallback(
    (id: string | null = selection) => {
      if (!id) return;
      let copy: string | null = null;
      editor.edit((d) => {
        const r = duplicatePart(d, id);
        copy = r.id;
        return r.design;
      });
      if (copy) setSelection(copy);
    },
    [editor, selection],
  );
  const deleteSelectedPart = useCallback(
    (id: string | null = selection) => {
      if (!id) return;
      editor.edit((d) => deletePart(d, id));
      setSelection(null);
    },
    [editor, selection],
  );
  const toggleHidden = useCallback((id: string) => setHiddenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])), []);
  const frame = useCallback(() => {
    const h = viewerHandle.current;
    if (h?.frame) h.frame(selection);
    else h?.resetView();
  }, [selection]);

  // Le bouton « Mettre à jour » attend la fin d'une génération et des sauvegardes en cours.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(BUSY_EVENT, { detail: busy || editor.pending }));
  }, [busy, editor.pending]);

  /* ---------------- Outils de création (refonte phase 3) ---------------- */

  // Sélection multiple : pièces ajoutées avec Maj / ⌘, ou tout un assemblage touché dans la vue 3D.
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const selectedIds = useMemo(() => (selection ? [...extraIds.filter((x) => x !== selection), selection] : []), [extraIds, selection]);
  useEffect(() => setExtraIds([]), [selected?.id]);
  useEffect(() => {
    const ids = new Set(selected?.design?.model.parts.map((p) => p.id) ?? []);
    setExtraIds((prev) => (prev.every((x) => ids.has(x)) ? prev : prev.filter((x) => ids.has(x))));
  }, [selected?.design]);
  const selectPart = useCallback(
    (id: string | null, additive = false, fromViewport = false) => {
      if (!id) {
        setSelection(null);
        setExtraIds([]);
        return;
      }
      if (additive) {
        if (selection === id) {
          const rest = extraIds.filter((x) => x !== id);
          setSelection(rest.at(-1) ?? null);
          setExtraIds(rest.slice(0, -1));
        } else if (extraIds.includes(id)) setExtraIds(extraIds.filter((x) => x !== id));
        else {
          if (selection) setExtraIds([...extraIds, selection]);
          setSelection(id);
        }
        return;
      }
      setSelection(id);
      // Dans la vue 3D, toucher une pièce assemblée sélectionne tout l'assemblage.
      setExtraIds(fromViewport && selected?.design ? groupMembers(selected.design, id).filter((x) => x !== id) : []);
    },
    [selection, extraIds, selected?.design],
  );

  const [snap, setSnap] = useState<SnapSettings>({ on: true, step: 5, angle: 15 });
  const [uniformScale, setUniformScale] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dialog, setDialog] = useState<"text" | "draw" | null>(null);
  const opMessage = useCallback((e: OpError) => tr(`opError.${e}`), [tr]);

  /** Applique une opération ; affiche la raison si elle ne s'applique pas à cette pièce. */
  const runResult = useCallback(
    (op: (d: Design) => OpResult, select = true): OpError | null => {
      let failure = null as OpError | null;
      let ids: string[] = [];
      editor.edit((d) => {
        const r = op(d);
        if ("error" in r) {
          failure = r.error;
          return d;
        }
        ids = r.ids;
        return r.design;
      });
      if (failure) showToast(opMessage(failure));
      else if (select && ids.length) {
        setSelection(ids.at(-1) ?? null);
        setExtraIds(ids.slice(0, -1));
      }
      return failure;
    },
    [editor, showToast, opMessage],
  );

  const runOp = useCallback(
    (op: OpRequest) => {
      const id = selection;
      if (!id) return;
      const ids = selectedIds;
      switch (op.type) {
        case "duplicate":
          if (ids.length > 1) {
            let made: string[] = [];
            editor.edit((d) => {
              let next = d;
              made = [];
              for (const x of ids) {
                const r = duplicatePart(next, x);
                next = r.design;
                if (r.id) made.push(r.id);
              }
              return next;
            });
            setSelection(made.at(-1) ?? null);
            setExtraIds(made.slice(0, -1));
          } else duplicateSelectedPart(id);
          return;
        case "delete":
          editor.edit((d) => deleteParts(d, ids));
          setSelection(null);
          setExtraIds([]);
          return;
        case "mirror":
          runResult((d) => mirrorPart(d, id, op.axis));
          return;
        case "array-line":
          runResult((d) => arrayLinear(d, id, op.count, op.spacing, op.axis));
          return;
        case "array-circle":
          runResult((d) => arrayCircular(d, id, op.count));
          return;
        case "cut":
          runResult((d) => cutInHalf(d, id, op.axis));
          return;
        case "hollow":
          runResult((d) => hollowPart(d, id, op.thickness));
          return;
        case "drill":
          runResult((d) => drillHole(d, id, op.diameter, op.u, op.v, op.along));
          return;
        case "fillet":
          runResult((d) => filletPart(d, id, op.radius));
          return;
        case "chamfer":
          runResult((d) => chamferPart(d, id, op.size));
          return;
        case "group":
          runResult((d) => groupParts(d, ids), false);
          showToast(tr("ops.grouped", { n: ids.length }));
          return;
        case "ungroup":
          runResult((d) => ungroupParts(d, selected?.design ? groupMembers(selected.design, id) : ids), false);
          return;
        case "lock":
          editor.edit((d) => ids.reduce((acc, x) => updatePart(acc, x, { locked: op.locked }), d));
          return;
      }
    },
    [selection, selectedIds, editor, duplicateSelectedPart, runResult, selected?.design, showToast, tr],
  );

  const addNewShape = useCallback(
    (shape: NewShape) => {
      if (!editable) return;
      runResult((d) => addShape(d, shape, tr(`shape.${shape === "box" ? "cube" : shape}`)));
      setTool("move");
    },
    [editable, runResult, tr],
  );

  const onTransform = useCallback(
    (id: string, change: TransformChange) => {
      const many = selectedIds.length > 1 ? selectedIds : [];
      editor.edit((d) => {
        if (tool === "move" && many.length > 1) return translateParts(d, many, change.delta);
        let next = updatePart(d, id, { position: change.position, rotation: change.rotation });
        if (tool === "scale") next = scalePartBy(next, id, change.scale);
        return next;
      }, `${id}:poignee:${Date.now()}`);
    },
    [editor, tool, selectedIds],
  );

  const applyFinish = useCallback(
    (finish: Finish, withColor: boolean) => {
      const preset = FINISH_PRESETS[finish];
      const targets = selectedIds.length ? selectedIds : selected?.design?.model.parts.map((p) => p.id) ?? [];
      editor.edit((d) =>
        targets.reduce((acc, x) => updatePart(acc, x, { finish, material: preset.kind, ...(withColor ? { color: preset.color } : {}) }), d),
      );
      setSettings((s) => ({ ...s, mode: "real", materialOverride: null, colorOverride: null }));
    },
    [editor, selectedIds, selected?.design],
  );

  // « Modifie la pièce » : réponse de l'IA (ou des consignes simples) appliquée comme une modification annulable.
  const [aiBusy, setAiBusy] = useState(false);
  const aiEdit = useCallback(
    async (instruction: string) => {
      if (!selected?.design || !editable) return false;
      setAiBusy(true);
      try {
        const res = await fetch("/api/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ design: selected.design, instruction, selectedId: selection }),
        });
        const body = (await res.json().catch(() => ({}))) as { design?: Design; ids?: string[]; summary?: string; error?: string; credits?: CreditsSnapshot | null };
        if (!res.ok || !body.design) {
          showToast(body.error ?? tr("ai.failed"));
          return false;
        }
        const next = body.design;
        editor.edit(() => next);
        if (body.credits) window.dispatchEvent(new CustomEvent(CREDITS_EVENT, { detail: body.credits }));
        showToast(body.summary ?? tr("ai.done"));
        return true;
      } catch {
        showToast(tr("toast.connection"));
        return false;
      } finally {
        setAiBusy(false);
      }
    },
    [selected?.design, editable, selection, editor, showToast, tr],
  );

  // Meshy : actions masquées tant que la clé ou le script SQL manque ; coût confirmé avant chaque lancement.
  const [meshy, setMeshy] = useState<MeshyStatus>({ available: false });
  const [meshyConfirm, setMeshyConfirm] = useState<MeshyRun | null>(null);
  const [meshyBusy, setMeshyBusy] = useState(false);
  const [showMesh, setShowMesh] = useState(false);
  const [meshKey, setMeshKey] = useState<string | null>(null);
  const refreshMeshy = useCallback(async () => {
    if (!viewer || demoMode) return;
    const res = await fetch("/api/meshy", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setMeshy((await res.json()) as MeshyStatus);
  }, [viewer, demoMode]);
  useEffect(() => {
    void refreshMeshy();
    const onCredits = () => void refreshMeshy();
    window.addEventListener(CREDITS_EVENT, onCredits);
    return () => window.removeEventListener(CREDITS_EVENT, onCredits);
  }, [refreshMeshy]);
  useEffect(() => {
    setShowMesh(false);
    setMeshKey(null);
  }, [selected?.id]);
  // Nouveau maillage Meshy prêt : il s'affiche.
  const lastMeshKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    const a = selected?.asset;
    if (a?.status === "succeeded" && a.key && lastMeshKey.current && lastMeshKey.current !== a.key) {
      setShowMesh(true);
      setMeshKey(null);
      showToast(tr("meshy.ready"));
    }
    lastMeshKey.current = a?.key;
  }, [selected?.asset, showToast, tr]);

  const runMeshy = useCallback(
    async (run: MeshyRun) => {
      if (!selected) return;
      setMeshyBusy(true);
      try {
        // Les modifications en attente sont enregistrées d'abord (le fichier 3D utilisé par Meshy doit être à jour).
        editor.flush();
        const res = await fetch("/api/meshy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: selected.id, kind: run.kind, texturePrompt: run.texturePrompt, polycount: run.polycount }),
        });
        const body = (await res.json().catch(() => ({}))) as { request?: RequestItem; error?: string };
        if (!res.ok || !body.request) {
          showToast(body.error ?? tr("meshy.failedShort"));
          return;
        }
        const asset = body.request.asset;
        setUserItems((prev) => prev.map((i) => (i.id === selected.id ? { ...i, asset } : i)));
        showToast(tr("meshy.started", { action: tr(`meshy.kind.${run.kind}`) }));
        setMeshyConfirm(null);
      } catch {
        showToast(tr("toast.connection"));
      } finally {
        setMeshyBusy(false);
      }
    },
    [selected, editor, showToast, tr],
  );
  const meshyAllowed = Boolean(meshy.available && selected && canSaveOnline(selected));

  const capture = useCallback(async () => {
    const blob = await viewerHandle.current?.capturePng();
    if (blob && selected?.design) downloadBlob(blob, `${fileBaseName(selected.design)}.png`);
    else showToast(tr("viewer.failed", { label: "Capture" }));
  }, [selected?.design, showToast, tr]);
  const canVideo = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";
  const recordVideo = useCallback(
    async (seconds: number) => {
      const blob = await viewerHandle.current?.recordTurntable?.(seconds);
      if (blob && selected?.design) downloadBlob(blob, `${fileBaseName(selected.design)}-360.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
      else showToast(tr("render.videoFailed"));
    },
    [selected?.design, showToast, tr],
  );

  /* ---------------- Création d'une demande ---------------- */

  const askQuestions = useCallback(async (prompt: string, image: ImagePayload | null): Promise<ClarifyQuestion[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch("/api/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, hasImage: Boolean(image), image: image ? { mediaType: image.mediaType, data: image.data } : null }),
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { needed?: boolean; questions?: ClarifyQuestion[] };
      return body.needed && Array.isArray(body.questions) ? body.questions.slice(0, 3) : [];
    } catch {
      return []; // jamais bloquant : la demande part telle quelle
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const create = useCallback(
    async (prompt: string, image: ImagePayload | null, variantOf?: { variant: VariantId; base: Design; intensity?: VariantIntensity }) => {
      const tempId = `${TEMP_PREFIX}${Date.now()}`;
      const placeholder: RequestItem = {
        id: tempId,
        prompt,
        status: "processing",
        title: variantOf ? tr("studio.newVersion", { label: tr(`variant.${variantOf.variant}`).toLowerCase() }) : null,
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
        stream: { stage: variantOf ? "thinking" : "checking", done: [] },
      };
      const previousId = selectedId;
      if (!variantOf) savePending({ prompt, image });
      setUserItems((prev) => [placeholder, ...prev]);
      setSelectedId(tempId);
      setTab("overview");
      setPropsTab("analysis");

      try {
        // 1. Assistant de questions (uniquement si la demande est floue).
        let answers: Answer[] = [];
        const questions = features.newRequests && !variantOf ? await askQuestions(prompt, image) : [];
        if (questions.length) {
          const chosen = await new Promise<Answer[] | null>((resolve) => setClarify({ prompt, questions, resolve }));
          setClarify(null);
          if (chosen === null) {
            // « Modifier ma demande » : on remet le texte dans la barre.
            setUserItems((prev) => prev.filter((i) => i.id !== tempId));
            setSelectedId(previousId);
            savePending(null);
            setRestore({ prompt, image });
            return;
          }
          answers = chosen;
        }
        patchItem(tempId, { stream: { stage: "thinking", done: [] } });

        // 2. Génération, diffusée en continu (l'analyse s'écrit à l'écran pendant que l'IA travaille).
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
          body: JSON.stringify({
            prompt,
            answers,
            image: image ? { mediaType: image.mediaType, data: image.data } : null,
            ...(variantOf ? { variant: variantOf.variant, base: variantOf.base, intensity: variantOf.intensity } : {}),
          }),
        });
        type Body = { request?: RequestItem; raw?: string; error?: string; code?: string; cached?: boolean; credits?: CreditsSnapshot | null };
        let status = res.status;
        let body: Body = {};
        if (res.headers.get("content-type")?.includes("application/x-ndjson") && res.body) {
          const final = await readEventStream(res.body, (event) => {
            if (event.t === "progress" && event.progress) {
              patchItem(tempId, { stream: event.progress, title: event.progress.title ?? null });
            }
          });
          if (!final) throw new Error("flux interrompu");
          status = final.status ?? 500;
          body = (final.body ?? {}) as Body;
        } else {
          body = (await res.json().catch(() => ({}))) as Body;
        }

        // Solde de crédits mis à jour dans l'en-tête.
        if (body.credits) window.dispatchEvent(new CustomEvent(CREDITS_EVENT, { detail: body.credits }));
        if (status < 200 || status >= 300 || !body.request) {
          setUserItems((prev) => prev.filter((i) => i.id !== tempId));
          setSelectedId(previousId);
          savePending(null);
          if (status === 401 || body.code === "guest_quota" || body.code === "guest_unavailable") {
            setRestore({ prompt, image });
            setAuthPrompt(body.error ?? tr("auth.prompt.default"));
            return;
          }
          if (status === 504) {
            showToast(tr("toast.slow"));
            void refreshFromDb();
            return;
          }
          if (!variantOf) setRestore({ prompt, image });
          showToast(body.error ?? tr("toast.failed"));
          return;
        }
        savePending(null);
        const item = body.request;
        const reveal = (id: string) => {
          setRevealId(id);
          if (revealTimer.current) clearTimeout(revealTimer.current);
          revealTimer.current = setTimeout(() => setRevealId(null), 4000);
        };
        if (item.guest) {
          // Essai invité : affiché et gardé dans ce navigateur jusqu'à l'inscription.
          setUserItems((prev) => prev.filter((i) => i.id !== tempId));
          setGuestItems((prev) => {
            const next = [item, ...prev].slice(0, 5);
            saveGuestItems(next);
            return next;
          });
          setSelectedId(item.id);
          reveal(item.id);
          if (item.status === "ready") {
            setTimeout(
              () => setAuthPrompt(tr("auth.prompt.ready")),
              2500,
            );
          }
          return;
        }
        setUserItems((prev) => prev.map((i) => (i.id === tempId ? item : i)));
        setSelectedId((current) => (current === tempId ? item.id : current));
        if (body.raw) setRawById((prev) => ({ ...prev, [item.id]: body.raw! }));
        reveal(item.id);
        showToast(
          item.status === "ready"
            ? body.cached
              ? tr("toast.instant", { title: item.title ?? "" })
              : variantOf
                ? tr("toast.versionReady", { title: item.title ?? tr(`variant.${variantOf.variant}`) })
                : tr("toast.ready", { title: item.title ?? "" })
            : item.error ?? tr("notif.failed"),
        );
      } catch {
        setClarify(null);
        setUserItems((prev) =>
          prev.map((i) => (i.id === tempId ? { ...i, status: "error", error: tr("toast.connection"), stream: null } : i)),
        );
        void refreshFromDb();
      }
    },
    [selectedId, features.newRequests, askQuestions, patchItem, showToast, refreshFromDb, tr],
  );

  /** « Plus petit », « Plus solide »… : nouvelle version de la conception affichée (l'ancienne est conservée). */
  const adjust = useCallback(
    (variant: VariantId, intensity?: VariantIntensity) => {
      if (!selected?.design || busy) return;
      void create(selected.prompt, null, { variant, base: selected.design, intensity });
    },
    [selected, busy, create],
  );

  const openCompare = useCallback(() => {
    const ready = items.filter((i) => i.design && i.status === "ready");
    if (ready.length < 2) return;
    const a = selected && ready.some((i) => i.id === selected.id) ? selected : ready[0];
    // Par défaut : une autre version du même projet (même demande), sinon la conception voisine.
    const sibling =
      ready.find((i) => i.id !== a.id && i.prompt === a.prompt) ?? ready[Math.min(ready.indexOf(a) + 1, ready.length - 1)] ?? ready[0];
    setCompare({ a: a.id, b: sibling.id === a.id ? ready.find((i) => i.id !== a.id)!.id : sibling.id });
  }, [items, selected]);
  const canCompare = items.filter((i) => i.design && i.status === "ready").length >= 2;

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
      showToast(tr("toast.deleted"));
    },
    [demoMode, guestItems, showToast, tr],
  );

  const toggleFavorite = useCallback(
    async (item: RequestItem) => {
      const supabase = getBrowserSupabase();
      if (!supabase || !viewer || item.sample || item.guest) return;
      patchItem(item.id, { isFavorite: !item.isFavorite });
      const { error } = await supabase.from("design_requests").update({ is_favorite: !item.isFavorite }).eq("id", item.id);
      if (error) {
        patchItem(item.id, { isFavorite: item.isFavorite });
        showToast(tr("toast.updateFailed"));
      }
    },
    [viewer, patchItem, showToast, tr],
  );

  const toggleFavoriteMaterial = useCallback(
    async (name: string) => {
      const supabase = getBrowserSupabase();
      if (!supabase || !viewer) {
        setAuthPrompt(tr("auth.prompt.materials"));
        return;
      }
      const next = favoriteMaterials.includes(name)
        ? favoriteMaterials.filter((m) => m !== name)
        : [...favoriteMaterials, name].slice(-50);
      setFavoriteMaterials(next);
      const { error } = await supabase.from("profiles").update({ favorite_materials: next }).eq("id", viewer.id);
      if (error) {
        setFavoriteMaterials(favoriteMaterials);
        showToast(tr("toast.saveFailed"));
      }
    },
    [viewer, favoriteMaterials, showToast, tr],
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

  /* ---------------- Raccourcis clavier (Mac) ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (jsonOpen || authPrompt || clarify || compare || shareFor) return;
      const target = e.target as HTMLElement | null;
      const typing = Boolean(target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable));
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "s") {
        e.preventDefault();
        editor.flush();
        return;
      }
      if (typing || tab !== "overview") return;
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        editor.redo();
        return;
      }
      if (mod && k === "d") {
        e.preventDefault();
        if (editable && selection) runOp({ type: "duplicate" });
        return;
      }
      if (mod && k === "g") {
        e.preventDefault();
        if (editable && selection) runOp({ type: e.shiftKey ? "ungroup" : "group" });
        return;
      }
      if (mod || e.altKey) return;
      if ((k === "delete" || k === "backspace") && selection && editable) {
        e.preventDefault();
        runOp({ type: "delete" });
        return;
      }
      if (k === "escape") {
        setAddOpen(false);
        return selectPart(null);
      }
      if (k === "u") return setTool((x) => (x === "measure" ? "select" : "measure"));
      if (k === "l" && selection && editable) return runOp({ type: "lock", locked: !selectedPart?.locked });
      if (k === "f") return frame();
      if (k === "v" || k === "q") return setTool("select");
      if (k === "w") return setTool("move");
      if (k === "e") return setTool("rotate");
      if (k === "r") return setTool("scale");
      if (k === "g") return setSettings((s) => ({ ...s, showGrid: !s.showGrid }));
      if (k === "m") return setShowRuler((v) => !v);
      if (k === "h" && selection) return toggleHidden(selection);
      if (k === "arrowleft" && !selection) step(-1);
      if (k === "arrowright" && !selection) step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jsonOpen, authPrompt, clarify, compare, shareFor, tab, editor, editable, selection, selectedPart, runOp, selectPart, frame, toggleHidden, step]);

  const reveal = revealId !== null && revealId === selected?.id;
  const focusPrompt = () => window.dispatchEvent(new Event("forma3d:focus-prompt"));
  const leftPanel = (
    <div className="flex flex-col gap-2.5">
      <LeftColumn
        only={["card", "notice", "saved"]}
        hideTitle
        item={selected}
        items={items}
        onSelect={select}
        onNew={focusPrompt}
        onToggleFavorite={toggleFavorite}
        onSignupPrompt={() => setAuthPrompt(tr("auth.prompt.save"))}
        demoMode={demoMode}
        signedIn={Boolean(viewer)}
        onShare={viewer && selected ? () => setShareFor(selected.id) : undefined}
      />
      <PartsTree
        design={selected?.design ?? null}
        selection={selection}
        selectedIds={selectedIds}
        onSelect={(id, additive) => selectPart(id, additive)}
        hiddenIds={hiddenIds}
        onToggleHidden={toggleHidden}
        onRename={renamePart}
        onDuplicate={(id) => (selectedIds.length > 1 ? runOp({ type: "duplicate" }) : duplicateSelectedPart(id))}
        onDelete={(id) => (selectedIds.length > 1 ? runOp({ type: "delete" }) : deleteSelectedPart(id))}
        editable={editable}
      />
      <LeftColumn only={["recent"]} item={selected} items={items} onSelect={select} onNew={focusPrompt} onToggleFavorite={toggleFavorite} onSignupPrompt={() => {}} demoMode={demoMode} signedIn={Boolean(viewer)} />
    </div>
  );
  const rightCommon = {
    design: selected?.design ?? null,
    settings,
    onSettings: patchSettings,
    unit: prefs.unit,
    favoriteMaterials,
    onToggleFavoriteMaterial: toggleFavoriteMaterial,
    reveal,
  };
  const rightPanel = (
    <PropertiesPanel tab={propsTab} onTab={setPropsTab}>
      {propsTab === "object" && (
        <>
          {editable && <AiEditBox partName={selectedPart?.name ?? null} cost={viewer && !demoMode ? credits?.costs?.ai_edit ?? null : null} busy={aiBusy} onSubmit={aiEdit} />}
          {selectedPart ? (
            <>
              <PartInspector part={selectedPart} onPatch={patchPart} tool={tool} editable={editable && !selectedPart.locked} />
              <OperationsPanel
                key={selectedPart.id}
                part={selectedPart}
                count={selectedIds.length}
                grouped={Boolean(selectedPart.group)}
                editable={editable}
                snap={snap}
                onSnap={setSnap}
                uniform={uniformScale}
                onUniform={setUniformScale}
                onOp={runOp}
              />
            </>
          ) : (
            <>
              {selected && <ProjectSummary item={selected} />}
              {selected?.design && <GuidedSliders disabled={busy || !editable} onRun={(variant, intensity) => adjust(variant, intensity)} />}
              <RightColumn {...rightCommon} only={["modes"]} />
            </>
          )}
        </>
      )}
      {propsTab === "material" && (
        <>
          {selectedPart && <PartMaterial part={selectedPart} onPatch={patchPart} editable={editable} />}
          {selected?.design && <MaterialLibrary part={selectedPart} editable={editable} onApply={applyFinish} />}
          <RenderPanel settings={settings} onSettings={patchSettings} onCapture={capture} onVideo={recordVideo} canVideo={canVideo} />
          {meshyAllowed && (
            <MeshyModelPanel
              status={meshy}
              asset={selected?.asset ?? null}
              busy={meshyBusy}
              onRun={setMeshyConfirm}
              showMesh={showMesh}
              onShowMesh={setShowMesh}
              meshKey={meshKey}
              onMeshKey={setMeshKey}
            />
          )}
          <RightColumn {...rightCommon} only={["modes", "materials"]} />
        </>
      )}
      {propsTab === "dimensions" && (
        <>
          {selected?.design && <MeasuredDimensions design={selected.design} unit={prefs.unit} selection={selection} onSelect={(id) => selectPart(id)} />}
          {selected?.design && (
            <RealScaleBox
              longest={Math.max(...Object.values(designBounds(selected.design).size))}
              editable={editable}
              onApply={(mm) => editor.edit((d) => scaleToSize(d, mm))}
            />
          )}
          <RightColumn {...rightCommon} only={["dimensions"]} />
        </>
      )}
      {propsTab === "analysis" && (
        <LeftColumn
          only={["analysis", "adjust"]}
          item={selected}
          items={items}
          onSelect={select}
          onNew={focusPrompt}
          onToggleFavorite={toggleFavorite}
          onSignupPrompt={() => setAuthPrompt(tr("auth.prompt.save"))}
          demoMode={demoMode}
          signedIn={Boolean(viewer)}
          reveal={reveal}
          busy={busy}
          onAdjust={adjust}
          onCompare={openCompare}
          canCompare={canCompare}
        />
      )}
      {propsTab === "fabrication" && (
        <>
          <button type="button" onClick={() => setTab("fabrication")} className="btn-neon w-full !rounded-xl !py-2.5 !text-xs">
            <IconSteps size={14} /> {tr("editor.openWorkshop")}
          </button>
          {meshyAllowed && <MeshyPrintPanel status={meshy} asset={selected?.asset ?? null} busy={meshyBusy} onRun={setMeshyConfirm} />}
          <RightColumn {...rightCommon} only={["steps", "cost", "recommendations"]} />
        </>
      )}
    </PropertiesPanel>
  );

  return (
    <>
      <EditorTopBar
        siteName={siteName}
        logoDataUrl={logoDataUrl}
        item={selected}
        items={items}
        onSelect={select}
        tab={tab}
        onTab={setTab}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        saveState={editor.saveState}
        onSave={() => editor.flush()}
        onRename={(title) => editor.edit((d) => renameDesign(d, title))}
        editable={editable}
        features={features}
        viewerHandle={viewerHandle}
        onToast={showToast}
        viewer={viewer}
        demoMode={demoMode}
        credits={credits}
      />

      {/* Zone de travail */}
      <div className="relative flex min-h-0 flex-1">
        {tab === "overview" ? (
          <>
            <Toolbar
              tool={tool}
              onTool={setTool}
              layout={layout}
              onLayout={chooseLayout}
              showGrid={settings.showGrid}
              onGrid={() => patchSettings({ showGrid: !settings.showGrid })}
              showAxes={showAxes}
              onAxes={() => setShowAxes((v) => !v)}
              showRuler={showRuler}
              onRuler={() => setShowRuler((v) => !v)}
              onFrame={frame}
              onToggleParts={toggleParts}
              onToggleProps={toggleProps}
              partsOpen={partsOpen}
              propsOpen={propsOpen}
              onAdd={() => setAddOpen((o) => !o)}
              addOpen={addOpen}
              canAdd={editable}
            />
            <AddMenu open={addOpen} onClose={() => setAddOpen(false)} onShape={addNewShape} onText={() => setDialog("text")} onDraw={() => setDialog("draw")} />
            <DockPanel
              side="left"
              docked={wide}
              open={partsOpen}
              onClose={() => setPartsOpen(false)}
              title={tr("editor.parts")}
              storageKey="forma3d:panel-left"
              defaultWidth={272}
              closeLabel={tr("menu.close")}
              resizeLabel={tr("editor.resize")}
            >
              {leftPanel}
            </DockPanel>
            <div className="min-h-0 min-w-0 flex-1 pe-2 sm:pe-3 xl:px-0">
              <Viewports layout={layout} design={selected?.design ?? null} selection={selection} onSelect={(id) => selectPart(id, false, true)} hiddenIds={hiddenIds} showGrid={settings.showGrid} showAxes={showAxes}>
                <ViewerPanel
                  item={selected}
                  settings={settings}
                  onSettings={patchSettings}
                  features={features}
                  onNew={focusPrompt}
                  onShowJson={() => setJsonOpen(true)}
                  onToast={showToast}
                  selection={selection}
                  onSelection={(id, additive) => selectPart(id, additive, true)}
                  selectedIds={selectedIds}
                  transformMode={editable && tool !== "select" && tool !== "measure" ? (tool === "move" ? "translate" : tool) : null}
                  snap={snap.on ? { translate: snap.step, rotate: snap.angle, scale: 0.05 } : null}
                  uniformScale={uniformScale}
                  onTransform={onTransform}
                  measure={tool === "measure"}
                  meshControl={{ show: showMesh, key: meshKey, onShow: setShowMesh }}
                  handleRef={viewerHandle}
                  hiddenIds={hiddenIds}
                  showAxes={showAxes}
                  showRuler={showRuler}
                  editor
                  className="relative h-full min-h-[240px] overflow-hidden rounded-[20px] ring-1 ring-fg/10"
                />
              </Viewports>
            </div>
            <DockPanel
              side="right"
              docked={wide}
              open={propsOpen}
              onClose={() => setPropsOpen(false)}
              title={tr("editor.properties")}
              storageKey="forma3d:panel-right"
              defaultWidth={344}
              closeLabel={tr("menu.close")}
              resizeLabel={tr("editor.resize")}
            >
              {rightPanel}
            </DockPanel>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 sm:px-4">
            {tab === "fabrication" && (
              <FabricationTab
                item={selected}
                items={items}
                prefs={prefs}
                onPrefs={updatePrefs}
                features={features}
                busy={busy}
                onAdjust={adjust}
                onCompare={openCompare}
                onSelect={(id) => setSelectedId(id)}
                onToast={showToast}
              />
            )}
            {tab === "history" && (
              <HistoryTab items={items} selectedId={selected?.id ?? null} onOpen={select} onDelete={remove} canDelete={demoMode || Boolean(viewer) || guestItems.length > 0} />
            )}
            {tab === "settings" && <SettingsTab prefs={prefs} onPrefs={onPrefs} viewer={viewer} demoMode={demoMode} />}
          </div>
        )}
      </div>

      <BottomBar item={selected} items={items} onSelect={select} onCompare={canCompare ? openCompare : undefined}>
        <PromptBar onSubmit={create} busy={busy} allowImage={features.imageUpload} restore={restore} placement="above" />
      </BottomBar>

      {dialog === "text" && (
        <TextDialog
          supportName={selectedPart?.name ?? null}
          supportIsBox={selectedPart?.shape === "box"}
          onClose={() => setDialog(null)}
          onSubmit={({ glyphs, mode, depth, text }) =>
            runResult((d) => addText(d, glyphs, { mode, depth, supportId: selection, name: text, color: "#ffffff" }))
              ? tr("text.failedFit")
              : null
          }
        />
      )}
      {dialog === "draw" && (
        <DrawDialog
          onClose={() => setDialog(null)}
          onSubmit={(path, thickness) => (runResult((d) => freeformPart(d, path, thickness, tr("add.drawName"))) ? tr("draw.failed") : null)}
        />
      )}
      {meshyConfirm && meshy.costs && (
        <CostConfirm
          label={tr(`meshy.kind.${meshyConfirm.kind}`)}
          cost={meshy.costs[meshyConfirm.kind] ?? 0}
          balance={meshy.unlimited ? null : meshy.balance}
          onClose={() => setMeshyConfirm(null)}
          onConfirm={() => runMeshy(meshyConfirm)}
        />
      )}

      <JsonDrawer item={jsonOpen ? selected : null} localRaw={selected ? rawById[selected.id] ?? null : null} onClose={() => setJsonOpen(false)} />
      <AuthPrompt message={authPrompt} onClose={() => setAuthPrompt(null)} />
      {shareFor && <ShareDialog requestId={shareFor} onClose={() => setShareFor(null)} onToast={showToast} />}
      {compare && (
        <CompareDialog items={items} initialA={compare.a} initialB={compare.b} prefs={prefs} onClose={() => setCompare(null)} />
      )}
      {clarify && (
        <ClarifyPanel
          prompt={clarify.prompt}
          questions={clarify.questions}
          onSubmit={(answers) => clarify.resolve(answers)}
          onCancel={() => clarify.resolve(null)}
        />
      )}

      <Portal>
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <AnimatePresence>
            {toast && (
              <motion.div
                role="status"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="pointer-events-auto max-w-full rounded-full bg-night px-5 py-3 text-sm font-medium text-white shadow-float"
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
