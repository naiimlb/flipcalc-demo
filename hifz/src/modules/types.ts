import type { IconName } from "@/components/icons";

/** Une entrée de la barre d'onglets. */
export interface ModuleTab {
  href: string;
  label: string;
  icon: IconName;
}

/**
 * Description d'un module de l'application (hifz, futur assistant, compagnon du quotidien…).
 * Un module est une simple déclaration : ses écrans vivent sous `src/app/<basePath>` et son
 * code sous `src/modules/<id>`. Ajouter un module = un dossier + une ligne dans `registry.ts`.
 */
export interface AppModule {
  id: string;
  title: string;
  summary: string;
  status: "active" | "planned";
  basePath: string;
  tabs: ModuleTab[];
}
