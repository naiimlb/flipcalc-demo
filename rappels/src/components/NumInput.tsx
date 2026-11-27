"use client";

import { useRef, type InputHTMLAttributes } from "react";
import { cleanAmount, MAX_QTY, parseQuantity, quantityText } from "@/lib/numeric";

// Champs numériques de l'app. type="text" (jamais "number" : flèches parasites et bugs iOS) avec le pavé numérique
// de l'iPhone, tout le contenu sélectionné au toucher, et seulement des chiffres. Taille de police ≥ 16 px : iOS ne
// zoome pas la page. L'attribut data-num les relie à la barre « Précédent / Suivant / OK » (NumKeyboardBar).
type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode" | "pattern" | "min" | "max">;

function useSelectOnFocus() {
  const fresh = useRef(false);
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      fresh.current = true;
      el.select();
      const v = el.value;
      // iOS efface parfois la sélection juste après le focus : on la remet, sauf si tu as déjà commencé à taper.
      setTimeout(() => {
        if (el.value === v && document.activeElement === el) el.select();
      }, 0);
    },
    // Le « relâchement du doigt » qui suit le premier toucher ne doit pas replacer le curseur (donc désélectionner).
    onMouseUp: (e: React.MouseEvent<HTMLInputElement>) => {
      if (fresh.current) e.preventDefault();
      fresh.current = false;
    },
  };
}

/** Quantité entière (billets, pièces, minutes…) : chiffres seulement, sans zéros devant, 0 si vide, 9999 au plus. */
export function IntInput({ value, onChange, max = MAX_QTY, ...rest }: Base & { value: number; onChange: (n: number) => void; max?: number }) {
  const sel = useSelectOnFocus();
  return (
    <input
      {...rest}
      {...sel}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      autoCorrect="off"
      data-num=""
      value={quantityText(value)}
      onChange={(e) => onChange(parseQuantity(e.target.value, max))}
    />
  );
}

/** Montant en euros (fond de caisse, montant attendu) : chiffres et une virgule, 2 décimales. Valeur = texte saisi. */
export function AmountInput({ value, onChange, ...rest }: Base & { value: string; onChange: (s: string) => void }) {
  const sel = useSelectOnFocus();
  return (
    <input
      {...rest}
      {...sel}
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      autoComplete="off"
      autoCorrect="off"
      data-num=""
      value={value}
      onChange={(e) => onChange(cleanAmount(e.target.value))}
    />
  );
}
