"use client";

import { Header } from "@/components/Header";
import { useState } from "react";
import { computeGap, countCash, formatDenomination, formatEuro, toCents } from "@/lib/money";

// Comptage guidé : tous les totaux sont calculés par le code (src/lib/money.ts), jamais par l'IA.
const BILLS = [50000, 20000, 10000, 5000, 2000, 1000, 500];
const COINS = [200, 100, 50, 20, 10, 5, 2, 1];

export default function CashCountPage() {
  const [qty, setQty] = useState<Record<number, number>>({});
  const [expectedRaw, setExpectedRaw] = useState("");

  const setQuantity = (d: number, n: number) => setQty((q) => ({ ...q, [d]: Math.max(0, Math.min(9999, n)) }));
  const { total, pieces } = countCash(Object.entries(qty).map(([d, quantity]) => ({ denomination: Number(d), quantity })));
  const expected = expectedRaw.trim() ? toCents(expectedRaw) : null;
  const gap = expected !== null ? computeGap(total, expected) : null;

  const row = (d: number) => {
    const q = qty[d] ?? 0;
    return (
      <li key={d} className="flex items-center gap-2 py-1.5">
        <span className="w-16 shrink-0 text-lg font-extrabold tabular-nums">{formatDenomination(d)}</span>
        <button type="button" aria-label={`Moins un ${formatDenomination(d)}`} onClick={() => setQuantity(d, q - 1)} className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white text-2xl font-bold active:bg-pink-soft">−</button>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`Nombre de ${formatDenomination(d)}`}
          value={q === 0 ? "" : q}
          placeholder="0"
          onChange={(e) => setQuantity(d, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-16 min-w-0 rounded-2xl border-2 border-line bg-white text-center text-[17px] font-extrabold focus:border-pink"
        />
        <button type="button" aria-label={`Plus un ${formatDenomination(d)}`} onClick={() => setQuantity(d, q + 1)} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pink text-2xl font-bold text-white active:scale-95">+</button>
        <span className={`ml-auto text-right text-[15px] font-bold tabular-nums ${q ? "text-ink" : "text-mute/60"}`}>{formatEuro(d * q)}</span>
      </li>
    );
  };

  return (
    <>
      <Header title="Compter la caisse" />

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <h2 className="h-street mb-1 text-xl">Billets</h2>
        <ul className="divide-y divide-line">{BILLS.map(row)}</ul>
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-card">
        <h2 className="h-street mb-1 text-xl">Pièces</h2>
        <ul className="divide-y divide-line">{COINS.map(row)}</ul>
      </section>
      <button
        type="button"
        onClick={() => {
          setQty({});
          setExpectedRaw("");
        }}
        className="mt-4 min-h-12 w-full rounded-full border-2 border-ink/15 bg-white text-base font-bold"
      >
        Tout remettre à zéro
      </button>
      <div className="h-52" aria-hidden />

      <div className="fixed inset-x-0 z-20" style={{ bottom: "calc(3.5rem + max(env(safe-area-inset-bottom), 0.5rem) + 1px)" }}>
        <div className="mx-auto max-w-[430px] px-3 pb-2">
          <div className="rounded-3xl bg-white p-3 shadow-pop ring-2 ring-pink">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-mute">Total compté</p>
                <p className="h-street text-4xl text-pink" aria-live="polite">{formatEuro(total)}</p>
              </div>
              <p className="pb-1 text-xs font-semibold text-mute">{pieces} billet{pieces > 1 ? "s" : ""}/pièce{pieces > 1 ? "s" : ""}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="expected" className="shrink-0 text-xs font-extrabold uppercase leading-tight tracking-wide">Attendu<br />(€)</label>
              <input
                id="expected"
                inputMode="decimal"
                value={expectedRaw}
                onChange={(e) => setExpectedRaw(e.target.value)}
                placeholder="Ticket Z + fond"
                className="h-11 min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-3 text-[16px] font-bold focus:border-pink"
              />
            </div>
            {expectedRaw.trim() && expected === null && <p className="mt-2 text-sm font-bold text-pink-deep">Montant illisible : écris par exemple 250,50</p>}
            {gap && (
              <p
                role="status"
                className={`mt-2 rounded-2xl px-3 py-2 text-[15px] font-extrabold ${gap.kind === "exact" ? "bg-ink text-white" : "bg-pink-soft text-pink-deep"}`}
              >
                {gap.kind === "exact" ? "✅" : gap.kind === "surplus" ? "⬆️" : "⬇️"} {gap.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
