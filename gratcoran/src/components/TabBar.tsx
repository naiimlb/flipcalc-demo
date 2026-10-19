"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const TABS = [
  { href: "/", label: "Reconnaître", icon: MicIcon },
  { href: "/tajweed", label: "Tajweed", icon: TajweedIcon },
  { href: "/historique", label: "Historique", icon: ClockIcon },
  { href: "/compte", label: "Compte", icon: UserIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="pb-safe fixed inset-x-0 bottom-0 z-40">
      <div className="glass mx-auto max-w-md rounded-t-[26px] border-b-0">
        <ul className="flex h-[var(--tabbar-h)] items-stretch px-2">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="relative flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 active:opacity-60"
                >
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute top-2 h-8 w-14 rounded-full bg-emerald/15"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <motion.span
                    key={active ? "on" : "off"}
                    initial={active ? { scale: 0.6, y: 4, rotate: -8 } : false}
                    animate={{ scale: 1, y: 0, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 18 }}
                    className="relative"
                  >
                    <Icon active={active} />
                  </motion.span>
                  <span
                    className={`relative text-[11px] font-semibold ${
                      active ? "text-emerald-deep dark:text-emerald" : "text-muted"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

function iconClass(active: boolean) {
  return `h-[26px] w-[26px] ${active ? "text-emerald-deep dark:text-emerald" : "text-muted"}`;
}

type IconProps = { active: boolean };

function MicIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" className={iconClass(active)} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill={active ? "currentColor" : "none"} />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

/** Livre ouvert surmonté d'une coche : « corriger sa récitation ». */
function TajweedIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" className={iconClass(active)} aria-hidden>
      <path d="M3 7.5c3-1.2 6-1 9 1.2 3-2.2 6-2.4 9-1.2V19c-3-1.2-6-1-9 1.2C9 18 6 17.8 3 19V7.5Z" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
      <path d="M12 8.7v11.5" />
      <path d="m8.5 4.5 2 2 4-4" />
    </svg>
  );
}

function ClockIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" className={iconClass(active)} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function UserIcon({ active }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" className={iconClass(active)} aria-hidden>
      <circle cx="12" cy="8.5" r="3.8" fill={active ? "currentColor" : "none"} />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  );
}
