import { getPublicSettings } from "@/lib/settings.server";
import { AdminTitle } from "../ui";
import { AppearanceForm } from "./AppearanceForm";

export default async function AppearancePage() {
  const { site } = await getPublicSettings();
  return (
    <div>
      <AdminTitle title="Apparence" subtitle="Textes, couleurs et logo du site. L'aperçu se met à jour pendant la saisie." />
      <AppearanceForm initial={site} />
    </div>
  );
}
