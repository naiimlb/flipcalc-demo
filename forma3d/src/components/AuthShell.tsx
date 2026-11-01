import Link from "next/link";
import { Backdrop } from "./landing/Backdrop";
import { LogoMark } from "./icons";

/** Mise en page des écrans d'authentification et d'installation. */
export function AuthShell({
  siteName,
  logoDataUrl,
  title,
  subtitle,
  children,
}: {
  siteName: string;
  logoDataUrl: string | null;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <Backdrop />
      <div className="w-full max-w-md rounded-card bg-paper/95 p-6 shadow-card backdrop-blur sm:p-9">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold">
          {logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoDataUrl} alt="" className="h-7 w-7 rounded-lg object-contain" />
          ) : (
            <LogoMark size={26} />
          )}
          {siteName}
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-mute">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
