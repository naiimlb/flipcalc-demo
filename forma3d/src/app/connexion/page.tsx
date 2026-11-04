import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  if (isDemoMode()) redirect("/");

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
