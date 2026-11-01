"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { RequestItem } from "@/lib/requests";
import { signOut } from "@/app/actions";
import {
  IconBell,
  IconChevronDown,
  IconClock,
  IconLogout,
  IconSearch,
  IconSettings,
  IconShield,
  IconX,
  LogoMark,
} from "../icons";
import { formatRelative } from "./format";
import { StatusChip } from "./ui";
import type { StudioTab, StudioViewer } from "./types";

const TABS: { id: StudioTab; label: string }[] = [
  { id: "overview", label: "Aperçu" },
  { id: "history", label: "Historique" },
  { id: "settings", label: "Paramètres" },
];

const SEEN_KEY = "forma3d:notifications-seen";

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const dropdown = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.16 },
};

export function TopBar({
  siteName,
  logoDataUrl,
  tab,
  onTab,
  items,
  onSelect,
  viewer,
  demoMode,
}: {
  siteName: string;
  logoDataUrl: string | null;
  tab: StudioTab;
  onTab(tab: StudioTab): void;
  items: RequestItem[];
  onSelect(id: string): void;
  viewer: StudioViewer | null;
  demoMode: boolean;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 pt-3 sm:gap-3 sm:px-5 sm:pt-4">
      <div className="flex min-w-0 items-center gap-2 pr-1">
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoDataUrl} alt="" className="h-6 w-6 rounded-md object-contain" />
        ) : (
          <LogoMark size={22} />
        )}
        <span className="truncate text-[15px] font-semibold tracking-tight">{siteName}</span>
      </div>

      <nav
        aria-label="Sections"
        className="order-last flex w-full justify-center gap-1 rounded-full bg-paper p-1 sm:order-none sm:mx-auto sm:w-auto"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`relative rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === t.id ? "text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab === t.id && (
              <motion.span
                layoutId="studio-tab"
                className="absolute inset-0 rounded-full bg-brand-accent"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5 sm:ml-0">
        <span className="hidden items-center gap-1.5 whitespace-nowrap px-1 text-[11px] font-medium text-ink-soft lg:inline-flex">
          <IconClock size={14} />
          {now
            ? now.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
            : " "}
        </span>
        <SearchBox items={items} onSelect={onSelect} />
        <Notifications items={items} onSelect={onSelect} />
        <AccountMenu viewer={viewer} demoMode={demoMode} onSettings={() => onTab("settings")} />
      </div>
    </div>
  );
}

function SearchBox({ items, onSelect }: { items: RequestItem[]; onSelect(id: string): void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useOutsideClose(open, () => setOpen(false));
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr-FR");
    if (!q) return items.slice(0, 6);
    return items
      .filter((i) => `${i.title ?? ""} ${i.prompt} ${i.design?.category ?? ""}`.toLocaleLowerCase("fr-FR").includes(q))
      .slice(0, 8);
  }, [items, query]);

  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" className="icon-btn" aria-label="Rechercher un projet" onClick={() => setOpen((o) => !o)}>
        <IconSearch size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute right-0 top-10 z-30 w-[min(300px,80vw)] rounded-2xl border border-line bg-white p-2 shadow-float">
            <div className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
              <IconSearch size={14} className="text-ink-mute" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results[0]) pick(results[0].id);
                }}
                placeholder="Rechercher un projet…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-mute"
              />
            </div>
            <ul className="mt-1 max-h-72 overflow-y-auto scrollbar-thin">
              {results.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-mute">Aucun projet trouvé.</li>}
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-paper"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{item.title ?? item.prompt}</span>
                      <span className="block truncate text-[11px] text-ink-mute">{item.prompt}</span>
                    </span>
                    <StatusChip status={item.status} compact />
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Notifications({ items, onSelect }: { items: RequestItem[]; onSelect(id: string): void }) {
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState<number>(Date.now());
  const ref = useOutsideClose(open, () => setOpen(false));

  useEffect(() => {
    try {
      setSeenAt(Number(localStorage.getItem(SEEN_KEY) ?? 0));
    } catch {
      setSeenAt(0);
    }
  }, []);

  const recent = items.filter((i) => !i.sample).slice(0, 6);
  const unread = recent.filter((i) => i.status !== "processing" && new Date(i.createdAt).getTime() > seenAt).length;

  const toggle = () => {
    setOpen((o) => !o);
    const t = Date.now();
    setSeenAt(t);
    try {
      localStorage.setItem(SEEN_KEY, String(t));
    } catch {
      // ignoré
    }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" className="icon-btn relative" aria-label={`Notifications (${unread} nouvelles)`} onClick={toggle}>
        <IconBell size={15} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute right-0 top-10 z-30 w-[min(300px,80vw)] rounded-2xl border border-line bg-white p-2 shadow-float">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">Activité</p>
            {recent.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-ink-mute">Aucune activité pour l&apos;instant.</p>
            ) : (
              <ul>
                {recent.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left hover:bg-paper"
                    >
                      <StatusChip status={item.status} compact />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{item.title ?? item.prompt}</span>
                        <span className="block text-[11px] text-ink-mute">
                          {item.status === "ready"
                            ? "Conception prête"
                            : item.status === "processing"
                              ? "Génération en cours"
                              : item.error ?? "Échec de la génération"}{" "}
                          · {formatRelative(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountMenu({
  viewer,
  demoMode,
  onSettings,
}: {
  viewer: StudioViewer | null;
  demoMode: boolean;
  onSettings(): void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  if (!viewer) {
    if (demoMode) return <span className="chip bg-amber-100 text-amber-800">Démo</span>;
    return (
      <Link href="/connexion" className="btn-dark !px-3 !py-1.5 !text-xs">
        Connexion
      </Link>
    );
  }
  const name = viewer.displayName || viewer.email;
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-0.5 text-ink-soft hover:text-ink"
        aria-label="Menu du compte"
        aria-expanded={open}
      >
        <IconChevronDown size={14} />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-from to-brand-to text-[11px] font-bold text-white ring-2 ring-white">
          {initials || "?"}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute right-0 top-11 z-30 w-60 rounded-2xl border border-line bg-white p-2 shadow-float">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-[11px] text-ink-mute">{viewer.email}</p>
              {viewer.role === "admin" && <span className="chip mt-1.5 bg-ink text-white">Administrateur</span>}
            </div>
            <div className="my-1 h-px bg-line" />
            {viewer.role === "admin" && (
              <Link href="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-paper">
                <IconShield size={15} /> Administration
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                onSettings();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-paper"
            >
              <IconSettings size={15} /> Paramètres
            </button>
            <form action={signOut}>
              <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                <IconLogout size={15} /> Se déconnecter
              </button>
            </form>
            <button type="button" onClick={() => setOpen(false)} className="sr-only">
              <IconX /> Fermer
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
