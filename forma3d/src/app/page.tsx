import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/AppHeader";
import { Backdrop } from "@/components/landing/Backdrop";
import { Studio } from "@/components/studio/Studio";
import type { StudioViewer } from "@/components/studio/types";
import { REQUEST_COLUMNS, sampleRequests, toRequestItem, type RequestItem } from "@/lib/requests";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase, getSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const demoMode = isDemoMode();
  const { site, features } = await getPublicSettings();
  const params = await searchParams;

  let viewer: StudioViewer | null = null;
  let items: RequestItem[] = [];

  if (!demoMode) {
    // Premier lancement : aucun administrateur → installation.
    const supabase = await getServerSupabase();
    const { data: setupRequired } = (await supabase?.rpc("setup_required")) ?? { data: null };
    if (setupRequired === true) redirect("/setup");

    const session = await getSession();
    if (session) {
      viewer = {
        id: session.user.id,
        email: session.user.email ?? "",
        displayName: session.profile.displayName,
        avatarUrl: session.profile.avatarUrl,
        role: session.role,
        units: session.profile.units,
        favoriteMaterials: session.profile.favoriteMaterials,
      };
      const { data } = await session.supabase
        .from("design_requests")
        .select(REQUEST_COLUMNS)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(60);
      items = (data ?? []).map(toRequestItem);

      // Lien « Ouvrir » depuis Mon espace vers une demande plus ancienne que la liste chargée.
      if (params.p && !items.some((i) => i.id === params.p) && /^[0-9a-f-]{36}$/i.test(params.p)) {
        const { data: extra } = await session.supabase.from("design_requests").select(REQUEST_COLUMNS).eq("id", params.p).maybeSingle();
        if (extra) items = [toRequestItem(extra), ...items];
      }
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip lg:h-dvh">
      <Backdrop />
      <AppHeader
        siteName={site.siteName}
        logoDataUrl={site.logoDataUrl}
        pill={site.heroPill}
        title={site.heroTitle}
        line2={site.heroTitleLine2}
        subtitle={site.heroSubtitle}
        viewer={viewer}
        demoMode={demoMode}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-3 pb-3 sm:px-5 lg:pb-4">
        <Studio
          initialItems={items}
          samples={sampleRequests()}
          viewer={viewer}
          demoMode={demoMode}
          initialSelectedId={params.p ?? null}
          features={{
            exportGlb: features.exportGlb,
            exportStl: features.exportStl,
            exportPng: features.exportPng,
            imageUpload: features.imageUpload,
            newRequests: features.newRequests,
            guestTrial: features.guestTrial,
            devMode: demoMode || (viewer?.role === "admin" && features.devMode),
          }}
        />
      </div>
    </main>
  );
}
