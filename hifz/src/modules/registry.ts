import type { AppModule, ModuleTab } from "@/modules/types";
import { assistantModule } from "@/modules/assistant/manifest";
import { hifzModule } from "@/modules/hifz/manifest";
import { quotidienModule } from "@/modules/quotidien/manifest";

/** Tous les modules connus, dans l'ordre d'affichage. */
export const modules: readonly AppModule[] = [hifzModule, assistantModule, quotidienModule];

export const activeModules = modules.filter((m) => m.status === "active");
export const plannedModules = modules.filter((m) => m.status === "planned");

/** Onglets : « Aujourd'hui » (commun), ceux des modules actifs, puis « Réglages ». */
export const tabs: readonly ModuleTab[] = [
  { href: "/", label: "Aujourd'hui", icon: "today" },
  ...activeModules.flatMap((m) => m.tabs),
  { href: "/reglages", label: "Réglages", icon: "settings" },
];

/** Onglet actif pour un chemin donné (le plus long préfixe gagne). */
export function activeTab(pathname: string): ModuleTab | undefined {
  const matches = tabs.filter((t) =>
    t.href === "/" ? pathname === "/" : pathname === t.href || pathname.startsWith(`${t.href}/`),
  );
  return matches.sort((a, b) => b.href.length - a.href.length)[0];
}
