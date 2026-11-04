import dynamic from "next/dynamic";
import Link from "next/link";
import { AppHeader } from "@/components/app/AppHeader";
import { getViewer } from "@/lib/viewer";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";
import { validateDesign, type Design } from "@/lib/design/schema";
import { getTranslator } from "@/lib/i18n/server";
import { DEFAULT_SITE } from "@/lib/settings";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { IconChevronRight, IconCube, IconDownload, IconHistory, IconRuler, IconShield, IconSparkles, IconSteps } from "../icons";
import { HeroStage } from "./HeroStage";
import { Reveal } from "./Reveal";

// Exemples en 3D : rendus par le serveur, hydratés dans un morceau de code séparé (le premier écran reste léger).
const Showcase = dynamic(() => import("./Showcase").then((m) => m.Showcase));

/** Titre de section : sobre, une ligne d'explication. */
function SectionHead({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <h2 id={id} className="text-xl font-semibold text-ink">
        {title}
      </h2>
      {lead && <p className="mt-2 text-base text-ink-mute">{lead}</p>}
    </Reveal>
  );
}

/**
 * Page d'accueil : ce que fait Forma3D et pour qui, un aperçu réel de l'éditeur, puis des sections courtes
 * (étapes, fonctions, exemples en 3D, galerie). Fond sombre uni, une seule couleur d'accent.
 */
