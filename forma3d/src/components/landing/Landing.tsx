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
import { IconCamera, IconCube, IconDownload, IconHistory, IconRuler, IconShield, IconSparkles, IconSteps } from "../icons";
import { Backdrop } from "./Backdrop";
import { HeroStage } from "./HeroStage";
import { LandingChrome, type LandingSection } from "./LandingChrome";
import { Reveal } from "./Reveal";

// Sections sous la ligne de flottaison : rendues par le serveur, mais hydratées dans des morceaux de code séparés,
// après le héros (le premier écran reste léger).
const BeforeAfter = dynamic(() => import("./BeforeAfter").then((m) => m.BeforeAfter));
const EditorPreview = dynamic(() => import("./EditorPreview").then((m) => m.EditorPreview));
const Showcase = dynamic(() => import("./Showcase").then((m) => m.Showcase));

/** Titre de section : très gras, serré, avec un numéro discret. */
function SectionTitle({ n, id, title, lead }: { n: number; id: string; title: string; lead?: string }) {
  return (
    <Reveal className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-normal text-fg/45">
        <span className="text-neon">{String(n).padStart(2, "0")}</span>
      </p>
      <h2 id={id} className="mt-3 font-display text-[clamp(2.1rem,5.4vw,4.75rem)] font-black leading-[0.95] tracking-tight text-fg">
        {title}
      </h2>
      {lead && <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg/60 sm:text-lg">{lead}</p>}
    </Reveal>
  );
}

/**
 * Page d'accueil : héros plein écran (titre géant, objets 3D flottants), puis six sections révélées au défilement,
 * repérées par l'indicateur vertical à gauche.
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
  let latest: { id: string; title: string; category: string; color: string }[] = [];
  if (!demoMode) {
    const supabase = await getServerSupabase();
    const { data } = (await supabase?.from("gallery").select("id, title, category, design").eq("status", "published").order("created_at", { ascending: false }).limit(6)) ?? {
      data: null,
    };
    for (const row of data ?? []) {
      const v = validateDesign(row.design);
      if (!v.ok) continue;
      if (examples.length < 4) examples.push({ title: row.title, category: row.category, design: v.design });
      latest.push({ id: row.id, title: row.title, category: row.category, color: v.design.model.parts[0]?.color ?? "#2f6bff" });
    }
  }
  if (examples.length < 3) examples = [...examples, ...SAMPLE_DESIGNS.map((s) => ({ title: s.design.title, category: s.design.category, design: s.design }))].slice(0, 4);
  latest = latest.slice(0, 6);

  const sections: LandingSection[] = [
    { id: "accueil", label: t("landing.rail.hero") },
    { id: "etapes", label: t("landing.rail.how") },
    { id: "exemples", label: t("landing.rail.examples") },
    { id: "outils", label: t("landing.rail.tools") },
    { id: "photo", label: t("landing.rail.photo") },
    { id: "galerie", label: t("landing.rail.gallery") },
    { id: "commencer", label: t("landing.rail.start") },
  ];
  const steps = [
    { icon: <IconSparkles size={20} />, title: t("landing.step1"), text: t("landing.step1Text") },
    { icon: <IconCube size={20} />, title: t("landing.step2"), text: t("landing.step2Text") },
    { icon: <IconRuler size={20} />, title: t("landing.step3"), text: t("landing.step3Text") },
  ];
  const tools = [
    { icon: <IconSparkles size={18} />, title: t("landing.tool1"), text: t("landing.tool1Text") },
    { icon: <IconCube size={18} />, title: t("landing.tool2"), text: t("landing.tool2Text") },
    { icon: <IconShield size={18} />, title: t("landing.tool3"), text: t("landing.tool3Text") },
    { icon: <IconRuler size={18} />, title: t("landing.tool4"), text: t("landing.tool4Text") },
    { icon: <IconHistory size={18} />, title: t("landing.tool5"), text: t("landing.tool5Text") },
    { icon: <IconDownload size={18} />, title: t("landing.tool6"), text: t("landing.tool6Text") },
  ];
  // « 3D » en fin de titre : dégradé néon (seulement si le texte se termine ainsi, ex. le titre par défaut).
  const neonTail = line2.endsWith(" 3D") ? { head: line2.slice(0, -3), tail: "3D" } : null;
  const section = "relative w-full scroll-mt-16 px-5 py-24 sm:px-8 md:ps-24 md:pe-12 lg:ps-44 lg:pe-20 lg:py-32";

  return (
    <main className="relative min-h-dvh overflow-x-clip">
      <Backdrop />
      <AppHeader siteName={site.siteName} logoDataUrl={site.logoDataUrl} viewer={viewer} demoMode={demoMode} />
      <LandingChrome sections={sections} railLabel={t("landing.sections")} nextLabel={t("landing.scrollNext")} topLabel={t("landing.scrollTop")} />

      {/* 1. Héros plein écran */}
      <section id="accueil" aria-labelledby="hero-title" className="relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden px-5 pb-24 pt-28 sm:px-8">
        <HeroStage tiltLabel={t("landing.tilt")}>
          <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center text-center">
            <h1 id="hero-title" className="relative font-display text-[clamp(2.75rem,7.2vw,7rem)] font-black leading-[0.9] tracking-tight text-fg">
              <span
                aria-hidden
                className="landing-tag absolute -top-10 end-0 hidden rotate-[-5deg] items-center gap-2 rounded-full bg-fg px-3.5 py-1.5 font-sans text-xs font-semibold tracking-normal text-canvas shadow-neon-coral sm:inline-flex lg:-top-12 lg:end-[4%]"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-neon-coral" />
                {t("landing.tag")}
              </span>
              {pill}{" "}
              <span aria-hidden className="neon-rim relative mx-[0.04em] inline-flex h-[0.78em] w-[1.5em] translate-y-[-0.06em] items-center justify-center rounded-full bg-night align-middle text-white shadow-neon">
                <IconCube size={48} strokeWidth={1.5} className="landing-spin h-[0.46em] w-[0.46em]" />
              </span>{" "}
              {title}
              <br />
              {neonTail ? (
                <>
                  {neonTail.head} <span className="text-neon">{neonTail.tail}</span>
                </>
              ) : (
                line2
              )}
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-fg/60 sm:text-lg md:text-xl">{subtitle}</p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/studio" className="btn-neon tap !px-7 !py-3.5 text-base">
                <IconSparkles size={18} /> {t("landing.try")}
              </Link>
              {!viewer && (
                <Link href="/connexion?mode=inscription" className="btn-line tap !px-7 !py-3.5 text-base">
                  {t("landing.signup")}
                </Link>
              )}
            </div>
            <p className="mt-4 text-xs text-fg/45">{t("landing.free")}</p>
          </div>
        </HeroStage>
      </section>

      {/* 2. Comment ça marche */}
      <section aria-labelledby="how" id="etapes" className={section}>
        <SectionTitle n={1} id="how" title={t("landing.how")} />
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.08}>
                <div className="flex items-center gap-4">
                  <span className="font-display text-6xl font-black leading-none tracking-tight text-fg/15 lg:text-7xl">{i + 1}</span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-night text-white ring-1 ring-fg/10">{s.icon}</span>
                </div>
                <h3 className="mt-5 text-2xl font-bold tracking-tight text-fg">{s.title}</h3>
                <p className="mt-2 max-w-sm leading-relaxed text-fg/60">{s.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. Exemples de solutions */}
      <section aria-labelledby="examples-title" id="exemples" className={section}>
        <SectionTitle n={2} id="examples-title" title={t("landing.examples")} lead={t("landing.examplesLead")} />
        <Reveal className="mt-12">
          <Showcase examples={examples} />
        </Reveal>
      </section>

      {/* 4. Outils de création */}
      <section aria-labelledby="tools-title" id="outils" className={section}>
        <SectionTitle n={3} id="tools-title" title={t("landing.toolsTitle")} lead={t("landing.toolsLead")} />
        <div className="mt-12 grid items-start gap-12 xl:grid-cols-[1fr_1.35fr]">
          <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {tools.map((tool, i) => (
              <li key={tool.title}>
                <Reveal delay={i * 0.05} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-blue/15 text-neon-blue">{tool.icon}</span>
                  <span>
                    <span className="block font-bold text-fg">{tool.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-fg/55">{tool.text}</span>
                  </span>
                </Reveal>
              </li>
            ))}
          </ul>
          <Reveal delay={0.1}>
            <EditorPreview
              label={t("landing.toolsPreview")}
              title={t("landing.previewTitle")}
              prompt={t("landing.previewPrompt")}
              tabs={[t("landing.tabObject"), t("landing.tabMaterial"), t("landing.tabDimensions"), t("landing.tabAnalysis"), t("landing.tabFabrication")]}
            />
          </Reveal>
        </div>
      </section>

      {/* 5. Avant / après avec une photo */}
      <section aria-labelledby="photo-title" id="photo" className={section}>
        <SectionTitle n={4} id="photo-title" title={t("landing.photoTitle")} lead={t("landing.photoLead")} />
        <Reveal className="mt-12">
          <BeforeAfter
            labels={{
              before: t("landing.before"),
              after: t("landing.after"),
              compare: t("landing.compare"),
              beforeCaption: t("landing.beforeCaption"),
              afterCaption: t("landing.afterCaption"),
            }}
          />
        </Reveal>
        <Reveal className="mt-6">
          <Link href="/studio" className="btn-line tap">
            <IconCamera size={16} /> {t("landing.try")}
          </Link>
        </Reveal>
      </section>

      {/* 6. Galerie */}
      <section aria-labelledby="gallery-title" id="galerie" className={section}>
        <SectionTitle n={5} id="gallery-title" title={t("landing.galleryTitle")} lead={t("landing.galleryLead")} />
        {latest.length > 0 ? (
          <ul className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {latest.map((item, i) => (
              <li key={item.id}>
                <Reveal delay={i * 0.05}>
                  <Link href={`/galerie/${item.id}`} className="group block">
                    <span
                      className="flex aspect-square items-center justify-center rounded-3xl text-white/90 ring-1 ring-fg/10 transition group-hover:-translate-y-1"
                      style={{ background: `radial-gradient(circle at 30% 25%, ${item.color}, #0b0c12 75%)` }}
                    >
                      <IconCube size={34} strokeWidth={1.4} />
                    </span>
                    <span className="mt-3 block truncate font-semibold text-fg">{item.title}</span>
                    <span className="block truncate text-xs text-fg/50">{item.category}</span>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        ) : (
          <Reveal className="mt-10">
            <p className="text-fg/60">{t("landing.galleryEmpty")}</p>
          </Reveal>
        )}
        <Reveal className="mt-8">
          <Link href="/galerie" className="btn-line tap">
            <IconSteps size={16} /> {t("landing.gallery")}
          </Link>
        </Reveal>
      </section>

      {/* 7. Appel à l'action final */}
      <section aria-labelledby="cta-title" id="commencer" className={`${section} pb-36 text-center`}>
        <Reveal className="mx-auto max-w-5xl">
          <h2 id="cta-title" className="font-display text-[clamp(2.5rem,7.5vw,7rem)] font-black leading-[0.92] tracking-tight text-fg">
            {t("landing.ctaTitle")}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-fg/60">{t("landing.ctaLead")}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/studio" className="btn-neon tap !px-7 !py-3.5 text-base">
              <IconSparkles size={18} /> {t("landing.try")}
            </Link>
            {!viewer && (
              <Link href="/connexion?mode=inscription" className="btn-line tap !px-7 !py-3.5 text-base">
                {t("landing.signup")}
              </Link>
            )}
          </div>
        </Reveal>
        <p className="mt-24 text-xs text-fg/40">{site.footerText}</p>
      </section>
    </main>
  );
}
