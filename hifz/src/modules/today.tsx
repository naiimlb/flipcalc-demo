import type { ComponentType } from "react";
import { HifzTodayCard } from "@/modules/hifz/TodayCard";

/** Carte affichée par chaque module actif sur l'écran « Aujourd'hui ». */
export const todayCards: Record<string, ComponentType> = {
  hifz: HifzTodayCard,
};
