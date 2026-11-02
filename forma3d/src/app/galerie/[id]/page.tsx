import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/AppHeader";
import { ProjectView } from "@/components/gallery/ProjectView";
import { Backdrop } from "@/components/landing/Backdrop";
import { validateDesign } from "@/lib/design/schema";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings.server";
import { getViewer } from "@/lib/viewer";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Galerie" };

export default async function GalleryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || isDemoMode()) notFound();
  const supabase = await getServerSupabase();
  const { data } = (await supabase?.from("gallery").select("id, title, category, prompt, author_name, created_at, design").eq("id", id).maybeSingle()) ?? {
    data: null,
  };
  const validated = data ? validateDesign(data.design) : null;
  if (!data || !validated?.ok) notFound();
  const { site } = await getPublicSettings();
  const { t } = await getTranslator();

  return (
    <main className="relative min-h-dvh overflow-x-clip">
      <Backdrop />
      <AppHeader siteName={site.siteName} logoDataUrl={site.logoDataUrl} pill="" title="" line2="" subtitle="" viewer={await getViewer()} demoMode={false} />
      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <Link href="/galerie" className="text-sm font-semibold text-white/85 hover:text-white">
          {t("gallery.back")}
        </Link>
        <ProjectView
          kind="gallery"
          id={data.id}
          title={data.title}
          prompt={data.prompt}
          design={validated.design}
          meta={t("gallery.by", { name: data.author_name || t("gallery.anonymous") })}
        />
      </div>
    </main>
  );
}
