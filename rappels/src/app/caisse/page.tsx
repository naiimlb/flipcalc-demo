"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/Skeleton";
import { cashTotals, computeGap, formatDenomination, formatEuro, plural, toCents } from "@/lib/money";
import { useAppState } from "@/lib/store";

// Comptage guidé : tous les calculs sont faits par le code, en centimes (src/lib/money.ts). Aucun arrondi.
const BILLS = [20000, 10000, 5000, 2000, 1000, 500]; // 200 € → 5 € (le 500 € est masqué par défaut)
const BILL_500 = 50000;
const COINS = [200, 100, 50, 20, 10, 5, 2, 1]; // 2 € → 0,01 €

type Saved = { q: Record<string, number>; fond: string; attendu: string; show500: boolean };
const storageKey = (uid: string) => `hb-caisse:${uid}`;

/** Dernier comptage de CET utilisateur (gardé sur ce téléphone pour ne rien perdre en quittant l'écran). */
function loadSaved(uid: string): Saved {
  try {
    const d = JSON.parse(localStorage.getItem(storageKey(uid)) ?? "null") as Partial<Saved> | null;
    if (d && typeof d === "object") {
      const q: Record<string, number> = {};
      for (const [k, v] of Object.entries(d.q ?? {})) if (Number.isInteger(v) && v > 0 && v <= 9999) q[k] = v;
      return { q, fond: typeof d.fond === "string" ? d.fond : "", attendu: typeof d.attendu === "string" ? d.attendu : "", show500: d.show500 === true };
    }
  } catch {
    /* données illisibles : on repart de zéro */
  }
  return { q: {}, fond: "", attendu: "", show500: false };
}

export default function CashCountPage() {
  const state = useAppState();
  if (!state) return <Skeleton />;
  return <CashCounter uid={state.profile.id} />;
}

