import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getAuthProviders } from "@/lib/auth-providers";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string; erreur?: string }>;
}) {
  // Démonstration (aperçu sans base de données) : on explique au lieu de renvoyer en silence vers l'accueil.
  if (isDemoMode()) {
    const { site } = await getPublicSettings();
    return (
      <AuthShell siteName={site.siteName} logoDataUrl={site.logoDataUrl} title="Connexion indisponible ici">
        <p className="text-base text-ink-soft">
          Cet aperçu est une démonstration : il n&apos;est relié à aucune base de données, donc la création de compte et la connexion y sont
          désactivées. Sur le site en ligne, ce bouton ouvre la connexion normalement.
        </p>
        <Link href="/" className="btn-primary mt-6 min-h-11 w-full !text-base">
          Revenir à l&apos;accueil
        </Link>
      </AuthShell>
    );
  }

  const [{ site, features }, providers] = await Promise.all([getPublicSettings(), getAuthProviders()]);
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/studio";

  return (
    <AuthShell
      siteName={site.siteName}
      logoDataUrl={site.logoDataUrl}
      title="Bienvenue"
      subtitle="Votre espace : vos demandes, modèles 3D et préférences, sur tous vos appareils."
    >
      {params.erreur === "google" && (
        <p className="mb-4 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">Connexion Google impossible pour le moment.</p>
      )}
      {params.erreur === "lien" && (
        <p className="mb-4 rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">Lien expiré ou invalide : reconnectez-vous.</p>
      )}
      <AuthForm initialMode={params.mode === "inscription" ? "signup" : "login"} next={next} signupsOpen={features.signupsOpen}
        googleEnabled={providers.google}
      />
    </AuthShell>
  );
}
