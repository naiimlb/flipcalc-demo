"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { REQUEST_COLUMNS, toRequestItem, type RequestItem } from "@/lib/requests";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { downloadBlob, exportStl, fileBaseName } from "@/lib/three/export";
import {
  IconCopy,
  IconCube,
  IconDownload,
  IconExternal,
  IconFolder,
  IconHeart,
  IconPencil,
  IconPlus,
  IconSearch,
  IconStar,
  IconTrash,
  IconX,
  Spinner,
} from "../icons";
import { Portal } from "../Portal";
import { formatDateTime } from "../studio/format";
import type { StudioViewer } from "../studio/types";
import { StatusChip } from "../studio/ui";

export interface Folder {
  id: string;
  name: string;
  created_at: string;
}

type Tab = "demandes" | "modeles" | "favoris" | "matieres" | "parametres" | "donnees";
const TABS: { id: Tab; label: string }[] = [
  { id: "demandes", label: "Mes demandes" },
  { id: "modeles", label: "Mes modèles 3D" },
  { id: "favoris", label: "Favoris" },
  { id: "matieres", label: "Matières préférées" },
  { id: "parametres", label: "Paramètres" },
  { id: "donnees", label: "Mes données" },
];

/** Filtre de dossier : tous, sans dossier, ou un dossier précis. */
type FolderFilter = "all" | "none" | string;

