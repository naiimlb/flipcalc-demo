import Link from "next/link";
import { getTranslator } from "@/lib/i18n/server";
import { DEFAULT_SITE } from "@/lib/settings";
import { AccountMenu } from "../studio/TopBar";
import { PreferenceMenuButton } from "./PreferencePicker";
import type { StudioViewer } from "../studio/types";
import { IconCube, LogoMark } from "../icons";

/** En-tête compact : logo, titre à badge noir (textes de /admin/apparence), compte, thème et langue. */
export async function AppHeader({
  siteName,
  logoDataUrl,
  pill,
  title,
  line2,
  subtitle,
  viewer,
  demoMode,
}: {
  siteName: string;
  logoDataUrl: string | null;
  pill: string;
  title: string;
  line2: string;
  subtitle: string;
  viewer: StudioViewer | null;
  demoMode: boolean;
}) {
  const { locale, t } = await getTranslator();
  // Textes par défaut traduits ; un texte personnalisé dans /admin/apparence reste tel quel.
  if (locale !== "fr") {
    if (pill === DEFAULT_SITE.heroPill) pill = t("hero.pill");
    if (title === DEFAULT_SITE.heroTitle) title = t("hero.title");
    if (line2 === DEFAULT_SITE.heroTitleLine2) line2 = t("hero.line2");
    if (subtitle === DEFAULT_SITE.heroSubtitle) subtitle = t("hero.subtitle");
  }
  const heading = (
    <>
      {pill && (
        <span className="me-[0.3em] inline-flex items-center gap-[0.25em] rounded-full bg-night px-[0.5em] py-[0.08em] align-middle text-white">
          {pill}
          <IconCube size={20} strokeWidth={1.6} className="h-[0.8em] w-[0.8em]" />
        </span>
      )}
      {title} {line2}
    </>
  );

  return (
    <header className="px-3 pb-2 pt-3 sm:px-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-white">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="" className="h-7 w-7 rounded-lg object-contain" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface shadow-soft">
              <LogoMark size={20} />
            </span>
          )}
          <span className="text-[15px] tracking-tight">{siteName}</span>
        </Link>
        {(pill || title || line2) && <h1
          title={subtitle}
          className="hidden min-w-0 flex-1 truncate text-center text-lg font-semibold tracking-[-0.02em] text-white md:block lg:text-[22px]"
        >
          {heading}
        </h1>}
        {!(pill || title || line2) && <span className="flex-1" />}
        <nav className="ms-auto flex shrink-0 items-center gap-1 md:ms-0">
          <Link href="/galerie" className="btn hidden !px-3 !py-1.5 !text-xs text-white hover:bg-white/15 lg:inline-flex">
            {t("nav.gallery")}
          </Link>
          {viewer && (
            <Link href="/espace" className="btn hidden !px-3 !py-1.5 !text-xs text-white hover:bg-white/15 sm:inline-flex">
              {t("nav.space")}
            </Link>
          )}
          {viewer?.role === "admin" && (
            <Link href="/admin" className="btn hidden !px-3 !py-1.5 !text-xs text-white hover:bg-white/15 sm:inline-flex">
              {t("nav.admin")}
            </Link>
          )}
          <PreferenceMenuButton />
          <AccountMenu viewer={viewer} demoMode={demoMode} />
        </nav>
      </div>
      {(pill || title || line2) && (
        <h1 className="mt-2 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-white md:hidden">{heading}</h1>
      )}
    </header>
  );
}
