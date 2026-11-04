"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, m as motion } from "framer-motion";
import { AccountMenu } from "../studio/TopBar";
import type { StudioViewer } from "../studio/types";
import { IconMenu, IconX, LogoMark } from "../icons";
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
          ? `fixed inset-x-0 top-0 z-50 border-b transition-colors duration-150 ${compact ? "border-line bg-canvas/95" : "border-transparent bg-canvas/0"}`
          : "relative z-30"
      }
      style={floating ? { paddingTop: "env(safe-area-inset-top)" } : undefined}
    >
      <div
        className="flex h-14 w-full items-center gap-2 px-4 sm:px-6 lg:px-8"
      >
        <Link href="/" className="tap flex shrink-0 items-center gap-2 rounded-md pe-2 text-ink" aria-label={siteName}>
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="" className="h-6 w-6 rounded object-contain" />
          ) : (
            <LogoMark size={22} />
          )}
          <span className="text-base font-semibold">{siteName}</span>
        </Link>

        <nav aria-label={t("nav.main")} className="mx-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => {
              const active = l.match(pathname);
              return (
                <li key={l.href} className="relative">
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`tap relative flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                      active ? "bg-paper text-ink" : "text-ink-mute hover:bg-paper/60 hover:text-ink"
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
            <Link href="/admin" className="btn-subtle tap hidden lg:inline-flex">
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
            className="icon-btn tap md:hidden"
            aria-label={t("nav.menu")}
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <IconX size={18} />
            ) : (
              <IconMenu />
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
            className="absolute inset-x-0 top-full border-b border-line bg-canvas px-4 pb-4 pt-2 md:hidden"
          >
            <ul className="flex flex-col">
              {links.map((l) => {
                const active = l.match(pathname);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center rounded-md px-3 text-base font-medium ${active ? "bg-paper text-ink" : "text-ink-soft"}`}
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
