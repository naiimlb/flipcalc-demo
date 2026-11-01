import { redirect } from "next/navigation";
import { Backdrop } from "@/components/landing/Backdrop";
import { Hero } from "@/components/landing/Hero";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { Studio } from "@/components/studio/Studio";
import type { StudioViewer } from "@/components/studio/types";
import { REQUEST_COLUMNS, sampleRequests, toRequestItem, type RequestItem } from "@/lib/requests";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase, getSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const demoMode = isDemoMode();
  const { site, features } = await getPublicSettings();

  let viewer: StudioViewer | null = null;
  let items: RequestItem[] = [];

  if (!demoMode) {
    // Premier lancement : aucun administrateur → installation.
    const supabase = await getServerSupabase();
    const { data: setupRequired } = (await supabase?.rpc("setup_required")) ?? { data: null };
    if (setupRequired === true) redirect("/setup");

    const session = await getSession();
    if (session) {
      viewer = { email: session.user.email ?? "", displayName: session.displayName, role: session.role };
      const { data } = await session.supabase
        .from("design_requests")
        .select(REQUEST_COLUMNS)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(60);
      items = (data ?? []).map(toRequestItem);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-x-clip">
      <Backdrop />
      <div className="mx-auto max-w-[1320px] px-3 pb-12 pt-3 sm:px-6 sm:pt-8 xl:pb-48">
        <div className="relative rounded-card bg-paper/95 px-3 pb-6 pt-4 shadow-card backdrop-blur sm:px-8 sm:pb-12 sm:pt-6 lg:px-12">
          <SiteHeader
            siteName={site.siteName}
            logoDataUrl={site.logoDataUrl}
            signedIn={Boolean(viewer)}
            isAdmin={viewer?.role === "admin"}
            demoMode={demoMode}
          />
          <div className="mt-8 sm:mt-12">
            <Hero pill={site.heroPill} title={site.heroTitle} line2={site.heroTitleLine2} subtitle={site.heroSubtitle} />
          </div>
          <Studio
            initialItems={items}
            samples={sampleRequests()}
            viewer={viewer}
            demoMode={demoMode}
            siteName={site.siteName}
            logoDataUrl={site.logoDataUrl}
            features={{
              exportGlb: features.exportGlb,
              exportStl: features.exportStl,
              exportPng: features.exportPng,
              imageUpload: features.imageUpload,
              newRequests: features.newRequests,
              devMode: demoMode || (viewer?.role === "admin" && features.devMode),
            }}
          />
        </div>
        <footer className="mt-6 text-center text-xs text-white/80 xl:mt-0 xl:max-w-[60%] xl:pt-6 xl:text-left">
          {site.footerText}
        </footer>
      </div>
    </main>
  );
}
