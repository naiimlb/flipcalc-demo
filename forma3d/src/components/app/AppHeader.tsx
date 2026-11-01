import Link from "next/link";
import { AccountMenu } from "../studio/TopBar";
import type { StudioViewer } from "../studio/types";
import { IconCube, LogoMark } from "../icons";

/** En-tête compact : logo, titre à badge noir (textes de /admin/apparence), compte. */
export function AppHeader({
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
  const heading = (
    <>
      {pill && (
        <span className="mr-[0.3em] inline-flex items-center gap-[0.25em] rounded-full bg-ink px-[0.5em] py-[0.08em] align-middle text-white">
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
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-soft">
              <LogoMark size={20} />
            </span>
          )}
          <span className="text-[15px] tracking-tight">{siteName}</span>
        </Link>
        <h1
          title={subtitle}
          className="hidden min-w-0 flex-1 truncate text-center text-lg font-semibold tracking-[-0.02em] text-white md:block lg:text-[22px]"
        >
          {heading}
        </h1>
        <nav className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
          {viewer && (
            <Link href="/espace" className="btn hidden !px-3 !py-1.5 !text-xs text-white hover:bg-white/15 sm:inline-flex">
              Mon espace
            </Link>
          )}
          {viewer?.role === "admin" && (
            <Link href="/admin" className="btn hidden !px-3 !py-1.5 !text-xs text-white hover:bg-white/15 sm:inline-flex">
              Admin
            </Link>
          )}
          <AccountMenu viewer={viewer} demoMode={demoMode} />
        </nav>
      </div>
      <h1 className="mt-2 text-[17px] font-semibold leading-snug tracking-[-0.02em] text-white md:hidden">{heading}</h1>
    </header>
  );
}
