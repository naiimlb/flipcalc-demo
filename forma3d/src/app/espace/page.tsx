import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/AppHeader";
import { EspaceClient, type Folder } from "@/components/espace/EspaceClient";
import { REQUEST_COLUMNS, toRequestItem } from "@/lib/requests";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getSession } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mon espace" };
export const dynamic = "force-dynamic";

export default async function EspacePage({ searchParams }: { searchParams: Promise<{ motdepasse?: string }> }) {
  if (isDemoMode()) redirect("/");
  const session = await getSession();
  if (!session) redirect("/connexion?next=/espace");
  const { site } = await getPublicSettings();
  const params = await searchParams;

  const [{ data: folders }, { data: rows }] = await Promise.all([
    session.supabase.from("folders").select("id, name, created_at").eq("user_id", session.user.id).order("created_at"),
    session.supabase
      .from("design_requests")
      .select(REQUEST_COLUMNS)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const viewer = {
    id: session.user.id,
    email: session.user.email ?? "",
    displayName: session.profile.displayName,
    avatarUrl: session.profile.avatarUrl,
    role: session.role,
    units: session.profile.units,
    favoriteMaterials: session.profile.favoriteMaterials,
  };

  return (
    <main className="pt-nav relative min-h-dvh">
      <AppHeader
        siteName={site.siteName}
        logoDataUrl={site.logoDataUrl}
        pill={site.heroPill}
        title={site.heroTitle}
        line2={site.heroTitleLine2}
        subtitle={site.heroSubtitle}
        viewer={viewer}
        demoMode={false}
      />
      <div className="px-4 pb-6 sm:px-6 lg:px-10">
        <EspaceClient
          viewer={viewer}
          language={session.profile.language}
          initialFolders={(folders ?? []) as Folder[]}
          initialItems={(rows ?? []).map(toRequestItem)}
          passwordChanged={params.motdepasse === "ok"}
        />
      </div>
    </main>
  );
}
