"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const TABS = [
  { href: "/", label: "Reconnaître", icon: MicIcon },
  { href: "/historique", label: "Historique", icon: ClockIcon },
  { href: "/compte", label: "Compte", icon: UserIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/80 backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-md items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex h-full flex-col items-center justify-center gap-0.5 active:opacity-60"
              >
                {active && (
                  <motion.span
                    layoutId="tab-pill"
                    className="absolute top-1.5 h-8 w-14 rounded-full bg-emerald/10 dark:bg-emerald/15"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <Icon active={active} />
                <span
                  className={`relative text-[11px] font-medium ${
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
    </nav>
  );
}

function iconClass(active: boolean) {
  return `relative h-[26px] w-[26px] ${active ? "text-emerald-deep dark:text-emerald" : "text-muted"}`;
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" className={iconClass(active)} aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" fill={active ? "currentColor" : "none"} />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

function ClockIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" className={iconClass(active)} aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" className={iconClass(active)} aria-hidden>
      <circle cx="12" cy="8.5" r="3.8" fill={active ? "currentColor" : "none"} />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </svg>
  );
}
