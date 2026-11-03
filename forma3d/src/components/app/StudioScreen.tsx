import { AppHeader } from "@/components/app/AppHeader";
import { Backdrop } from "@/components/landing/Backdrop";
import { Studio } from "@/components/studio/Studio";
import type { StudioViewer } from "@/components/studio/types";
import { validateDesign } from "@/lib/design/schema";
import { REQUEST_COLUMNS, sampleRequests, toRequestItem, type RequestItem } from "@/lib/requests";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase, getSession } from "@/lib/supabase/server";

/** Tableau de bord de conception (barre de demande, visionneuse 3D, panneaux), pour visiteurs et comptes. */
export async function StudioScreen({ p, depart }: { p?: string; depart?: string }) {
  const demoMode = isDemoMode();
  const { site, features } = await getPublicSettings();

  let viewer: StudioViewer | null = null;
  let items: RequestItem[] = [];
  let startFrom: { prompt: string; design: unknown; title: string } | null = null;

  if (!demoMode) {
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
      if (p && !items.some((i) => i.id === p) && /^[0-9a-f-]{36}$/i.test(p)) {
        const { data: extra } = await session.supabase.from("design_requests").select(REQUEST_COLUMNS).eq("id", p).maybeSingle();
        if (extra) items = [toRequestItem(extra), ...items];
      }
    }
    // « Utiliser comme point de départ » depuis la galerie publique.
    if (depart && /^[0-9a-f-]{36}$/i.test(depart)) {
      const supabase = session?.supabase ?? (await getServerSupabase());
      const { data } = (await supabase?.from("gallery").select("title, prompt, design").eq("id", depart).maybeSingle()) ?? { data: null };
      const validated = data ? validateDesign(data.design) : null;
      if (data && validated?.ok) startFrom = { prompt: data.prompt || data.title, design: validated.design, title: data.title };
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-clip pt-[env(safe-area-inset-top)] lg:h-dvh">
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
        variant="bar"
      />
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 px-3 pb-3 sm:px-5 lg:pb-4">
        <Studio
          initialItems={items}
          samples={sampleRequests()}
          viewer={viewer}
          demoMode={demoMode}
          initialSelectedId={p ?? null}
          startFrom={startFrom}
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
