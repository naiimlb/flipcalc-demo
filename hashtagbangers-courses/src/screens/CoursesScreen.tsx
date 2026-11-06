import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { CategorySection } from '../components/CategorySection';
import { PrimaryButton, Segmented } from '../components/Controls';
import { IconClipboard, IconFlag, IconMore, IconPencil, IconPlus, IconX } from '../components/Icons';
import { CoursesLogo } from '../components/Logo';
import { toast } from '../components/Toast';
import type { CategoryId } from '../lib/categories';
import { haptic } from '../lib/haptics';
import { groupByCategory, missingItems, progress, storeLabel } from '../lib/lists';
import { formatDate } from '../lib/message';
import { STORES, type Item, type ShoppingList, type StoreId } from '../lib/types';
import { actions, useAppState } from '../state/store';
import { AddItemSheet, EditItemSheet } from './ItemSheets';

export function CoursesScreen({ onImport, onFinished }: { onImport: () => void; onFinished: (finishedId: string, missingId: string | null) => void }) {
  const lists = useAppState((s) => s.lists);
  const activeId = useAppState((s) => s.activeId);
  const active = lists.find((l) => l.id === activeId) ?? null;
  if (!active) return <EmptyCourses lists={lists} onImport={onImport} />;
  return <ActiveCourses key={active.id} list={active} onImport={onImport} onFinished={onFinished} />;
}

