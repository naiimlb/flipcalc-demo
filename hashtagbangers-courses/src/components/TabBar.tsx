import { motion } from 'motion/react';
import { haptic } from '../lib/haptics';
import { IconCart, IconList, IconSettings } from './Icons';

export type Tab = 'courses' | 'listes' | 'reglages';

const TABS: { id: Tab; label: string; Icon: typeof IconCart }[] = [
  { id: 'courses', label: 'Courses', Icon: IconCart },
  { id: 'listes', label: 'Listes', Icon: IconList },
  { id: 'reglages', label: 'Réglages', Icon: IconSettings },
];

export function TabBar({ tab, onChange, badge }: { tab: Tab; onChange: (t: Tab) => void; badge?: number }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/85 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.08] dark:bg-night-card/85"
      style={{ paddingBottom: 'var(--safe-bottom)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
    >
      <div className="mx-auto flex h-16 max-w-xl">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => {
                if (!active) haptic();
                onChange(id);
              }}
              className={`press relative flex flex-1 flex-col items-center justify-center gap-0.5 ${
                active ? 'text-brand' : 'text-black/45 dark:text-white/45'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute top-1.5 h-8 w-16 rounded-full bg-brand-50 dark:bg-brand/15"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <span className="relative mt-0.5">
                <Icon size={24} strokeWidth={active ? 2.5 : 2} />
                {!!badge && id === 'listes' && (
                  <span className="absolute -top-1 -right-2.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                    {badge}
                  </span>
                )}
              </span>
              <span className={`relative text-[11px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
