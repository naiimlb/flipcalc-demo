import type { ReactNode } from 'react';
import { CATEGORIES, type CategoryId } from '../lib/categories';
import { haptic } from '../lib/haptics';
import { IconMinus, IconPlus } from './Icons';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex rounded-2xl bg-black/[0.05] p-1 dark:bg-white/[0.08] ${className}`} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => {
              if (!active) haptic();
              onChange(o.value);
            }}
            className={`press min-h-11 flex-1 rounded-xl px-2 text-[15px] font-semibold transition-colors ${
              active ? 'bg-white text-ink shadow-[0_1px_4px_rgba(0,0,0,0.12)] dark:bg-white/[0.16] dark:text-white' : 'text-black/55 dark:text-white/55'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 9999,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const btn =
    'press grid h-12 w-12 place-items-center rounded-2xl bg-black/[0.05] text-ink disabled:opacity-30 dark:bg-white/[0.08] dark:text-white';
  return (
    <div className="flex items-center gap-2" aria-label={label}>
      <button className={btn} disabled={value <= min} onClick={() => (haptic(), onChange(Math.max(min, value - 1)))} aria-label="Moins">
        <IconMinus size={20} />
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
        }}
        onFocus={(e) => e.target.select()}
        className="h-12 w-20 rounded-2xl bg-black/[0.05] text-center font-display text-2xl outline-none focus:ring-2 focus:ring-brand dark:bg-white/[0.08]"
        aria-label={label ?? 'Quantité'}
      />
      <button className={btn} disabled={value >= max} onClick={() => (haptic(), onChange(Math.min(max, value + 1)))} aria-label="Plus">
        <IconPlus size={20} />
      </button>
    </div>
  );
}

export function CategoryPicker({ value, onChange, order }: { value: CategoryId; onChange: (c: CategoryId) => void; order: CategoryId[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {order.map((id) => {
        const c = CATEGORIES[id];
        const active = id === value;
        return (
          <button
            key={id}
            onClick={() => {
              haptic();
              onChange(id);
            }}
            className={`press flex min-h-12 items-center gap-2 rounded-2xl px-3 py-2 text-left text-[14px] font-semibold leading-tight transition-colors ${
              active
                ? 'bg-brand text-white shadow-[0_6px_16px_-6px_rgba(237,30,121,0.7)]'
                : 'bg-black/[0.04] text-ink dark:bg-white/[0.07] dark:text-white'
            }`}
            aria-pressed={active}
          >
            <span className="text-xl leading-none">{c.emoji}</span>
            <span>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  variant = 'brand',
  className = '',
  disabled,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'brand' | 'ink' | 'soft' | 'outline' | 'whatsapp' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles = {
    brand: 'bg-brand text-white shadow-[0_10px_24px_-10px_rgba(237,30,121,0.85)]',
    ink: 'bg-ink text-white shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] dark:bg-white dark:text-ink',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand/15 dark:text-brand-200',
    outline: 'border-2 border-ink/90 text-ink dark:border-white/80 dark:text-white',
    whatsapp: 'bg-whatsapp text-white shadow-[0_10px_24px_-12px_rgba(37,211,102,0.9)]',
    danger: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`press flex min-h-14 w-full items-center justify-center gap-2.5 rounded-[20px] px-5 font-display text-[19px] uppercase tracking-wide disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