export function EspaceClient({
  viewer,
  language,
  initialFolders,
  initialItems,
  passwordChanged,
}: {
  viewer: StudioViewer;
  language: "fr" | "en" | "ar";
  initialFolders: Folder[];
  initialItems: RequestItem[];
  passwordChanged: boolean;
}) {
  const [tab, setTab] = useState<Tab>("demandes");
  const [items, setItems] = useState(initialItems);
  const [folders, setFolders] = useState(initialFolders);
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(passwordChanged ? "Mot de passe mis à jour." : null);
  const supabase = getBrowserSupabase();

  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast((t) => (t === message ? null : t)), 4000);
  };

  const patch = (id: string, values: Partial<RequestItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...values } : i)));

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr-FR");
    return items.filter(
      (i) =>
        (tab !== "favoris" || i.isFavorite) &&
        (tab !== "modeles" || i.modelPath) &&
        (folderFilter === "all" || (folderFilter === "none" ? !i.folderId : i.folderId === folderFilter)) &&
        (!q || `${i.title ?? ""} ${i.prompt}`.toLocaleLowerCase("fr-FR").includes(q)),
    );
  }, [items, tab, folderFilter, query]);

  /* ----------------------------- Actions ----------------------------- */

  async function update(id: string, values: Record<string, unknown>, local: Partial<RequestItem>, message?: string) {
    if (!supabase) return;
    const before = items.find((i) => i.id === id);
    patch(id, local);
    const { error } = await supabase.from("design_requests").update(values).eq("id", id);
    if (error) {
      if (before) patch(id, before);
      notify("Mise à jour impossible.");
    } else if (message) notify(message);
  }

  async function duplicate(item: RequestItem) {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("duplicate_design_request", { p_id: item.id }).select(REQUEST_COLUMNS).single();
    if (error || !data) return notify("Duplication impossible.");
    setItems((prev) => [toRequestItem(data as Parameters<typeof toRequestItem>[0]), ...prev]);
    notify("Demande dupliquée.");
  }

  async function remove(item: RequestItem) {
    if (!supabase || !confirm(`Supprimer « ${item.title ?? item.prompt} » ? Cette action est définitive.`)) return;
    if (item.modelPath) await supabase.storage.from("models").remove([item.modelPath]);
    const { error } = await supabase.from("design_requests").delete().eq("id", item.id);
    if (error) return notify("Suppression impossible.");
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    notify("Demande supprimée.");
  }

  async function downloadGlb(item: RequestItem) {
    if (!supabase || !item.modelPath) return;
    const { data, error } = await supabase.storage.from("models").download(item.modelPath);
    if (error || !data) return notify("Téléchargement impossible.");
    downloadBlob(data, `${item.design ? fileBaseName(item.design) : "forma3d"}.glb`);
  }

  async function createFolder(name: string) {
    if (!supabase) return;
    const { data, error } = await supabase.from("folders").insert({ name }).select("id, name, created_at").single();
    if (error || !data) return notify("Création du dossier impossible.");
    setFolders((prev) => [...prev, data as Folder]);
    setFolderFilter((data as Folder).id);
  }

  async function renameFolder(folder: Folder) {
    const name = prompt("Nouveau nom du dossier", folder.name)?.trim();
    if (!supabase || !name || name === folder.name) return;
    const { error } = await supabase.from("folders").update({ name: name.slice(0, 80) }).eq("id", folder.id);
    if (error) return notify("Renommage impossible.");
    setFolders((prev) => prev.map((f) => (f.id === folder.id ? { ...f, name: name.slice(0, 80) } : f)));
  }

  async function deleteFolder(folder: Folder) {
    if (!supabase || !confirm(`Supprimer le dossier « ${folder.name} » ? Les demandes qu'il contient sont conservées.`)) return;
    const { error } = await supabase.from("folders").delete().eq("id", folder.id);
    if (error) return notify("Suppression impossible.");
    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setItems((prev) => prev.map((i) => (i.folderId === folder.id ? { ...i, folderId: null } : i)));
    setFolderFilter("all");
  }

  const showFolders = tab === "demandes" || tab === "modeles" || tab === "favoris";

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4 pt-2">
        <div className="text-white">
          <h2 className="text-2xl font-semibold tracking-tight">Mon espace</h2>
          <p className="text-sm text-white/80">
            {viewer.displayName ?? viewer.email} · {items.length} demande{items.length > 1 ? "s" : ""} · sauvegardé dans votre compte
          </p>
        </div>
        <Link href="/" className="btn bg-surface !text-xs text-brand-accent shadow-soft">
          <IconPlus size={14} /> Nouvelle demande
        </Link>
      </div>

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-full bg-surface/90 p-1 shadow-soft scrollbar-none" aria-label="Sections de Mon espace">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${tab === t.id ? "bg-brand-accent text-white" : "text-ink-soft hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={`grid gap-4 ${showFolders ? "lg:grid-cols-[240px_minmax(0,1fr)]" : ""}`}>
        {showFolders && (
          <FolderSidebar
            folders={folders}
            items={items}
            filter={folderFilter}
            onFilter={setFolderFilter}
            onCreate={createFolder}
            onRename={renameFolder}
            onDelete={deleteFolder}
          />
        )}

        <section className="min-w-0 rounded-[24px] bg-paper p-3 shadow-card sm:p-4">
          {showFolders && (
            <div className="mb-3 flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-2">
              <IconSearch size={14} className="text-ink-mute" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher dans mes demandes…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-mute"
              />
            </div>
          )}

          {(tab === "demandes" || tab === "favoris") && (
            <ul className="space-y-2">
              {filtered.length === 0 && (
                <li className="py-10 text-center text-sm text-ink-mute">
                  {tab === "favoris" ? "Aucun favori : cliquez sur l'étoile d'une demande." : "Aucune demande ici pour l'instant."}
                </li>
              )}
              {filtered.map((item) => (
                <RequestRow
                  key={item.id}
                  item={item}
                  folders={folders}
                  onRename={(title) => update(item.id, { title }, { title }, "Demande renommée.")}
                  onFolder={(folderId) => update(item.id, { folder_id: folderId }, { folderId }, "Demande classée.")}
                  onFavorite={() => update(item.id, { is_favorite: !item.isFavorite }, { isFavorite: !item.isFavorite })}
                  onDuplicate={() => duplicate(item)}
                  onDelete={() => remove(item)}
                />
              ))}
            </ul>
          )}

          {tab === "modeles" && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-ink-mute">
                  Les modèles 3D sont sauvegardés automatiquement quand vous ouvrez une conception prête.
                </p>
              )}
              {filtered.map((item) => (
                <article key={item.id} className="panel flex flex-col p-3">
                  <div
                    className="flex h-28 items-center justify-center rounded-xl text-white"
                    style={{ background: `linear-gradient(135deg, ${item.design?.model.parts[0]?.color ?? "#5b6ee1"}, #7b5ce6 60%, #ff5fb5)` }}
                  >
                    <IconCube size={38} strokeWidth={1.4} />
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold">{item.title ?? item.prompt}</p>
                  <p className="text-[11px] text-ink-mute">
                    {formatDateTime(item.createdAt)} · {item.design?.model.parts.length ?? 0} pièces
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Link href={`/studio?p=${item.id}`} className="btn-accent !px-3 !py-1.5 !text-xs">
                      <IconExternal size={13} /> Ouvrir
                    </Link>
                    <button type="button" onClick={() => downloadGlb(item)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                      <IconDownload size={13} /> GLB
                    </button>
                    {item.design && (
                      <button
                        type="button"
                        onClick={() =>
                          item.design &&
                          downloadBlob(new Blob([exportStl(item.design)], { type: "model/stl" }), `${fileBaseName(item.design)}.stl`)
                        }
                        className="btn-ghost !px-3 !py-1.5 !text-xs"
                      >
                        <IconDownload size={13} /> STL
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {tab === "matieres" && <MaterialsTab viewer={viewer} items={items} notify={notify} />}
          {tab === "parametres" && <SettingsPanel viewer={viewer} language={language} notify={notify} />}
          {tab === "donnees" && <DataPanel />}
        </section>
      </div>

      <Portal>
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <AnimatePresence>
            {toast && (
              <motion.div
                role="status"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="pointer-events-auto rounded-full bg-night px-5 py-3 text-sm font-medium text-white shadow-float"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Portal>
    </div>
  );
}

/* ----------------------------- Dossiers ----------------------------- */

function FolderSidebar({
  folders,
  items,
  filter,
  onFilter,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: Folder[];
  items: RequestItem[];
  filter: FolderFilter;
  onFilter(f: FolderFilter): void;
  onCreate(name: string): void;
  onRename(f: Folder): void;
  onDelete(f: Folder): void;
}) {
  const [name, setName] = useState("");
  const count = (f: FolderFilter) =>
    f === "all" ? items.length : f === "none" ? items.filter((i) => !i.folderId).length : items.filter((i) => i.folderId === f).length;
  const entry = (id: FolderFilter, label: string, folder?: Folder) => (
    <li key={id} className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onFilter(id)}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
          filter === id ? "bg-night text-white" : "text-ink-soft hover:bg-paper"
        }`}
      >
        <IconFolder size={15} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-xs opacity-70">{count(id)}</span>
      </button>
      {folder && (
        <span className="flex opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
          <button type="button" onClick={() => onRename(folder)} className="rounded-lg p-1.5 text-ink-mute hover:text-ink" aria-label={`Renommer ${folder.name}`}>
            <IconPencil size={13} />
          </button>
          <button type="button" onClick={() => onDelete(folder)} className="rounded-lg p-1.5 text-ink-mute hover:text-rose-600" aria-label={`Supprimer ${folder.name}`}>
            <IconTrash size={13} />
          </button>
        </span>
      )}
    </li>
  );
  return (
    <aside className="rounded-[24px] bg-surface p-3 shadow-card lg:self-start">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">Dossiers (projets)</p>
      <ul className="space-y-0.5">
        {entry("all", "Toutes les demandes")}
        {entry("none", "Sans dossier")}
        {folders.map((f) => entry(f.id, f.name, f))}
      </ul>
      <form
        className="mt-3 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const value = name.trim();
          if (value) {
            onCreate(value.slice(0, 80));
            setName("");
          }
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Nouveau dossier" className="input !py-2" />
        <button type="submit" className="icon-btn !h-10 !w-10 shrink-0" aria-label="Créer le dossier">
          <IconPlus size={15} />
        </button>
      </form>
    </aside>
  );
}

/* ----------------------------- Une demande ----------------------------- */

function RequestRow({
  item,
  folders,
  onRename,
  onFolder,
  onFavorite,
  onDuplicate,
  onDelete,
}: {
  item: RequestItem;
  folders: Folder[];
  onRename(title: string): void;
  onFolder(folderId: string | null): void;
  onFavorite(): void;
  onDuplicate(): void;
  onDelete(): void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title ?? "");
  const input = useRef<HTMLInputElement>(null);
  const save = () => {
    setEditing(false);
    const value = title.trim().slice(0, 200);
    if (value && value !== item.title) onRename(value);
    else setTitle(item.title ?? "");
  };

  return (
    <li className="panel flex flex-wrap items-center gap-3 p-3">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ background: `linear-gradient(135deg, ${item.design?.model.parts[0]?.color ?? "#5b6ee1"}, #7b5ce6)` }}
      >
        <IconCube size={19} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        {editing ? (
          <input
            ref={input}
            autoFocus
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setTitle(item.title ?? "");
                setEditing(false);
              }
            }}
            className="input !py-1.5 !text-sm"
            aria-label="Nouveau titre"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="group flex max-w-full items-center gap-1.5 text-left" title="Renommer">
            <span className="truncate text-sm font-semibold">{item.title ?? item.prompt}</span>
            <IconPencil size={12} className="shrink-0 text-ink-mute opacity-0 group-hover:opacity-100" />
          </button>
        )}
        <p className="truncate text-xs text-ink-mute">{item.prompt}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-mute">
          {formatDateTime(item.createdAt)}
          {item.source === "duplicate" && <span className="chip !py-0.5 bg-paper text-ink-soft">copie</span>}
          {item.source === "import" && <span className="chip !py-0.5 bg-paper text-ink-soft">essai importé</span>}
          {item.modelPath && <span className="chip !py-0.5 bg-emerald-50 text-emerald-700">modèle 3D sauvegardé</span>}
        </p>
      </div>
      <StatusChip status={item.status} />
      <select
        value={item.folderId ?? ""}
        onChange={(e) => onFolder(e.target.value || null)}
        className="input !w-auto !rounded-full !py-1.5 !text-xs"
        aria-label="Dossier"
      >
        <option value="">Sans dossier</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onFavorite}
          aria-pressed={item.isFavorite}
          aria-label={item.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className={`icon-btn ${item.isFavorite ? "!text-amber-500" : ""}`}
        >
          <IconStar size={14} fill={item.isFavorite ? "currentColor" : "none"} />
        </button>
        <Link href={`/studio?p=${item.id}`} className="icon-btn" aria-label="Ouvrir" title="Ouvrir">
          <IconExternal size={14} />
        </Link>
        {item.status === "ready" && (
          <button type="button" onClick={onDuplicate} className="icon-btn" aria-label="Dupliquer" title="Dupliquer">
            <IconCopy size={14} />
          </button>
        )}
        <button type="button" onClick={onDelete} className="icon-btn hover:!border-rose-200 hover:!text-rose-600" aria-label="Supprimer" title="Supprimer">
          <IconTrash size={14} />
        </button>
      </div>
    </li>
  );
}

/* ----------------------------- Matières préférées ----------------------------- */

function MaterialsTab({ viewer, items, notify }: { viewer: StudioViewer; items: RequestItem[]; notify(m: string): void }) {
  const [favorites, setFavorites] = useState(viewer.favoriteMaterials);
  const supabase = getBrowserSupabase();
  const suggestions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) for (const m of item.design?.materiaux_conseilles ?? []) counts.set(m.nom, (counts.get(m.nom) ?? 0) + 1);
    return [...counts.entries()].filter(([name]) => !favorites.includes(name)).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [items, favorites]);

  const save = async (next: string[]) => {
    if (!supabase) return;
    const before = favorites;
    setFavorites(next);
    const { error } = await supabase.from("profiles").update({ favorite_materials: next }).eq("id", viewer.id);
    if (error) {
      setFavorites(before);
      notify("Enregistrement impossible.");
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <IconHeart size={15} className="text-rose-500" /> Mes matières préférées
        </h3>
        <p className="mt-1 text-xs text-ink-mute">Ajoutez-en depuis le panneau « Matériaux » d&apos;une conception (cœur).</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {favorites.length === 0 && <p className="text-sm text-ink-mute">Aucune pour l&apos;instant.</p>}
          {favorites.map((name) => (
            <span key={name} className="chip bg-rose-50 !py-1.5 text-rose-700">
              {name}
              <button type="button" onClick={() => save(favorites.filter((f) => f !== name))} aria-label={`Retirer ${name}`}>
                <IconX size={11} strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="panel p-4">
        <h3 className="text-sm font-semibold">Souvent conseillées pour vos projets</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.length === 0 && <p className="text-sm text-ink-mute">Les matières conseillées par l&apos;IA apparaîtront ici.</p>}
          {suggestions.map(([name, n]) => (
            <button key={name} type="button" onClick={() => save([...favorites, name].slice(-50))} className="chip bg-paper !py-1.5 text-ink-soft hover:text-brand-accent">
              <IconPlus size={11} strokeWidth={3} /> {name} <span className="text-ink-mute">×{n}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Paramètres ----------------------------- */

function SettingsPanel({ viewer, language, notify }: { viewer: StudioViewer; language: "fr" | "en" | "ar"; notify(m: string): void }) {
  const router = useRouter();
  const supabase = getBrowserSupabase();
  const [name, setName] = useState(viewer.displayName ?? "");
  const [lang, setLang] = useState(language);
  const [units, setUnits] = useState(viewer.units);
  const [avatar, setAvatar] = useState(viewer.avatarUrl);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const uploadAvatar = async (file: File) => {
    if (!supabase) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return notify("Photo : PNG, JPEG ou WebP.");
    // Réduction à 256 px pour rester sous la limite du bucket (1 Mo).
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.9));
    if (!blob) return notify("Photo illisible.");
    const path = `${viewer.id}/avatar.webp`;
    const { error } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/webp" });
    if (error) return notify("Envoi de la photo impossible.");
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatar(`${data.publicUrl}?v=${Date.now()}`);
  };

  const save = async () => {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim().slice(0, 80) || null, avatar_url: avatar, language: lang, units, updated_at: new Date().toISOString() })
      .eq("id", viewer.id);
    setSaving(false);
    if (error) return notify("Enregistrement impossible.");
    notify("Paramètres enregistrés.");
    router.refresh();
  };

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-4">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="Ma photo" className="h-16 w-16 rounded-full object-cover ring-2 ring-white" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-from to-brand-to text-lg font-bold text-white">
            {(viewer.displayName ?? viewer.email)[0]?.toUpperCase()}
          </span>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadAvatar(file);
          }}
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost !text-xs">
            Changer la photo
          </button>
          {avatar && (
            <button type="button" onClick={() => setAvatar(null)} className="btn !text-xs text-rose-600">
              Retirer
            </button>
          )}
        </div>
      </div>
      <div>
        <label htmlFor="name" className="label">
          Nom affiché
        </label>
        <input id="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="input" />
      </div>
      <div>
        <p className="label">Email</p>
        <p className="text-sm text-ink-soft">{viewer.email}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lang" className="label">
            Langue des conceptions
          </label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value as "fr" | "en" | "ar")} className="input">
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </div>
        <div>
          <label htmlFor="units" className="label">
            Unités
          </label>
          <select id="units" value={units} onChange={(e) => setUnits(e.target.value as StudioViewer["units"])} className="input">
            <option value="mm">Millimètres</option>
            <option value="cm">Centimètres</option>
            <option value="in">Pouces</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving} className="btn-dark">
          {saving && <Spinner />} Enregistrer
        </button>
        <Link href="/mot-de-passe-oublie" className="text-sm font-semibold text-brand-accent">
          Changer de mot de passe
        </Link>
      </div>
    </div>
  );
}

