"use client";

import { useEffect, useRef, useState } from "react";
import { neighbour, scrollDelta } from "@/lib/numeric";

const BAR_H = 48; // px, hauteur de la barre

const numFields = (scope: ParentNode) =>
  [...scope.querySelectorAll<HTMLInputElement>("input[data-num]")].filter((el) => !el.disabled && !el.readOnly && el.offsetParent !== null);
const isNum = (el: Element | null): el is HTMLInputElement => !!el && el.tagName === "INPUT" && el.hasAttribute("data-num");

/**
 * Barre « Précédent · Suivant · OK » collée au-dessus du clavier numérique (le pavé de l'iPhone n'a pas de touche
 * « Suivant »). Elle suit le clavier grâce à visualViewport, fait défiler la page pour que le champ actif ne soit
 * jamais caché (ni par le clavier, ni par la barre, ni par le bloc de totaux marqué data-kb-totals), et publie la
 * hauteur du clavier dans des variables CSS (--kb-h, --kb-offset) que les pages peuvent utiliser.
 * Elle n'apparaît que sur écran tactile.
 */
export function NumKeyboardBar() {
  const [active, setActive] = useState<HTMLInputElement | null>(null);
  const [offset, setOffset] = useState(0);
  const activeRef = useRef<HTMLInputElement | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    const touch = () => window.matchMedia("(pointer: coarse)").matches;
    const root = document.documentElement;

    const ensureVisible = () => {
      const el = activeRef.current;
      if (!el || !el.isConnected) return;
      const vv = window.visualViewport;
      const viewTop = vv?.offsetTop ?? 0;
      const viewBottom = viewTop + (vv?.height ?? window.innerHeight);
      const totals = document.querySelector<HTMLElement>("[data-kb-totals]");
      const totalsH = totals ? totals.getBoundingClientRect().height : 0;
      const d = scrollDelta(el.getBoundingClientRect(), { top: viewTop, bottom: viewBottom - BAR_H - totalsH });
      if (Math.abs(d) > 1) window.scrollBy({ top: d, behavior: "auto" });
    };

    const measure = () => {
      const vv = window.visualViewport;
      const layoutH = root.clientHeight;
      const h = vv ? Math.max(0, layoutH - vv.height) : 0;
      const off = vv ? Math.max(0, layoutH - vv.height - vv.offsetTop) : 0;
      root.style.setProperty("--kb-h", `${Math.round(h > 80 ? h : 0)}px`);
      root.style.setProperty("--kb-offset", `${Math.round(h > 80 ? off : 0)}px`);
      setOffset(h > 80 ? off : 0);
    };
    const onViewport = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        measure();
        ensureVisible();
      });
    };

    const set = (el: HTMLInputElement | null) => {
      activeRef.current = el;
      setActive(el);
      if (el) root.setAttribute("data-kb", "");
      else {
        root.removeAttribute("data-kb");
        root.style.setProperty("--kb-h", "0px");
        root.style.setProperty("--kb-offset", "0px");
        setOffset(0);
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Element | null;
      if (!isNum(t) || !touch()) return;
      set(t);
      onViewport();
      // Le clavier met un moment à s'ouvrir : on recale pendant son animation.
      for (const ms of [120, 350, 700]) setTimeout(onViewport, ms);
    };
    const onFocusOut = () => {
      // Passer à un autre champ numérique ne doit pas fermer la barre : on attend de voir où part le focus.
      setTimeout(() => {
        if (!isNum(document.activeElement)) set(null);
      }, 60);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.visualViewport?.addEventListener("resize", onViewport);
    window.visualViewport?.addEventListener("scroll", onViewport);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.visualViewport?.removeEventListener("resize", onViewport);
      window.visualViewport?.removeEventListener("scroll", onViewport);
      cancelAnimationFrame(raf.current);
      root.removeAttribute("data-kb");
    };
  }, []);

  if (!active) return null;
  const scope = active.closest<HTMLElement>("[data-num-scope]") ?? document;
  const list = numFields(scope);
  const prev = neighbour(list, active, -1);
  const next = neighbour(list, active, 1);
  const go = (el: HTMLInputElement | null) => el?.focus(); // le focus passe de case en case : le clavier reste ouvert

  const btn = "flex min-h-12 flex-1 items-center justify-center text-[15px] font-extrabold disabled:opacity-35";
  return (
    <div
      role="toolbar"
      aria-label="Navigation entre les cases"
      data-kb-bar=""
      className="fixed inset-x-0 z-40 border-t border-line bg-white shadow-[0_-6px_18px_-8px_rgb(20_20_20/0.25)]"
      style={{ bottom: offset, height: BAR_H }}
      // Un appui sur la barre ne doit pas retirer le focus du champ (sinon le clavier se fermerait).
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => {
        if ((e.target as HTMLElement).closest("button")) e.preventDefault();
      }}
    >
      <div className="mx-auto flex h-full max-w-[430px] items-stretch divide-x divide-line">
        <button type="button" disabled={!prev} onClick={() => go(prev)} className={`${btn} text-pink-deep`}>‹ Précédent</button>
        <button type="button" disabled={!next} onClick={() => go(next)} className={`${btn} text-pink-deep`}>Suivant ›</button>
        <button type="button" onClick={() => active.blur()} className={`${btn} bg-pink text-white`}>OK</button>
      </div>
    </div>
  );
}
