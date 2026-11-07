"use client";

export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const btn =
    "grid size-11 place-items-center rounded-full border border-line bg-surface text-xl font-medium text-ink disabled:opacity-35 active:bg-elevated";
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`${label} : moins`}>
        −
      </button>
      <output className="min-w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {format(value)}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`${label} : plus`}>
        +
      </button>
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-2xl border border-line bg-elevated p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-10 flex-1 rounded-xl px-2 text-[15px] font-medium transition ${
              active ? "bg-surface text-ink shadow-sm ring-1 ring-line dark:bg-line" : "text-muted"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
