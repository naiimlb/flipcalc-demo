import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { getPublicSettings } from "@/lib/settings.server";
import { ResetRequestForm } from "./ResetRequestForm";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  const { site } = await getPublicSettings();
  return (
    <AuthShell
      siteName={site.siteName}
      logoDataUrl={site.logoDataUrl}
      title="Mot de passe oublié"
      subtitle="Recevez un lien pour choisir un nouveau mot de passe."
    >
      <ResetRequestForm />
      <Link href="/connexion" className="mt-4 block text-center text-sm font-semibold text-brand-accent">
        Retour à la connexion
      </Link>
    </AuthShell>
  );
}
