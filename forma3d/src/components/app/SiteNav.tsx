"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m as motion } from "framer-motion";
import { AccountMenu } from "../studio/TopBar";
import type { StudioViewer } from "../studio/types";
import { IconX, LogoMark } from "../icons";
import { CreditsBadge, type CreditsSnapshot } from "./CreditsBadge";
import { PreferenceMenuButton } from "./PreferencePicker";
import { useT } from "./Preferences";

const LINKS = [
  { href: "/", key: "nav.home", match: (p: string) => p === "/" },
  { href: "/studio", key: "nav.editor", match: (p: string) => p.startsWith("/studio") },
  { href: "/galerie", key: "nav.gallery", match: (p: string) => p.startsWith("/galerie") },
  { href: "/espace", key: "nav.space", match: (p: string) => p.startsWith("/espace") },
] as const;

/**
 * Navigation minimale du site : Accueil, Éditeur, Galerie, Mon espace, crédits, thème/langue et avatar.
 * « floating » : posée au-dessus de la page, elle se réduit et prend un fond flouté au défilement.
 * « bar » : dans le flux de la page (éditeur), toujours compacte.
 */
export function SiteNav({
  siteName,
  logoDataUrl,
  viewer,
  demoMode,
  credits,
  variant = "floating",
}: {
  siteName: string;
  logoDataUrl: string | null;
  viewer: StudioViewer | null;
  demoMode: boolean;
  credits: CreditsSnapshot | null;
  variant?: "floating" | "bar";
}) {
  const t = useT();
  const pathname = usePathname() ?? "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const floating = variant === "floating";

  useEffect(() => {
    if (!floating) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [floating]);

  // Le menu mobile se ferme en changeant de page ou avec Échap.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const compact = !floating || scrolled;
  const links = LINKS.filter((l) => l.href !== "/espace" || viewer || !demoMode);

  return (
    <header
      className={
        floating
          ? `fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
              compact ? "bg-canvas/75 shadow-[0_1px_0_rgb(var(--fg)/0.08)] backdrop-blur-xl" : "bg-transparent"
            }`
          : "relative z-30"
      }
      style={floating ? { paddingTop: "env(safe-area-inset-top)" } : undefined}
    >
      <div
        className={`flex w-full items-center gap-2 px-4 transition-[height] duration-300 sm:px-6 lg:px-8 ${compact ? "h-14" : "h-[72px]"}`}
      >
        <Link href="/" className="tap flex shrink-0 items-center gap-2 rounded-full pe-2 font-semibold text-fg" aria-label={siteName}>
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="" className="h-7 w-7 rounded-lg object-contain" />
          ) : (
            <LogoMark size={compact ? 24 : 28} />
          )}
          <span className="text-[15px] font-bold tracking-tight">{siteName}</span>
        </Link>

        <nav aria-label={t("nav.main")} className="mx-auto hidden md:block">
          <ul className="flex items-center gap-1 rounded-full bg-fg/[0.05] p-1 ring-1 ring-inset ring-fg/10">
            {links.map((l) => {
              const active = l.match(pathname);
              return (
                <li key={l.href} className="relative">
                  {active && (
                    <motion.span
                      layoutId="site-nav-active"
                      className="absolute inset-0 rounded-full bg-fg"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`tap relative flex h-9 items-center rounded-full px-4 text-[13px] font-semibold transition-colors ${
                      active ? "text-canvas" : "text-fg/70 hover:text-fg"
                    }`}
                  >
                    {t(l.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-1 md:ms-0">
          {credits && <CreditsBadge initial={credits} />}
          <PreferenceMenuButton />
          {viewer?.role === "admin" && (
            <Link href="/admin" className="btn tap hidden !px-3 !py-1.5 !text-xs text-fg/80 hover:bg-fg/10 hover:text-fg lg:inline-flex">
              {t("nav.admin")}
            </Link>
          )}
          {viewer ? (
            <AccountMenu viewer={viewer} demoMode={demoMode} />
          ) : (
            <div className="hidden sm:block">
              <AccountMenu viewer={viewer} demoMode={demoMode} />
            </div>
          )}
          <button
            type="button"
            className="tap flex h-10 w-10 items-center justify-center rounded-full text-fg hover:bg-fg/10 md:hidden"
            aria-label={t("nav.menu")}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <IconX size={18} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 8h16M4 16h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="site-menu"
            aria-label={t("nav.main")}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-full border-b border-fg/10 bg-canvas/95 px-4 pb-4 pt-2 backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col">
              {links.map((l) => {
                const active = l.match(pathname);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-12 items-center rounded-2xl px-4 text-lg font-bold tracking-tight ${active ? "bg-fg/10 text-fg" : "text-fg/75"}`}
                    >
                      {t(l.key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {!viewer && !demoMode && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/connexion" className="btn-line min-h-11">
                  {t("nav.login")}
                </Link>
                <Link href="/connexion?mode=inscription" className="btn-neon min-h-11">
                  {t("nav.signup")}
                </Link>
              </div>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
