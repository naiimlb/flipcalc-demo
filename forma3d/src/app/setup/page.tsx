import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { IconCheck, IconX } from "@/components/icons";
import { getPublicSettings } from "@/lib/settings.server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase, getSession } from "@/lib/supabase/server";
import { ClaimForm, SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Installation" };
export const dynamic = "force-dynamic";

function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? "bg-emerald-500 text-white" : "bg-rose-100 text-rose-600"}`}>
        {ok ? <IconCheck size={12} strokeWidth={3} /> : <IconX size={12} strokeWidth={3} />}
      </span>
      <span>
        {label}
        {hint && <span className="block text-xs text-ink-mute">{hint}</span>}
      </span>
    </li>
  );
}

export default async function SetupPage() {
  const { site } = await getPublicSettings();
  const demo = isDemoMode();
  const service = getServiceSupabase();
  let required: boolean | null = null;
  let dbReady = false;
  if (!demo) {
    const supabase = await getServerSupabase();
    const { data, error } = (await supabase?.rpc("setup_required")) ?? { data: null, error: null };
    dbReady = !error;
    required = data === true;
  }

  const checks = (
    <ul className="mb-6 space-y-2 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <Check ok={!demo} label="Supabase configuré" hint={demo ? "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" : undefined} />
      <Check ok={dbReady} label="Schéma SQL installé" hint={dbReady ? undefined : "Exécutez supabase/migrations/*.sql"} />
      <Check
        ok={Boolean(service)}
        label="Clé secrète Supabase (facultative)"
        hint={service ? undefined : "SUPABASE_SECRET_KEY : sans elle, l'admin se crée par inscription + jeton"}
      />
      <Check ok={Boolean(process.env.SECRETS_ENCRYPTION_KEY)} label="Chiffrement des clés d'API" hint="SECRETS_ENCRYPTION_KEY (recommandé)" />
      <Check ok={Boolean(process.env.SETUP_TOKEN)} label="Installation protégée par jeton" hint="SETUP_TOKEN (recommandé en production)" />
    </ul>
  );

  if (demo || !dbReady) {
    return (
      <AuthShell siteName={site.siteName} logoDataUrl={site.logoDataUrl} title="Installation" subtitle="Quelques réglages manquent encore.">
        {checks}
        <p className="text-sm text-ink-soft">
          Complétez les variables d&apos;environnement puis rechargez cette page. Le pas-à-pas est dans le README.
        </p>
      </AuthShell>
    );
  }

  if (!required) {
    return (
      <AuthShell siteName={site.siteName} logoDataUrl={site.logoDataUrl} title="Installation terminée" subtitle="Un administrateur existe déjà : cette page est verrouillée.">
        <Link href="/connexion" className="btn-dark w-full !py-3">
          Se connecter
        </Link>
      </AuthShell>
    );
  }

  const session = await getSession();
  if (session) {
    return (
      <AuthShell
        siteName={site.siteName}
        logoDataUrl={site.logoDataUrl}
        title="Devenir administrateur"
        subtitle={`Connecté en tant que ${session.user.email}. Saisissez le jeton d'installation pour terminer.`}
      >
        <ClaimForm />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      siteName={site.siteName}
      logoDataUrl={site.logoDataUrl}
      title="Premier lancement"
      subtitle="Créez le compte administrateur. Ensuite, cette page se verrouille."
    >
      {checks}
      <SetupForm needsToken={Boolean(process.env.SETUP_TOKEN) || !service} />
    </AuthShell>
  );
}
