import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { Segmented } from '../components/Controls';
import { IconChevronRight, IconDuplicate, IconMore, IconTrash } from '../components/Icons';
import { toast } from '../components/Toast';
import { haptic } from '../lib/haptics';
import { progress, storeLabel } from '../lib/lists';
import type { ShoppingList } from '../lib/types';
import { actions, getState, useAppState } from '../state/store';

type Filter = 'en_cours' | 'terminees' | 'manquants';

function when(ts: number): string {
  const d = new Date(ts);
  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

export function ListsScreen({ onOpenCourses, onOpenMissing }: { onOpenCourses: () => void; onOpenMissing: (id: string) => void }) {
  const lists = useAppState((s) => s.lists);
  const activeId = useAppState((s) => s.activeId);
  const [filter, setFilter] = useState<Filter>('en_cours');
  const [menuFor, setMenuFor] = useState<ShoppingList | null>(null);

  const buckets: Record<Filter, ShoppingList[]> = {
    en_cours: lists.filter((l) => l.kind === 'courses' && l.status === 'en_cours'),
    terminees: lists.filter((l) => l.kind === 'courses' && l.status === 'terminee'),
    manquants: lists.filter((l) => l.kind === 'manquants'),
  };
  const shown = [...buckets[filter]].sort((a, b) => (b.finishedAt ?? b.updatedAt) - (a.finishedAt ?? a.updatedAt));

  const open = (l: ShoppingList) => {
    haptic();
    if (l.kind === 'manquants') return onOpenMissing(l.id);
    actions.openList(l.id);
    onOpenCourses();
  };
  const duplicate = (l: ShoppingList) => {
    const copy = actions.duplicateList(l.id);
    haptic('success');
    if (copy) {
      setFilter('en_cours');
      toast('Liste dupliquée dans « En cours »', {
        actionLabel: 'Ouvrir',
        onAction: () => {
          actions.openList(copy.id);
          onOpenCourses();
        },
      });
    }
  };
  const remove = (l: ShoppingList) => {
    const index = getState().lists.findIndex((x) => x.id === l.id);
    actions.deleteList(l.id);
    haptic('medium');
    toast('Liste supprimée', { actionLabel: 'Annuler', onAction: () => actions.restoreList(l, index) });
  };

  const empty: Record<Filter, string> = {
    en_cours: 'Aucune liste en cours. Colle ta liste dans l’onglet Courses.',
    terminees: 'Les listes terminées apparaîtront ici.',
    manquants: 'Les listes de manquants créées à la fin des courses apparaîtront ici.',
  };

  return (
    <div className="min-h-full pb-10">
      <header className="halftone px-5 pt-5 pb-7 text-white">
        <h1 className="font-display text-[44px] leading-none tracking-wide uppercase">Mes listes</h1>
        <p className="mt-1 -rotate-1 font-marker text-[20px] text-ink">en cours, terminées & manquants.</p>
      </header>
      <div className="relative z-10 -mt-4 px-4">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          className="bg-white shadow-[0_10px_24px_-16px_rgba(120,0,50,0.5)] dark:bg-night-card"
          options={[
            { value: 'en_cours', label: <Count label="En cours" n={buckets.en_cours.length} /> },
            { value: 'terminees', label: <Count label="Terminées" n={buckets.terminees.length} /> },
            { value: 'manquants', label: <Count label="Manquants" n={buckets.manquants.length} /> },
          ]}
        />

        <ul className="mt-4 space-y-3">
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((l) => {
              const p = progress(l.items);
              const isMissing = l.kind === 'manquants';
              const store = storeLabel(l) || 'Courses';
              return (
                <motion.li
                  key={l.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="flex items-stretch overflow-hidden rounded-[24px] bg-white shadow-[0_10px_28px_-18px_rgba(120,0,50,0.4)] dark:bg-night-card"
                >
                  <button onClick={() => open(l)} className="press flex min-h-[78px] min-w-0 flex-1 items-center gap-3.5 py-3 pl-4 text-left">
                    <span
                      className={`grid h-12 w-12 shrink-0 place-items-center rounded-[16px] text-[24px] ${
                        isMissing ? 'bg-partial-50 dark:bg-[#2a2016]' : 'bg-brand-50 dark:bg-brand/15'
                      }`}
                    >
                      {isMissing ? '⚠️' : l.status === 'terminee' ? '✅' : '🛒'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate pt-0.5 font-display text-[21px] leading-[1.2] tracking-wide uppercase">
                          {isMissing ? `Manquants ${store === 'Courses' ? '' : store}` : store}
                        </span>
                        {l.id === activeId && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white uppercase">Ouverte</span>}
                      </span>
                      <span className="block text-[13px] text-black/50 capitalize dark:text-white/50">{when(l.finishedAt ?? l.createdAt)}</span>
                      <span className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-black/65 dark:text-white/65">
                        {isMissing ? (
                          <>{l.items.length} article{l.items.length > 1 ? 's' : ''} à racheter</>
                        ) : (
                          <>
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round(p.ratio * 100)}%` }} />
                            </span>
                            {p.done}/{p.total} pris
                          </>
                        )}
                      </span>
                    </span>
                    <IconChevronRight size={20} className="shrink-0 text-black/25 dark:text-white/30" />
                  </button>
                  <button
                    onClick={() => (haptic(), setMenuFor(l))}
                    className="press grid w-14 shrink-0 place-items-center text-black/45 dark:text-white/50"
                    aria-label="Actions"
                  >
                    <IconMore size={24} />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
        {shown.length === 0 && (
          <div className="mt-6 rounded-[24px] border-2 border-dashed border-brand/25 px-6 py-10 text-center text-[15px] leading-relaxed text-black/55 dark:text-white/55">
            {empty[filter]}
          </div>
        )}
      </div>

      <BottomSheet open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor ? (menuFor.kind === 'manquants' ? 'Manquants' : storeLabel(menuFor) || 'Liste') : ''}>
        {menuFor && (
          <div className="space-y-2.5 pb-2">
            <SheetAction
              label={menuFor.kind === 'manquants' ? 'Voir et envoyer' : menuFor.status === 'terminee' ? 'Rouvrir' : 'Ouvrir'}
              icon={<IconChevronRight size={22} />}
              onClick={() => {
                const l = menuFor;
                setMenuFor(null);
                open(l);
              }}
            />
            <SheetAction
              label={menuFor.kind === 'manquants' ? 'Créer une liste de courses avec' : 'Dupliquer (tout décoché)'}
              icon={<IconDuplicate size={22} />}
              onClick={() => {
                const l = menuFor;
                setMenuFor(null);
                duplicate(l);
              }}
            />
            <SheetAction
              label="Supprimer"
              danger
              icon={<IconTrash size={22} />}
              onClick={() => {
                const l = menuFor;
                setMenuFor(null);
                remove(l);
              }}
            />
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[14px]">
      {label}
      {n > 0 && <span className="rounded-full bg-black/10 px-1.5 text-[12px] leading-[18px] dark:bg-white/15">{n}</span>}
    </span>
  );
}

function SheetAction({ label, icon, onClick, danger }: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`press flex min-h-14 w-full items-center gap-3.5 rounded-[20px] px-4 text-left text-[17px] font-semibold ${
        danger ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-black/[0.04] dark:bg-white/[0.07]'
      }`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${danger ? 'bg-white/70 dark:bg-white/10' : 'bg-white text-brand shadow-sm dark:bg-white/10'}`}>{icon}</span>
      {label}
    </button>
  );
}
