import { AnimatePresence, motion } from 'motion/react';
import { CATEGORIES, type CategoryId } from '../lib/categories';
import { haptic } from '../lib/haptics';
import { itemState } from '../lib/lists';
import type { Item } from '../lib/types';
import { IconCheck, IconChevron } from './Icons';
import { ItemRow } from './ItemRow';

interface Props {
  category: CategoryId;
  items: Item[];
  collapsed: boolean;
  onToggleCollapse: (c: CategoryId) => void;
  onToggle: (item: Item) => void;
  onSetTaken: (item: Item, taken: number) => void;
  onLongPress: (item: Item) => void;
  onDelete: (item: Item) => void;
}

export function CategorySection({ category, items, collapsed, onToggleCollapse, ...rowHandlers }: Props) {
  const cat = CATEGORIES[category];
  const done = items.filter((i) => itemState(i) === 'done').length;
  const complete = done === items.length;

  return (
    <motion.section
      layout="position"
      transition={{ layout: { type: 'spring', stiffness: 420, damping: 40 } }}
      className="overflow-hidden rounded-[26px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_30px_-18px_rgba(120,0,50,0.35)] dark:bg-night-card dark:shadow-none"
    >
      <button
        className="touch-none-select flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-black/[0.03] dark:active:bg-white/[0.04]"
        onClick={() => {
          haptic();
          onToggleCollapse(category);
        }}
        aria-expanded={!collapsed}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-brand-50 text-[22px] dark:bg-brand/15">{cat.emoji}</span>
        <span className="min-w-0 flex-1 font-display text-[19px] leading-tight uppercase tracking-wide text-ink dark:text-white">
          {cat.label}
        </span>
        <span
          className={`flex h-8 min-w-[52px] items-center justify-center gap-1 rounded-full px-2.5 font-display text-[16px] tabular-nums transition-colors ${
            complete ? 'bg-brand text-white' : 'bg-black/[0.06] text-ink dark:bg-white/10 dark:text-white'
          }`}
        >
          {complete && <IconCheck size={14} />}
          {done}/{items.length}
        </span>
        <motion.span animate={{ rotate: collapsed ? -90 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} className="text-black/35 dark:text-white/40">
          <IconChevron size={22} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ height: { type: 'spring', stiffness: 420, damping: 42 }, opacity: { duration: 0.16 } }}
            className="overflow-hidden"
          >
            <ul className="divide-y divide-black/[0.06] border-t border-black/[0.06] dark:divide-white/[0.07] dark:border-white/[0.07]">
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} {...rowHandlers} />
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
