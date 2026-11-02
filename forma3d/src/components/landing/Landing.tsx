import Link from "next/link";
import { AppHeader } from "@/components/app/AppHeader";
import { SAMPLE_DESIGNS } from "@/lib/design/samples";
import { validateDesign, type Design } from "@/lib/design/schema";
import { getTranslator } from "@/lib/i18n/server";
import { DEFAULT_SITE } from "@/lib/settings";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { IconCube, IconRuler, IconSparkles } from "../icons";
import { Backdrop } from "./Backdrop";
import { Showcase } from "./Showcase";

/** Page d'accueil des visiteurs : titre à badge noir, exemples en 3D, fonctionnement en 3 étapes. */
export async function Landing() {
  const { site } = await getPublicSettings();
  const { locale, t } = await getTranslator();
  const custom = (value: string, fallback: string, key: Parameters<typeof t>[0]) => (locale !== "fr" && value === fallback ? t(key) : value);
  const pill = custom(site.heroPill, DEFAULT_SITE.heroPill, "hero.pill");
  const title = custom(site.heroTitle, DEFAULT_SITE.heroTitle, "hero.title");
  const line2 = custom(site.heroTitleLine2, DEFAULT_SITE.heroTitleLine2, "hero.line2");
  const subtitle = custom(site.heroSubtitle, DEFAULT_SITE.heroSubtitle, "hero.subtitle");

  // Exemples : les dernières publications de la galerie, sinon les modèles d'exemple.
  let examples: { title: string; category: string; design: Design }[] = [];
  if (!isDemoMode()) {
    const supabase = await getServerSupabase();
    const { data } = (await supabase?.from("gallery").select("title, category, design").eq("status", "published").order("created_at", { ascending: false }).limit(4)) ?? {
      data: null,
    };
    for (const row of data ?? []) {
      const v = validateDesign(row.design);
      if (v.ok) examples.push({ title: row.title, category: row.category, design: v.design });
    }
  }
  if (examples.length < 3) examples = [...examples, ...SAMPLE_DESIGNS.map((s) => ({ title: s.design.title, category: s.design.category, design: s.design }))].slice(0, 4);

  const steps = [
    { icon: <IconSparkles size={18} />, title: t("landing.step1"), text: t("landing.step1Text") },
    { icon: <IconCube size={18} />, title: t("landing.step2"), text: t("landing.step2Text") },
    { icon: <IconRuler size={18} />, title: t("landing.step3"), text: t("landing.step3Text") },
  ];

  return (
    <main className="relative min-h-dvh overflow-x-clip">
      <Backdrop />
      <AppHeader siteName={site.siteName} logoDataUrl={site.logoDataUrl} pill="" title="" line2="" subtitle={subtitle} viewer={null} demoMode={isDemoMode()} />
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
        <div className="text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">{t("landing.kicker")}</p>
          <h1 className="mt-3 text-[40px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[54px] lg:text-[64px]">
            {pill && (
              <span className="me-[0.25em] inline-flex items-center gap-[0.2em] rounded-full bg-night px-[0.45em] py-[0.05em] align-middle">
                {pill}
                <IconCube size={28} strokeWidth={1.6} className="h-[0.7em] w-[0.7em]" />
              </span>
            )}
            {title} <span className="text-white/90">{line2}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{t("landing.lead")}</p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Link href="/studio" className="btn bg-surface !px-6 !py-3 text-base text-brand-accent shadow-float hover:brightness-105">
              <IconSparkles size={17} /> {t("landing.try")}
            </Link>
            <Link href="/connexion?mode=inscription" className="btn-dark !px-6 !py-3 text-base">
              {t("landing.signup")}
            </Link>
            <Link href="/galerie" className="btn !px-5 !py-3 text-base text-white hover:bg-white/15">
              {t("landing.gallery")}
            </Link>
          </div>
          <p className="mt-3 text-xs text-white/70">{t("landing.free")}</p>
        </div>
        <div>
          <h2 className="sr-only">{t("landing.examples")}</h2>
          <Showcase examples={examples} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6" aria-labelledby="how">
        <h2 id="how" className="text-2xl font-semibold tracking-tight text-white">
          {t("landing.how")}
        </h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="panel p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-from to-brand-to text-white">{s.icon}</span>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-brand-accent">{i + 1}</p>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-center text-xs text-white/70">{site.footerText}</p>
      </section>
    </main>
  );
}