function EmptyCourses({ lists, onImport }: { lists: ShoppingList[]; onImport: () => void }) {
  const ongoing = lists.filter((l) => l.kind === 'courses' && l.status === 'en_cours');
  return (
    <div className="min-h-full">
      <header className="halftone relative overflow-hidden px-6 pt-6 pb-12 text-white">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="flex justify-center">
          <CoursesLogo size="lg" />
        </motion.div>
        <p className="mt-5 text-center text-[16px] leading-snug font-medium text-white/90">
          Colle ta liste Métro ou Salamarket,
          <br />
          elle se range toute seule par rayon.
        </p>
      </header>
      <div className="relative z-10 -mt-7 space-y-4 px-4 pb-8">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            haptic();
            onImport();
          }}
          className="flex min-h-[92px] w-full items-center gap-4 rounded-[28px] bg-ink px-6 text-left text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] dark:bg-white dark:text-ink"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-brand text-white">
            <IconClipboard size={30} />
          </span>
          <span className="flex-1">
            <span className="block font-display text-[28px] leading-none tracking-wide uppercase">Coller ma liste</span>
            <span className="mt-1.5 block text-[14px] font-medium opacity-70">Métro · Salamarket · autre</span>
          </span>
        </motion.button>

        {ongoing.length > 0 && (
          <div className="rounded-[26px] bg-white p-2 shadow-[0_10px_30px_-18px_rgba(120,0,50,0.35)] dark:bg-night-card">
            <p className="px-3 pt-2 pb-1 text-[13px] font-semibold tracking-wide text-black/50 uppercase dark:text-white/50">Reprendre</p>
            {ongoing.slice(0, 4).map((l) => {
              const p = progress(l.items);
              return (
                <button
                  key={l.id}
                  onClick={() => (haptic(), actions.openList(l.id))}
                  className="press flex min-h-16 w-full items-center gap-3 rounded-[20px] px-3 text-left active:bg-black/[0.03]"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-xl dark:bg-brand/15">🛒</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[19px] leading-[1.2] tracking-wide uppercase">
                      {storeLabel(l) || 'Courses'} · {formatDate(l.createdAt)}
                    </span>
                    <span className="block text-[13px] text-black/50 dark:text-white/50">
                      {p.done}/{p.total} pris
                    </span>
                  </span>
                  <span className="font-display text-[18px] text-brand">{Math.round(p.ratio * 100)}%</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="rounded-[26px] border-2 border-dashed border-brand/25 px-5 py-4 text-[14px] leading-relaxed text-black/60 dark:text-white/60">
          <p className="mb-1 font-marker text-[17px] text-brand">Comment ça marche</p>
          1. Copie ta liste depuis l'appli Métro ou Salamarket.
          <br />
          2. Colle-la ici : tout est rangé par rayon.
          <br />
          3. Coche en magasin, ajuste les quantités.
          <br />
          4. Termine : les manquants partent chez ton responsable.
        </div>
      </div>
    </div>
  );
}

function ActiveCourses({
  list,
  onImport,
  onFinished,
}: {
  list: ShoppingList;
  onImport: () => void;
  onFinished: (finishedId: string, missingId: string | null) => void;
}) {
  const order = useAppState((s) => s.settings.order);
  const [collapsed, setCollapsed] = useState<Set<CategoryId>>(new Set());
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [storeEdit, setStoreEdit] = useState(false);
  const fabVisible = useFabVisibility();

  const groups = useMemo(() => groupByCategory(list.items, order), [list.items, order]);
  const p = progress(list.items);
  const missingCount = missingItems(list.items).length;
  const takenCount = list.items.filter((i) => i.taken > 0).length;
  const store = storeLabel(list);

  const onToggle = useCallback((item: Item) => actions.toggleItem(list.id, item.id), [list.id]);
  const onSetTaken = useCallback((item: Item, n: number) => actions.setTaken(list.id, item.id, n), [list.id]);
  const onLongPress = useCallback((item: Item) => setEditing(item), []);
  const onDelete = useCallback(
    (item: Item) => {
      const removed = actions.deleteItem(list.id, item.id);
      if (removed) toast(`${item.name} supprimé`, { actionLabel: 'Annuler', onAction: () => actions.restoreItem(list.id, removed.item, removed.index) });
    },
    [list.id],
  );
  const toggleCollapse = useCallback((c: CategoryId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }, []);

  const finish = () => {
    const r = actions.finish(list.id);
    setConfirmFinish(false);
    if (r) {
      haptic('success');
      onFinished(r.finished.id, r.missing?.id ?? null);
    }
  };

  const pct = Math.round(p.ratio * 100);

  return (
    <div className="min-h-full pb-6">
      <header className="halftone px-5 pt-4 pb-1 text-white">
        <div className="flex items-start justify-between">
          <CoursesLogo size="sm" />
          <button
            onClick={() => (haptic(), setMenu(true))}
            className="press grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white backdrop-blur"
            aria-label="Options de la liste"
          >
            <IconMore size={26} />
          </button>
        </div>
      </header>

      {/* Progression globale, collée en haut */}
      <div className="halftone sticky top-0 z-20 px-5 pt-2 pb-4 text-white shadow-[0_10px_24px_-16px_rgba(120,0,50,0.9)]">
        <div className="flex items-end justify-between gap-3">
          <button onClick={() => (haptic(), setStoreEdit(true))} className="press -ml-1 flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-1 text-left">
            <span className="truncate pt-1 font-display text-[26px] leading-[1.1] tracking-wide uppercase">
              {store || 'Courses'} <span className="text-white/70">· {formatDate(list.createdAt)}</span>
            </span>
            <IconPencil size={16} className="shrink-0 opacity-70" />
          </button>
          <span className="shrink-0 pb-0.5 font-display text-[26px] leading-none tabular-nums">
            {p.done}
            <span className="text-white/60">/{p.total}</span>
          </span>
        </div>
        <div className="mt-2.5 h-3.5 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
            initial={false}
            animate={{ width: `${Math.max(pct, p.total ? 2 : 0)}%` }}
            transition={{ type: 'spring', stiffness: 160, damping: 24 }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[13px] font-semibold text-white/90">
          <span>
            {pct}% pris{p.partial > 0 && <span className="ml-2 rounded-full bg-partial px-2 py-0.5 text-white">{p.partial} partiel{p.partial > 1 ? 's' : ''}</span>}
          </span>
          <span>{p.total - p.done > 0 ? `${p.total - p.done} à prendre` : 'Tout est pris 🎉'}</span>
        </div>
      </div>

      <div className="space-y-3.5 px-3.5 pt-4">
        {list.items.length === 0 && (
          <div className="rounded-[26px] bg-white px-6 py-10 text-center dark:bg-night-card">
            <p className="font-display text-[24px] uppercase">Liste vide</p>
            <p className="mt-1 text-black/55 dark:text-white/55">Ajoute un article avec le bouton +</p>
          </div>
        )}
        {groups.map((g) => (
          <CategorySection
            key={g.category}
            category={g.category}
            items={g.items}
            collapsed={collapsed.has(g.category)}
            onToggleCollapse={toggleCollapse}
            onToggle={onToggle}
            onSetTaken={onSetTaken}
            onLongPress={onLongPress}
            onDelete={onDelete}
          />
        ))}

        {list.items.length > 0 && (
          <p className="px-2 pt-1 text-center text-[13px] leading-relaxed text-black/40 dark:text-white/40">
            Tap = tout pris · − / + = prise partielle
            <br />
            Glisser à gauche = supprimer · appui long = modifier
          </p>
        )}

        <div className="pt-2 pb-20">
          <PrimaryButton variant="ink" onClick={() => (haptic('medium'), setConfirmFinish(true))} className="min-h-16 text-[22px]">
            <IconFlag size={24} /> Terminer les courses
          </PrimaryButton>
        </div>
      </div>

      {/* Bouton + flottant */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        animate={{ y: fabVisible ? 0 : 120, opacity: fabVisible ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        onClick={() => (haptic(), setAdding(true))}
        className="fixed right-5 z-30 grid h-16 w-16 place-items-center rounded-full bg-brand text-white shadow-[0_14px_30px_-10px_rgba(237,30,121,0.9)] ring-4 ring-white/70 dark:ring-night/70"
        style={{ bottom: 'calc(var(--tabbar-h) + 18px)', right: 'calc(var(--safe-right) + 20px)', pointerEvents: fabVisible ? 'auto' : 'none' }}
        aria-label="Ajouter un article"
      >
        <IconPlus size={32} />
      </motion.button>

      <EditItemSheet listId={list.id} item={editing} onClose={() => setEditing(null)} onDelete={onDelete} />
      <AddItemSheet listId={list.id} open={adding} onClose={() => setAdding(false)} />

      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Liste">
        <div className="space-y-2.5 pb-2">
          <MenuButton icon={<IconPlus size={22} />} label="Ajouter un article" onClick={() => (setMenu(false), setAdding(true))} />
          <MenuButton icon={<IconClipboard size={22} />} label="Coller une nouvelle liste" onClick={() => (setMenu(false), onImport())} />
          <MenuButton icon={<IconPencil size={22} />} label="Changer de magasin" onClick={() => (setMenu(false), setStoreEdit(true))} />
          <MenuButton
            icon={<span className="text-lg">↺</span>}
            label="Tout décocher"
            onClick={() => {
              setMenu(false);
              list.items.forEach((i) => i.taken && actions.setTaken(list.id, i.id, 0));
              toast('Tout est décoché');
            }}
          />
          <MenuButton icon={<IconX size={22} />} label="Fermer (reste dans « En cours »)" onClick={() => (setMenu(false), actions.closeActive())} />
          <MenuButton icon={<IconFlag size={22} />} label="Terminer les courses" accent onClick={() => (setMenu(false), setConfirmFinish(true))} />
        </div>
      </BottomSheet>

      <StoreSheet open={storeEdit} list={list} onClose={() => setStoreEdit(false)} />

      <BottomSheet
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title="Terminer ?"
        footer={
          <div className="space-y-2.5">
            <PrimaryButton onClick={finish}>Terminer les courses</PrimaryButton>
            <button onClick={() => setConfirmFinish(false)} className="press min-h-12 w-full rounded-2xl text-[16px] font-semibold text-black/60 dark:text-white/60">
              Continuer les courses
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[22px] bg-brand-50 px-4 py-4 dark:bg-brand/15">
            <p className="text-[13px] font-semibold text-brand-700 dark:text-brand-200">✅ Pris</p>
            <p className="font-display text-[40px] leading-none">{takenCount}</p>
            <p className="text-[13px] text-black/50 dark:text-white/50">article{takenCount > 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-[22px] bg-partial-50 px-4 py-4 dark:bg-[#2a2016]">
            <p className="text-[13px] font-semibold text-[#c25e00] dark:text-partial">⚠️ Manquants</p>
            <p className="font-display text-[40px] leading-none">{missingCount}</p>
            <p className="text-[13px] text-black/50 dark:text-white/50">article{missingCount > 1 ? 's' : ''}</p>
          </div>
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-black/65 dark:text-white/65">
          {missingCount > 0
            ? 'Les quantités manquantes (demandé − pris) formeront une nouvelle liste « Manquants », prête à envoyer à ton responsable.'
            : 'Tout a été pris, rien ne manque. 💪'}
        </p>
      </BottomSheet>
    </div>
  );
}

/** Le bouton + se cache quand on descend dans la liste (pour ne pas masquer les steppers) et revient quand on remonte. */
function useFabVisibility() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    let last = main.scrollTop;
    const onScroll = () => {
      const y = main.scrollTop;
      const atBottom = y + main.clientHeight >= main.scrollHeight - 40;
      if (Math.abs(y - last) < 6) return;
      setVisible(y < last || y < 60 || atBottom);
      last = y;
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);
  return visible;
}

function MenuButton({ icon, label, onClick, accent }: { icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={() => (haptic(), onClick())}
      className={`press flex min-h-14 w-full items-center gap-3.5 rounded-[20px] px-4 text-left text-[17px] font-semibold ${
        accent ? 'bg-brand text-white' : 'bg-black/[0.04] dark:bg-white/[0.07]'
      }`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${accent ? 'bg-white/20' : 'bg-white text-brand shadow-sm dark:bg-white/10'}`}>{icon}</span>
      {label}
    </button>
  );
}

function StoreSheet({ open, list, onClose }: { open: boolean; list: ShoppingList; onClose: () => void }) {
  const [store, setStore] = useState<StoreId>(list.store);
  const [name, setName] = useState(list.storeName ?? '');
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Magasin"
      footer={
        <PrimaryButton
          onClick={() => {
            actions.setStore(list.id, store, name.trim() || undefined);
            haptic('success');
            onClose();
          }}
        >
          Valider
        </PrimaryButton>
      }
    >
      <Segmented<StoreId> value={store} onChange={setStore} options={(Object.keys(STORES) as StoreId[]).map((id) => ({ value: id, label: STORES[id] }))} />
      {store === 'autre' && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du magasin (facultatif)"
          className="mt-3 h-12 w-full rounded-2xl bg-black/[0.05] px-4 outline-none focus:ring-2 focus:ring-brand dark:bg-white/[0.08]"
        />
      )}
    </BottomSheet>
  );
}
