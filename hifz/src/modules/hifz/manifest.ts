import type { AppModule } from "@/modules/types";

export const hifzModule: AppModule = {
  id: "hifz",
  title: "Hifz",
  summary: "Mémoriser le Coran verset par verset, avec révisions espacées.",
  status: "active",
  basePath: "/hifz",
  tabs: [
    { href: "/hifz/programme", label: "Programme", icon: "book" },
    { href: "/hifz/suivi", label: "Suivi", icon: "chart" },
  ],
};
