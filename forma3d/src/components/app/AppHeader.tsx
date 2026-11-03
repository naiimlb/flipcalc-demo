import { getTranslator } from "@/lib/i18n/server";
import { DEFAULT_SITE } from "@/lib/settings";
import { getMyCredits } from "@/lib/credits";
import { getSession } from "@/lib/supabase/server";
import type { StudioViewer } from "../studio/types";
import { SiteNav } from "./SiteNav";

/**
 * En-tête du site (serveur) : récupère le solde de crédits puis affiche la navigation.
 * Le titre (textes de /admin/apparence) reste présent pour les lecteurs d'écran quand il est fourni.
 */
export async function AppHeader({
  siteName,
  logoDataUrl,
  pill = "",
  title = "",
  line2 = "",
  viewer,
  demoMode,
  variant = "floating",
}: {
  siteName: string;
  logoDataUrl: string | null;
  pill?: string;
  title?: string;
  line2?: string;
  subtitle?: string;
  viewer: StudioViewer | null;
  demoMode: boolean;
  variant?: "floating" | "bar";
}) {
  const { locale, t } = await getTranslator();
  // Textes par défaut traduits ; un texte personnalisé dans /admin/apparence reste tel quel.
  if (locale !== "fr") {
    if (pill === DEFAULT_SITE.heroPill) pill = t("hero.pill");
    if (title === DEFAULT_SITE.heroTitle) title = t("hero.title");
    if (line2 === DEFAULT_SITE.heroTitleLine2) line2 = t("hero.line2");
  }
  // Solde de crédits (phase 5) : affiché en permanence pour les personnes connectées (masqué sans le script SQL).
  const session = viewer ? await getSession() : null;
  const credits = session ? await getMyCredits(session.supabase) : null;
  const heading = [pill, title, line2].filter(Boolean).join(" ");

  return (
    <>
      <SiteNav siteName={siteName} logoDataUrl={logoDataUrl} viewer={viewer} demoMode={demoMode} credits={credits} variant={variant} />
      {heading && <h1 className="sr-only">{heading}</h1>}
    </>
  );
}
