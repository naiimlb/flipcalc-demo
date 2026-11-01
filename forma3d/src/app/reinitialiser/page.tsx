import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { getPublicSettings } from "@/lib/settings.server";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata: Metadata = { title: "Nouveau mot de passe" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const { site } = await getPublicSettings();
  return (
    <AuthShell siteName={site.siteName} logoDataUrl={site.logoDataUrl} title="Nouveau mot de passe">
      <NewPasswordForm />
    </AuthShell>
  );
}