/* ----------------------------- Données ----------------------------- */

function DataPanel() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async () => {
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: confirmText }),
    }).catch(() => null);
    setDeleting(false);
    if (!res?.ok) {
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Suppression impossible.");
      return;
    }
    try {
      localStorage.clear();
    } catch {
      // ignoré
    }
    router.replace("/?compte=supprime");
    router.refresh();
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel p-5">
        <h3 className="text-sm font-semibold">Exporter mes données</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Un fichier JSON avec votre profil, vos dossiers, toutes vos demandes et conceptions, et des liens de téléchargement de vos modèles 3D
          (valables 7 jours).
        </p>
        <a href="/api/account/export" className="btn-dark mt-4 !text-xs">
          <IconDownload size={14} /> Télécharger mes données
        </a>
      </div>
      <div className="panel border-rose-200 p-5">
        <h3 className="text-sm font-semibold text-rose-600">Supprimer mon compte</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Supprime définitivement votre compte, vos demandes, dossiers, préférences, modèles 3D et photo. Cette action est irréversible.
        </p>
        <label htmlFor="confirm-delete" className="label mt-4">
          Tapez SUPPRIMER pour confirmer
        </label>
        <input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="input" autoComplete="off" />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button
          type="button"
          onClick={deleteAccount}
          disabled={confirmText !== "SUPPRIMER" || deleting}
          className="btn mt-3 bg-rose-600 !text-xs text-white hover:bg-rose-700"
        >
          {deleting && <Spinner />} Supprimer définitivement
        </button>
      </div>
    </div>
  );
}
