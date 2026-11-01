import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string; erreur?: string }>;
}) {
  if (isDemoMode()) redirect("/");
  const supabase = await getServerSupabase();
  const { data: setupRequired } = (await supabase?.rpc("setup_required")) ?? { data: null };
  if (setupRequired === true) redirect("/setup");

  const { site, features } = await getPublicSettings();
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";

  return (
    <AuthShell
      siteName={site.siteName}
      logoDataUrl={site.logoDataUrl}
      title="Bienvenue"
      subtitle="Connectez-vous pour créer et retrouver vos conceptions 3D."
    >
      {params.erreur === "lien" && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Lien expiré ou invalide : reconnectez-vous.</p>
      )}
      <AuthForm initialMode={params.mode === "inscription" ? "signup" : "login"} next={next} signupsOpen={features.signupsOpen} />
    </AuthShell>
  );
}
