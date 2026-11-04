"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m as motion } from "framer-motion";
import type { RequestItem } from "@/lib/requests";
import { signOut } from "@/app/actions";
import {
  IconBell,
  IconChevronDown,
  IconLogout,
  IconSearch,
  IconSettings,
  IconShield,
  IconUser,
  IconX,
} from "../icons";
import { useT } from "../app/Preferences";
import { formatRelative } from "./format";
import { StatusChip } from "./ui";
import type { StudioTab, StudioViewer } from "./types";

export const TABS: { id: StudioTab; label: "tab.overview" | "tab.fabrication" | "tab.history" | "tab.settings" }[] = [
  { id: "overview", label: "tab.overview" },
  { id: "fabrication", label: "tab.fabrication" },
  { id: "history", label: "tab.history" },
  { id: "settings", label: "tab.settings" },
];

const SEEN_KEY = "forma3d:notifications-seen";

export function useOutsideClose(open: boolean, close: () => void) {
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

export const dropdown = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.16 },
};

export function SearchBox({ items, onSelect }: { items: RequestItem[]; onSelect(id: string): void }) {
  const t = useT();
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
      <button type="button" className="icon-btn" aria-label={t("search.open")} onClick={() => setOpen((o) => !o)}>
        <IconSearch size={15} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute end-0 top-10 z-30 w-[min(300px,80vw)] rounded-2xl border border-line bg-surface p-2 shadow-float">
            <div className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2">
              <IconSearch size={14} className="text-ink-mute" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && results[0]) pick(results[0].id);
                }}
                placeholder={t("search.placeholder")}
                className="w-full bg-transparent text-sm outline-none placeholder:text-ink-mute"
              />
            </div>
            <ul className="mt-1 max-h-72 overflow-y-auto scrollbar-thin">
              {results.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-mute">{t("search.empty")}</li>}
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => pick(item.id)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start hover:bg-paper"
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

export function Notifications({ items, onSelect }: { items: RequestItem[]; onSelect(id: string): void }) {
  const tr = useT();
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
      <button type="button" className="icon-btn relative" aria-label={tr("notif.label", { n: unread })} onClick={toggle}>
        <IconBell size={15} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute end-0 top-10 z-30 w-[min(300px,80vw)] rounded-2xl border border-line bg-surface p-2 shadow-float">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">{tr("notif.activity")}</p>
            {recent.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-ink-mute">{tr("notif.empty")}</p>
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
                      className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-start hover:bg-paper"
                    >
                      <StatusChip status={item.status} compact />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold">{item.title ?? item.prompt}</span>
                        <span className="block text-[11px] text-ink-mute">
                          {item.status === "ready"
                            ? tr("notif.ready")
                            : item.status === "processing"
                              ? tr("notif.processing")
                              : item.error ?? tr("notif.failed")}{" "}
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

export function AccountMenu({
  viewer,
  demoMode,
  onSettings,
}: {
  viewer: StudioViewer | null;
  demoMode: boolean;
  onSettings?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  if (!viewer) {
    if (demoMode) return <span className="chip bg-amber-100 text-amber-800">{t("nav.demo")}</span>;
    return (
      <div className="flex items-center gap-1.5">
        <Link href="/connexion" className="btn tap !px-3 !py-1.5 !text-xs text-fg/85 hover:bg-fg/10 hover:text-fg">
          {t("nav.login")}
        </Link>
        <Link href="/connexion?mode=inscription" className="btn-fg tap !px-3.5 !py-1.5 !text-xs">
          {t("nav.signup")}
        </Link>
      </div>
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
        className="tap flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-0.5 text-fg/75 hover:text-fg"
        aria-label={t("menu.account")}
        aria-expanded={open}
      >
        <IconChevronDown size={14} />
        {viewer.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewer.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-fg/20" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-from to-brand-to text-[11px] font-bold text-white ring-2 ring-fg/20">
            {initials || "?"}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div {...dropdown} className="absolute end-0 top-11 z-30 w-60 rounded-2xl border border-line bg-surface p-2 shadow-float">
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-[11px] text-ink-mute">{viewer.email}</p>
              {viewer.role === "admin" && <span className="chip mt-1.5 bg-night text-white">{t("menu.administrator")}</span>}
            </div>
            <div className="my-1 h-px bg-line" />
            <Link href="/espace" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-paper">
              <IconUser size={15} /> {t("nav.space")}
            </Link>
            {viewer.role === "admin" && (
              <Link href="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-paper">
                <IconShield size={15} /> {t("menu.administration")}
              </Link>
            )}
            {onSettings && (
              <button
                type="button"
                onClick={() => {
                  onSettings();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm hover:bg-paper"
              >
                <IconSettings size={15} /> {t("tab.settings")}
              </button>
            )}
            <form action={signOut}>
              <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-sm text-rose-600 hover:bg-rose-50">
                <IconLogout size={15} /> {t("menu.logout")}
              </button>
            </form>
            <button type="button" onClick={() => setOpen(false)} className="sr-only">
              <IconX /> {t("menu.close")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
