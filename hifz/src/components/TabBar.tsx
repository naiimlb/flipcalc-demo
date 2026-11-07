"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";
import { useAuth } from "@/components/providers/auth-context";
import { isAuthPath } from "@/lib/auth/config";
import { activeTab, tabs } from "@/modules/registry";

/** Chemins en plein écran (mode récitation) : pas de barre d'onglets. */
const HIDDEN_ON = ["/hifz/session"];

export function TabBar() {
  const pathname = usePathname();
  const { state } = useAuth();
  // Pas de barre d'onglets pendant l'identification ni avant de connaître la session.
  if (state.status === "loading" || state.status === "signedOut" || isAuthPath(pathname)) return null;
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  const current = activeTab(pathname);

  return (
    <nav
      aria-label="Navigation principale"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md"
    >
      <ul className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const isActive = current?.href === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 pt-2 text-[11px] font-medium transition-colors ${
                  isActive ? "text-accent" : "text-muted hover:text-ink"
                }`}
              >
                <Icon name={tab.icon} width={24} height={24} strokeWidth={isActive ? 2.1 : 1.8} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