function CashCounter({ uid }: { uid: string }) {
  const [saved] = useState(() => loadSaved(uid));
  const [qty, setQty] = useState<Record<string, number>>(saved.q);
  const [fondRaw, setFondRaw] = useState(saved.fond);
  const [attenduRaw, setAttenduRaw] = useState(saved.attendu);
  const [show500, setShow500] = useState(saved.show500);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify({ q: qty, fond: fondRaw, attendu: attenduRaw, show500 } satisfies Saved));
    } catch {
      /* stockage plein ou indisponible : sans gravité */
    }
  }, [uid, qty, fondRaw, attenduRaw, show500]);

  const get = (d: number) => qty[d] ?? 0;
  const setQuantity = (d: number, n: number) => setQty((q) => ({ ...q, [d]: Math.max(0, Math.min(9999, n)) }));
  const { bills, coins, total } = cashTotals(Object.entries(qty).map(([d, quantity]) => ({ denomination: Number(d), quantity })));

  const fondText = fondRaw.trim();
  const attenduText = attenduRaw.trim();
  const fond = fondText ? toCents(fondText) : null;
  const attendu = attenduText ? toCents(attenduText) : null;
  const recette = total - (fond ?? 0);
  const gap = attendu !== null ? computeGap(recette, attendu) : null;
  const bills500 = show500 || get(BILL_500) > 0;

  function reset() {
    if (!window.confirm("Tout remettre à zéro ? Le comptage en cours sera effacé.")) return;
    setQty({});
    setFondRaw("");
    setAttenduRaw("");
  }

  const row = (d: number) => {
    const q = get(d);
    return (
      <li key={d} className="flex items-center gap-2 py-1.5">
        <span className="w-[4.25rem] shrink-0 text-lg font-extrabold tabular-nums">{formatDenomination(d)}</span>
        <button type="button" aria-label={`Moins un ${formatDenomination(d)}`} onClick={() => setQuantity(d, q - 1)} className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white text-2xl font-bold active:bg-pink-soft">−</button>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={`Quantité de ${formatDenomination(d)}`}
          value={q === 0 ? "" : q}
          placeholder="0"
          onChange={(e) => setQuantity(d, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0)}
          onFocus={(e) => e.currentTarget.select()}
          className="h-11 w-16 min-w-0 rounded-2xl border-2 border-line bg-white text-center text-[17px] font-extrabold focus:border-pink"
        />
        <button type="button" aria-label={`Plus un ${formatDenomination(d)}`} onClick={() => setQuantity(d, q + 1)} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pink text-2xl font-bold text-white active:scale-95">+</button>
        <span className={`ml-auto min-w-0 text-right text-[13px] font-bold leading-tight tabular-nums ${q ? "text-ink" : "text-mute/60"}`}>
          {q > 0 ? `${q} × ${formatDenomination(d)} = ${formatEuro(d * q)}` : "0,00 €"}
        </span>
      </li>
    );
  };

  const fieldCls = "h-12 min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-3 text-[17px] font-bold focus:border-pink";

  return (
    <>
      <Header title="Compter la caisse" />

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="h-street text-xl">Billets</h2>
          <button type="button" aria-pressed={bills500} disabled={get(BILL_500) > 0} onClick={() => setShow500((v) => !v)} className="min-h-11 rounded-full border-2 border-line px-3 text-xs font-bold disabled:opacity-60">
            {bills500 ? "Masquer le 500 €" : "Afficher le 500 €"}
          </button>
        </div>
        <ul className="divide-y divide-line">{(bills500 ? [BILL_500, ...BILLS] : BILLS).map(row)}</ul>
      </section>

      <section className="mb-4 rounded-3xl bg-white p-4 shadow-card">
        <h2 className="h-street mb-1 text-xl">Pièces</h2>
        <ul className="divide-y divide-line">{COINS.map(row)}</ul>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-card">
        <h2 className="h-street mb-1 text-xl">Fond de caisse et ticket Z</h2>
        <p className="mb-3 text-xs font-medium text-mute">Optionnel : le fond de caisse est déduit du total pour obtenir la recette.</p>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label htmlFor="fond" className="w-28 shrink-0 text-sm font-extrabold leading-tight">Fond de caisse (€)</label>
            <input id="fond" inputMode="decimal" value={fondRaw} onChange={(e) => setFondRaw(e.target.value)} placeholder="150,00" className={fieldCls} />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="attendu" className="w-28 shrink-0 text-sm font-extrabold leading-tight">Montant attendu (€)</label>
            <input id="attendu" inputMode="decimal" value={attenduRaw} onChange={(e) => setAttenduRaw(e.target.value)} placeholder="ticket Z, espèces" className={fieldCls} />
          </div>
          {((fondText && fond === null) || (attenduText && attendu === null)) && (
            <p role="alert" className="rounded-2xl bg-ink px-3 py-2 text-sm font-bold text-white">Montant illisible : écris par exemple 250,50</p>
          )}
        </div>
      </section>

      <button type="button" onClick={reset} className="mt-4 min-h-12 w-full rounded-full border-2 border-ink/15 bg-white text-base font-bold">
        Tout remettre à zéro
      </button>
      <div className="h-72" aria-hidden />

      <div className="fixed inset-x-0 z-20" style={{ bottom: "calc(3.5rem + max(env(safe-area-inset-bottom), 0.5rem) + 1px)" }}>
        <div className="mx-auto max-w-[430px] px-3 pb-2">
          <div className="rounded-3xl bg-white p-3 shadow-pop ring-2 ring-pink" aria-label="Résumé du comptage">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[15px]">
              <dt className="font-bold text-mute">Total billets</dt>
              <dd className="text-right font-extrabold tabular-nums">{formatEuro(bills.total)} <span className="text-xs font-semibold text-mute">· {plural(bills.count, "billet")}</span></dd>
              <dt className="font-bold text-mute">Total pièces</dt>
              <dd className="text-right font-extrabold tabular-nums">{formatEuro(coins.total)} <span className="text-xs font-semibold text-mute">· {plural(coins.count, "pièce")}</span></dd>
            </dl>
            <div className="mt-1 flex items-end justify-between border-t-2 border-line pt-1">
              <p className="text-xs font-extrabold uppercase tracking-wide text-mute">Total caisse</p>
              <p className="h-street text-3xl text-pink" aria-live="polite">{formatEuro(total)}</p>
            </div>
            {fond !== null && fond > 0 && (
              <p className="text-right text-sm font-bold tabular-nums">
                − fond {formatEuro(fond)} = <span className="font-extrabold">recette {formatEuro(recette)}</span>
              </p>
            )}
            {gap && (
              <p
                role="status"
                className={`mt-2 rounded-2xl px-3 py-2 text-[15px] font-extrabold ${
                  gap.kind === "exact"
                    ? "bg-ink text-white"
                    : gap.kind === "shortage"
                      ? "border-[3px] border-pink-deep bg-pink-soft text-pink-deep"
                      : "border-[3px] border-dashed border-ink bg-white text-ink"
                }`}
              >
                {gap.kind === "exact" ? "✅" : gap.kind === "shortage" ? "⬇️" : "⬆️"} {gap.text}
                <span className="ml-1 text-xs font-semibold">(recette {formatEuro(recette)} · attendu {formatEuro(attendu ?? 0)})</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
