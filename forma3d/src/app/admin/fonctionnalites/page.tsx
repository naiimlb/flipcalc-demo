import { getPublicSettings } from "@/lib/settings.server";
import { AdminTitle } from "../ui";
import { FeaturesForm } from "./FeaturesForm";

export default async function FeaturesPage() {
  const { features } = await getPublicSettings();
  return (
    <div>
      <AdminTitle title="Fonctionnalités" subtitle="Activez ou désactivez les fonctions du site, sans redéploiement." />
      <FeaturesForm initial={features} />
    </div>
  );
}
