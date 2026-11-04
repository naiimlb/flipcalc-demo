"use client";

import type { RequestItem } from "@/lib/requests";
import { IconHistory } from "../../icons";
import { useT } from "../../app/Preferences";

/**
 * Barre du bas de l'éditeur : historique des versions du projet ouvert (même demande : version d'origine,
 * « plus petit », « plus solide »…) puis la barre de saisie.
 */
export function BottomBar({
  item,
  items,
  onSelect,
  onCompare,
  children,
}: {
  item: RequestItem | null;
  items: RequestItem[];
  onSelect(id: string): void;
  onCompare?: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  const versions = item ? items.filter((i) => i.prompt === item.prompt && (i.design || i.status === "processing")).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  return (
    <div className="relative z-20 flex flex-col gap-1.5 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-1 sm:px-3 lg:flex-row lg:items-end">
      {versions.length > 0 && (
        <nav aria-label={t("editor.versions")} className="flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-none lg:max-w-[38%] lg:pb-2">
          <span className="flex shrink-0 items-center gap-1 pe-1 text-[11px] font-semibold text-fg/60">
            <IconHistory size={13} /> {t("editor.versions")}
          </span>
          {versions.map((v, i) => {
            const current = v.id === item?.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                aria-current={current ? "true" : undefined}
                title={v.title ?? v.prompt}
                className={`tap flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11.5px] font-semibold transition ${
                  current ? "bg-neon-blue-strong text-white" : "bg-fg/[0.06] text-fg/75 hover:bg-fg/10 hover:text-fg"
                }`}
              >
                v{i + 1}
                {v.design?.variante && <span className="max-w-[7rem] truncate font-medium opacity-80">· {t(`variant.${v.design.variante.objectif}`)}</span>}
              </button>
            );
          })}
          {onCompare && versions.length > 1 && (
            <button type="button" onClick={onCompare} className="tap h-8 shrink-0 rounded-lg px-2.5 text-[11.5px] font-semibold text-neon-blue hover:bg-neon-blue/10">
              {t("editor.compare")}
            </button>
          )}
        </nav>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
