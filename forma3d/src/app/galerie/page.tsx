import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app/AppHeader";
import { IconCube, IconSearch } from "@/components/icons";
import { getTranslator } from "@/lib/i18n/server";
import { getPublicSettings } from "@/lib/settings.server";
import { getViewer } from "@/lib/viewer";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase, getSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Galerie" };

interface Row {
  id: string;
  title: string;
  category: string;
  prompt: string;
  author_name: string | null;
  created_at: string;
  design: { model?: { parts?: unknown[] }; dimensions?: { width: number; depth: number; height: number } };
}

/** Galerie publique : publications explicites des utilisateurs, recherche et filtre par catégorie. */
export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const params = await searchParams;
  const { site } = await getPublicSettings();
  const { t, locale } = await getTranslator();
  const q = (params.q ?? "").trim().slice(0, 80);
  const cat = (params.cat ?? "").trim().slice(0, 80);
  const session = isDemoMode() ? null : await getSession();
  const supabase = session?.supabase ?? (isDemoMode() ? null : await getServerSupabase());

  let rows: Row[] = [];
  let categories: string[] = [];
  let unavailable = isDemoMode();
  if (supabase) {
    let query = supabase
      .from("gallery")
      .select("id, title, category, prompt, author_name, created_at, design")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(60);
    if (cat) query = query.eq("category", cat);
    if (q) {
      // Recherche simple (titre, catégorie, problème) ; les caractères spéciaux de filtre sont retirés.
      const safe = q.replace(/[%_,()*\\]/g, " ").trim();
      if (safe) query = query.or(`title.ilike.%${safe}%,category.ilike.%${safe}%,prompt.ilike.%${safe}%`);
    }
    const [{ data, error }, { data: cats }] = await Promise.all([
      query,
      supabase.from("gallery").select("category").eq("status", "published").limit(500),
    ]);
    unavailable = Boolean(error);
    rows = (data ?? []) as Row[];
    categories = [...new Set((cats ?? []).map((c: { category: string }) => c.category).filter(Boolean))].sort();
  }

  return (
    <main className="pt-nav relative min-h-dvh overflow-x-clip">
      <AppHeader siteName={site.siteName} logoDataUrl={site.logoDataUrl} pill="" title="" line2="" subtitle="" viewer={await getViewer()} demoMode={isDemoMode()} />
      <div className="w-full px-4 pb-12 sm:px-6 lg:px-10">
        <h1 className="mt-6 font-display text-4xl font-black tracking-tight text-fg sm:text-6xl">{t("gallery.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-mute sm:text-base">{t("gallery.lead")}</p>

        <form className="mt-5 flex flex-wrap gap-2" role="search">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md bg-surface px-4 py-2.5 shadow-soft">
            <IconSearch size={15} className="text-ink-mute" />
            <input name="q" defaultValue={q} placeholder={t("gallery.search")} className="w-full bg-transparent text-sm outline-none placeholder:text-ink-mute" />
          </label>
          <select name="cat" defaultValue={cat} className="input !w-auto !rounded-md" aria-label={t("gallery.allCategories")}>
            <option value="">{t("gallery.allCategories")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-dark">
            <IconSearch size={14} />
          </button>
        </form>

        {unavailable ? (
          <p className="panel mt-6 p-6 text-center text-sm text-ink-soft">{t("gallery.unavailable")}</p>
        ) : rows.length === 0 ? (
          <p className="panel mt-6 p-6 text-center text-sm text-ink-soft">{q || cat ? t("gallery.noResult") : t("gallery.empty")}</p>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/galerie/${r.id}`} className="panel group flex h-full flex-col p-3 transition-colors hover:border-ink-mute/50">
                  <span className="flex h-28 items-center justify-center rounded-md border border-line bg-paper text-ink-mute">
                    <IconCube size={20} />
                  </span>
                  <span className="mt-3 text-base font-semibold leading-snug group-hover:text-brand-accent">{r.title}</span>
                  <span className="mt-0.5 text-xs text-ink-mute">
                    {r.category} · {r.design?.model?.parts?.length ?? 0} {t("dim.parts").toLowerCase()}
                  </span>
                  <span className="mt-2 line-clamp-2 text-sm text-ink-soft">« {r.prompt} »</span>
                  <span className="mt-auto pt-3 text-xs text-ink-mute">
                    {t("gallery.by", { name: r.author_name || t("gallery.anonymous") })} ·{" "}
                    {new Date(r.created_at).toLocaleDateString(locale === "ar" ? "ar" : locale === "en" ? "en-GB" : "fr-FR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
