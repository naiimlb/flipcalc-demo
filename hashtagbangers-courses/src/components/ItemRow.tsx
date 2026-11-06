import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { memo, useRef } from 'react';
import { haptic } from '../lib/haptics';
import { itemState, missingQty } from '../lib/lists';
import type { Item } from '../lib/types';
import { IconCheck, IconMinus, IconPlus, IconTrash } from './Icons';

interface Props {
  item: Item;
  onToggle: (item: Item) => void;
  onSetTaken: (item: Item, taken: number) => void;
  onLongPress: (item: Item) => void;
  onDelete: (item: Item) => void;
  readOnly?: boolean;
}

const LONG_PRESS_MS = 460;
const DELETE_DISTANCE = 110;

function CheckMark({ state, ratio }: { state: ReturnType<typeof itemState>; ratio: number }) {
  if (state === 'done') {
    return (
      <motion.span
        key="done"
        initial={{ scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 700, damping: 20 }}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white shadow-[0_4px_10px_-3px_rgba(237,30,121,0.8)]"
      >
        <IconCheck size={20} />
      </motion.span>
    );
  }
  if (state === 'partial') {
    return (
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--color-partial) ${ratio * 360}deg, rgb(255 149 0 / 0.2) 0)` }}
      >
        <span className="h-[26px] w-[26px] rounded-full bg-partial-50 dark:bg-[#2a2016]" />
      </span>
    );
  }
  return <span className="h-9 w-9 shrink-0 rounded-full border-[2.5px] border-black/20 dark:border-white/25" />;
}

function ItemRowBase({ item, onToggle, onSetTaken, onLongPress, onDelete, readOnly }: Props) {
  const state = itemState(item);
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-DELETE_DISTANCE, -20, 0], [1, 0.6, 0]);
  const iconScale = useTransform(x, [-DELETE_DISTANCE - 20, -DELETE_DISTANCE, -30], [1.15, 1, 0.6]);

  const press = useRef<{ x: number; y: number; timer?: number; fired: boolean; dragged: boolean }>({
    x: 0,
    y: 0,
    fired: false,
    dragged: false,
  });

  const clearTimer = () => window.clearTimeout(press.current.timer);

  const onPointerDown = (e: React.PointerEvent) => {
    press.current = { x: e.clientX, y: e.clientY, fired: false, dragged: false };
    if (readOnly) return;
    press.current.timer = window.setTimeout(() => {
      press.current.fired = true;
      haptic('medium');
      onLongPress(item);
    }, LONG_PRESS_MS);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 9) clearTimer();
  };
  const onClick = () => {
    clearTimer();
    if (press.current.fired || press.current.dragged || readOnly) return;
    haptic(state === 'done' ? 'light' : 'success');
    onToggle(item);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const step = (delta: number) => {
    haptic();
    onSetTaken(item, item.taken + delta);
  };

  const rowTone =
    state === 'partial'
      ? 'bg-partial-50 dark:bg-[#2a2016]'
      : state === 'done'
        ? 'bg-white dark:bg-night-card'
        : 'bg-white dark:bg-night-card';

  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, transition: { duration: 0.22 } }}
      transition={{ layout: { type: 'spring', stiffness: 460, damping: 40 }, opacity: { duration: 0.18 } }}
      className="relative overflow-hidden"
    >
      {/* Fond révélé par le swipe gauche */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end gap-2 bg-red-500 pr-6 font-display text-[17px] uppercase tracking-wide text-white"
        style={{ opacity: bgOpacity }}
        aria-hidden="true"
      >
        <motion.span style={{ scale: iconScale }} className="flex items-center gap-2">
          <IconTrash size={22} /> Supprimer
        </motion.span>
      </motion.div>

      <motion.div
        role="checkbox"
        aria-checked={state === 'done' ? true : state === 'partial' ? 'mixed' : false}
        tabIndex={0}
        className={`touch-none-select relative flex min-h-[68px] cursor-pointer items-center gap-3.5 py-2.5 pr-2.5 pl-4 transition-colors duration-200 ${rowTone}`}
        style={{ x, touchAction: 'pan-y' }}
        drag={readOnly ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.85, right: 0.04 }}
        dragMomentum={false}
        onDragStart={() => {
          press.current.dragged = true;
          clearTimer();
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -DELETE_DISTANCE || info.velocity.x < -700) {
            haptic('medium');
            animate(x, -window.innerWidth, { duration: 0.18, ease: 'easeIn' }).then(() => onDelete(item));
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clearTimer}
        onPointerCancel={clearTimer}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onToggle(item);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {state === 'partial' && <span className="absolute top-2 bottom-2 left-0 w-[4px] rounded-r-full bg-partial" />}
        <CheckMark state={state} ratio={item.qty ? item.taken / item.qty : 0} />

        <div className="min-w-0 flex-1">
          <p
            className={`text-[17px] leading-snug font-semibold transition-colors ${
              state === 'done' ? 'text-black/35 line-through decoration-2 dark:text-white/35' : 'text-ink dark:text-white'
            }`}
          >
            {item.name}
          </p>
          {state === 'partial' && (
            <p className="mt-0.5 text-[13px] font-semibold text-[#c25e00] dark:text-partial">Partiel · manque {missingQty(item)}</p>
          )}
          {state === 'todo' && item.qty > 1 && (
            <p className="mt-0.5 text-[13px] font-medium text-black/45 dark:text-white/45">À prendre : {item.qty}</p>
          )}
        </div>

        <div
          className={`flex shrink-0 items-center rounded-2xl ${state === 'done' ? 'opacity-45' : ''} ${
            state === 'partial' ? 'bg-partial/15' : 'bg-black/[0.045] dark:bg-white/[0.07]'
          }`}
          onClick={stop}
          onPointerDown={stop}
        >
          <button
            className="press grid h-11 w-11 place-items-center rounded-2xl text-ink disabled:opacity-25 dark:text-white"
            onClick={() => step(-1)}
            disabled={readOnly || item.taken <= 0}
            aria-label={`Retirer un ${item.name}`}
          >
            <IconMinus size={18} />
          </button>
          <span className="min-w-[46px] text-center font-display text-[19px] leading-none tabular-nums">
            <span className={state === 'partial' ? 'text-[#c25e00] dark:text-partial' : ''}>{item.taken}</span>
            <span className="text-black/35 dark:text-white/35">/{item.qty}</span>
          </span>
          <button
            className="press grid h-11 w-11 place-items-center rounded-2xl text-ink disabled:opacity-25 dark:text-white"
            onClick={() => step(1)}
            disabled={readOnly || item.taken >= item.qty}
            aria-label={`Prendre un ${item.name}`}
          >
            <IconPlus size={18} />
          </button>
        </div>
      </motion.div>
    </motion.li>
  );
}

export const ItemRow = memo(ItemRowBase);
