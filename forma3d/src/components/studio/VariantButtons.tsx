"use client";

import { VARIANT_IDS, VARIANTS, type VariantId } from "@/lib/design/variants";
import { IconCoin, IconLayers, IconMinus, IconSparkles } from "../icons";

const ICONS: Record<VariantId, React.ReactNode> = {
  smaller: <IconMinus size={14} />,
  stronger: <IconLayers size={14} />,
  cheaper: <IconCoin size={14} />,
  prettier: <IconSparkles size={14} />,
};

/** « Plus petit », « Plus solide », « Moins cher », « Plus esthétique » : chaque bouton crée une nouvelle version. */
export function VariantButtons({
  onAdjust,
  onCompare,
  disabled,
  canCompare,
}: {
  onAdjust(variant: VariantId): void;
  onCompare?: () => void;
  disabled: boolean;
  canCompare: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5">
        {VARIANT_IDS.map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onAdjust(id)}
            title={`Créer une nouvelle version : ${VARIANTS[id].label.toLowerCase()}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-2 py-2 text-[11.5px] font-semibold text-ink-soft transition hover:border-brand-accent/50 hover:text-brand-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ICONS[id]}
            {VARIANTS[id].label}
          </button>
        ))}
      </div>
      {onCompare && (
        <button
          type="button"
          onClick={onCompare}
          disabled={!canCompare}
          className="btn-outline-accent mt-2 w-full !rounded-xl !py-2 !text-xs"
          title={canCompare ? "Comparer deux versions côte à côte" : "Il faut au moins deux conceptions pour comparer"}
        >
          Comparer deux versions
        </button>
      )}
    </div>
  );
}
