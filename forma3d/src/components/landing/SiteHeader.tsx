import Link from "next/link";
import { LogoMark } from "../icons";

export function SiteHeader({
  siteName,
  logoDataUrl,
  signedIn,
  isAdmin,
  demoMode,
}: {
  siteName: string;
  logoDataUrl: string | null;
  signedIn: boolean;
  isAdmin: boolean;
  demoMode: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoDataUrl} alt="" className="h-7 w-7 rounded-lg object-contain" />
        ) : (
          <LogoMark size={26} />
        )}
        <span className="text-lg">{siteName}</span>
      </Link>
      <nav className="flex items-center gap-2 text-sm">
        {demoMode ? (
          <span className="chip bg-amber-100 text-amber-800">Mode démo</span>
        ) : signedIn ? (
          isAdmin && (
            <Link href="/admin" className="btn-ghost !py-1.5 !text-xs">
              Administration
            </Link>
          )
        ) : (
          <>
            <Link href="/connexion" className="btn !px-3 !py-1.5 !text-xs text-ink-soft hover:text-ink">
              Connexion
            </Link>
            <Link href="/connexion?mode=inscription" className="btn-dark !py-1.5 !text-xs">
              Créer un compte
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
