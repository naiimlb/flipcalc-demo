import type { Metadata } from "next";
import { AppHeader } from "@/components/app/AppHeader";
import { ProjectView, type SharedComment } from "@/components/gallery/ProjectView";
import { Backdrop } from "@/components/landing/Backdrop";
import { validateDesign } from "@/lib/design/schema";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings.server";
import { getViewer } from "@/lib/viewer";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Les liens de partage ne doivent pas être indexés par les moteurs de recherche.
export const metadata: Metadata = { title: "Projet partagé", robots: { index: false, follow: false } };

interface Shared {
  title: string | null;
  prompt: string;
  design: unknown;
  allow_comments: boolean;
  comments: SharedComment[];
}

/** Projet partagé en lecture seule (lien désactivable par son auteur), avec commentaires. */
export default async function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { site } = await getPublicSettings();
  const { t } = await getTranslator();
  let shared: Shared | null = null;
  if (!isDemoMode() && /^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    const supabase = await getServerSupabase();
    const { data } = (await supabase?.rpc("get_shared_project", { p_token: token })) ?? { data: null };
    shared = (data as Shared | null) ?? null;
  }
  const validated = shared ? validateDesign(shared.design) : null;

  return (
    <main className="pt-nav relative min-h-dvh overflow-x-clip">
      <Backdrop />
      <AppHeader siteName={site.siteName} logoDataUrl={site.logoDataUrl} pill="" title="" line2="" subtitle="" viewer={await getViewer()} demoMode={isDemoMode()} />
      <div className="w-full px-4 pb-12 sm:px-6 lg:px-10">
        {shared && validated?.ok ? (
          <ProjectView
            kind="share"
            id={token}
            title={shared.title ?? validated.design.title}
            prompt={shared.prompt}
            design={validated.design}
            comments={shared.comments ?? []}
            allowComments={shared.allow_comments}
          />
        ) : (
          <p className="panel mx-auto mt-10 max-w-lg p-6 text-center text-sm text-ink-soft">{t("share.notFound")}</p>
        )}
      </div>
    </main>
  );
}