export async function Landing() {
  const { site } = await getPublicSettings();
  const { locale, t } = await getTranslator();
  const demoMode = isDemoMode();
  const viewer = demoMode ? null : await getViewer();
  const custom = (value: string, fallback: string, key: Parameters<typeof t>[0]) => (locale !== "fr" && value === fallback ? t(key) : value);
  const pill = custom(site.heroPill, DEFAULT_SITE.heroPill, "hero.pill");
  const title = custom(site.heroTitle, DEFAULT_SITE.heroTitle, "hero.title");
  const line2 = custom(site.heroTitleLine2, DEFAULT_SITE.heroTitleLine2, "hero.line2");
  const subtitle = custom(site.heroSubtitle, DEFAULT_SITE.heroSubtitle, "hero.subtitle");

  // Exemples : les dernières publications de la galerie, complétées par les modèles d'exemple.
  let examples: { title: string; category: string; design: Design }[] = [];
  let latest: { id: string; title: string; category: string; color: string; parts: number }[] = [];
  if (!demoMode) {
    const supabase = await getServerSupabase();
    const { data } = (await supabase?.from("gallery").select("id, title, category, design").eq("status", "published").order("created_at", { ascending: false }).limit(6)) ?? {
      data: null,
    };
    for (const row of data ?? []) {
      const v = validateDesign(row.design);
      if (!v.ok) continue;
      if (examples.length < 4) examples.push({ title: row.title, category: row.category, design: v.design });
      latest.push({ id: row.id, title: row.title, category: row.category, color: v.design.model.parts[0]?.color ?? "#8d9199", parts: v.design.model.parts.length });
    }
  }
  if (examples.length < 3) examples = [...examples, ...SAMPLE_DESIGNS.map((s) => ({ title: s.design.title, category: s.design.category, design: s.design }))].slice(0, 4);
  latest = latest.slice(0, 6);

  const steps = [
    { title: t("landing.step1"), text: t("landing.step1Text") },
    { title: t("landing.step2"), text: t("landing.step2Text") },
    { title: t("landing.step3"), text: t("landing.step3Text") },
  ];
  const tools = [
    { icon: <IconSparkles />, title: t("landing.tool1"), text: t("landing.tool1Text") },
    { icon: <IconCube />, title: t("landing.tool2"), text: t("landing.tool2Text") },
    { icon: <IconShield />, title: t("landing.tool3"), text: t("landing.tool3Text") },
    { icon: <IconRuler />, title: t("landing.tool4"), text: t("landing.tool4Text") },
    { icon: <IconHistory />, title: t("landing.tool5"), text: t("landing.tool5Text") },
    { icon: <IconDownload />, title: t("landing.tool6"), text: t("landing.tool6Text") },
  ];
  const section = "mx-auto w-full max-w-6xl scroll-mt-16 px-5 py-16 sm:px-8 lg:py-20";

  return (
    <main className="relative min-h-dvh">
      <AppHeader siteName={site.siteName} logoDataUrl={site.logoDataUrl} viewer={viewer} demoMode={demoMode} />

      {/* 1. Héros : ce que fait le produit, pour qui, et l'action principale. */}
      <section id="accueil" aria-labelledby="hero-title" className="relative flex min-h-[72svh] w-full items-center justify-center overflow-hidden border-b border-line px-5 pb-16 pt-28 sm:px-8">
        <HeroStage tiltLabel={t("landing.tilt")}>
          <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
            <p className="font-mono text-xs text-ink-mute">{t("landing.kicker")}</p>
            <h1 id="hero-title" className="mt-3 text-3xl font-semibold text-ink sm:text-display">
              {pill} {title} {line2}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ink-soft">{subtitle}</p>
            <p className="mt-2 max-w-xl text-base text-ink-mute">{t("landing.audience")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              <Link href="/studio" className="btn-primary tap !min-h-11 !px-4">
                {t("landing.try")} <IconChevronRight />
              </Link>
              {!viewer && (
                <Link href="/connexion?mode=inscription" className="btn-secondary tap !min-h-11 !px-4">
                  {t("landing.signup")}
                </Link>
              )}
            </div>
            <p className="mt-3 text-xs text-ink-mute">{t("landing.free")}</p>
          </div>
        </HeroStage>
      </section>

      {/* 2. Aperçu réel de l'éditeur (capture de l'application, sans cadre d'appareil). */}
      <section aria-labelledby="preview-title" id="apercu" className={section}>
        <SectionHead id="preview-title" title={t("landing.toolsPreview")} lead={t("landing.previewCaption")} />
        <Reveal className="mt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/editeur.webp"
            width={1440}
            height={900}
            loading="lazy"
            decoding="async"
            alt={t("landing.previewAlt")}
            className="h-auto w-full rounded-lg border border-line bg-surface"
          />
        </Reveal>
      </section>

      {/* 3. Comment ça marche */}
      <section aria-labelledby="how" id="etapes" className={`${section} border-t border-line`}>
        <SectionHead id="how" title={t("landing.how")} />
        <ol className="mt-8 grid border-y border-line md:grid-cols-3 md:divide-x md:divide-line rtl:md:divide-x-reverse">
          {steps.map((s, i) => (
            <li key={s.title} className="border-b border-line py-5 last:border-b-0 md:border-b-0 md:px-6 md:first:ps-0">
              <Reveal delay={i * 0.04}>
                <p className="font-mono text-xs text-ink-mute">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-base text-ink-mute">{s.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Fonctions */}
      <section aria-labelledby="tools-title" id="outils" className={`${section} border-t border-line`}>
        <SectionHead id="tools-title" title={t("landing.toolsTitle")} lead={t("landing.toolsLead")} />
        <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool, i) => (
            <li key={tool.title}>
              <Reveal delay={i * 0.03} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-ink-mute">{tool.icon}</span>
                <span>
                  <span className="block text-base font-medium text-ink">{tool.title}</span>
                  <span className="mt-1 block text-base text-ink-mute">{tool.text}</span>
                </span>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. Exemples en 3D, manipulables */}
      <section aria-labelledby="examples-title" id="exemples" className={`${section} border-t border-line`}>
        <SectionHead id="examples-title" title={t("landing.examples")} lead={t("landing.examplesLead")} />
        <Reveal className="mt-8">
          <Showcase examples={examples} />
        </Reveal>
      </section>

      {/* 6. Galerie */}
      <section aria-labelledby="gallery-title" id="galerie" className={`${section} border-t border-line`}>
        <SectionHead id="gallery-title" title={t("landing.galleryTitle")} lead={t("landing.galleryLead")} />
        {latest.length > 0 ? (
          <ul className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((item) => (
              <li key={item.id}>
                <Link href={`/galerie/${item.id}`} className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 transition-colors hover:border-ink-mute/60">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-ink">{item.title}</span>
                    <span className="block truncate text-xs text-ink-mute">{item.category}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-ink-mute">{item.parts}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-base text-ink-mute">{t("landing.galleryEmpty")}</p>
        )}
        <div className="mt-6">
          <Link href="/galerie" className="btn-secondary tap">
            <IconSteps /> {t("landing.gallery")}
          </Link>
        </div>
      </section>

      {/* 7. Appel à l'action final */}
      <section aria-labelledby="cta-title" id="commencer" className={`${section} border-t border-line`}>
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 id="cta-title" className="text-xl font-semibold text-ink">
              {t("landing.ctaTitle")}
            </h2>
            <p className="mt-2 text-base text-ink-mute">{t("landing.ctaLead")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/studio" className="btn-primary tap !min-h-11 !px-4">
              {t("landing.try")} <IconChevronRight />
            </Link>
            {!viewer && (
              <Link href="/connexion?mode=inscription" className="btn-secondary tap !min-h-11 !px-4">
                {t("landing.signup")}
              </Link>
            )}
          </div>
        </div>
      </section>
      <footer className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-6 text-xs text-ink-mute sm:px-8">{site.footerText}</p>
      </footer>
    </main>
  );
}
