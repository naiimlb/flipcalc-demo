"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type { DayActivity } from "@/lib/stats";

const H = 120;
const GAP = 2;
const MAX_BAR = 24;

const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", opts).format(new Date(y!, m! - 1, d!));
};

function niceMax(n: number): number {
  if (n <= 5) return Math.max(1, n);
  const step = n <= 20 ? 5 : n <= 50 ? 10 : 25;
  return Math.ceil(n / step) * step;
}

/**
 * Révisions par jour (colonnes, une seule série : pas de légende, le titre la nomme).
 * Toucher, survoler ou utiliser les flèches pour lire une journée ; tableau complet en dessous.
 */
export function ActivityChart({ activity }: { activity: DayActivity[] }) {
  const [selected, setSelected] = useState(activity.length - 1);
  const max = niceMax(Math.max(0, ...activity.map((a) => a.count)));
  const n = activity.length;
  const current = activity[Math.min(selected, n - 1)];

  // Coordonnées en unités du viewBox (largeur 300).
  const W = 300;
  const band = W / n;
  const barW = Math.min(MAX_BAR, band - GAP);

  function pick(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    setSelected(Math.max(0, Math.min(n - 1, i)));
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowLeft") setSelected((s) => Math.max(0, s - 1));
    else if (e.key === "ArrowRight") setSelected((s) => Math.min(n - 1, s + 1));
    else return;
    e.preventDefault();
  }

  return (
    <figure>
      <div className="flex items-baseline justify-between" aria-live="polite">
        <p className="text-[15px]">
          <strong className="text-lg tabular-nums">{current?.count ?? 0}</strong>{" "}
          <span className="text-muted">révision{(current?.count ?? 0) > 1 ? "s" : ""}</span>
        </p>
        <p className="text-sm text-muted">{current ? dayLabel(current.day, { weekday: "long", day: "numeric", month: "long" }) : null}</p>
      </div>
      <div className="relative mt-3">
        <span className="absolute -top-1 left-0 text-[11px] tabular-nums text-muted">{max}</span>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-32 w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-accent"
          role="img"
          aria-label={`Révisions par jour sur ${n} jours. Flèches gauche et droite pour lire chaque jour.`}
          tabIndex={0}
          onPointerDown={pick}
          onPointerMove={(e) => e.pointerType === "mouse" && pick(e)}
          onKeyDown={onKey}
        >
          <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {activity.map((a, i) => {
            if (a.count === 0) return null;
            const h = Math.max(3, (a.count / max) * (H - 14));
            const x = i * band + (band - barW) / 2;
            const r = Math.min(4, barW / 2, h);
            const y = H - h;
            // Coins arrondis en haut seulement (le bas reste carré sur la ligne de base).
            const d = `M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${H} Z`;
            return <path key={a.day} d={d} fill="var(--accent)" opacity={i === selected ? 1 : 0.72} />;
          })}
          {current ? (
            <rect x={selected * band} y={0} width={band} height={H} fill="var(--ink)" opacity={0.05} pointerEvents="none" />
          ) : null}
        </svg>
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>{activity[0] ? dayLabel(activity[0].day, { day: "numeric", month: "short" }) : null}</span>
          <span>aujourd&apos;hui</span>
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="min-h-10 cursor-pointer py-2 font-medium text-accent">Voir le détail jour par jour</summary>
        <table className="w-full text-left">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 font-medium">Jour</th>
              <th scope="col" className="py-1 text-right font-medium">Révisions</th>
            </tr>
          </thead>
          <tbody>
            {[...activity].reverse().map((a) => (
              <tr key={a.day} className="border-t border-line">
                <td className="py-1.5">{dayLabel(a.day, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td className="py-1.5 text-right tabular-nums">{a.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
