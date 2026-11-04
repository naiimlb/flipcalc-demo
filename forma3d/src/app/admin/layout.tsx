import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/icons";
import { requireAdminPage } from "@/lib/admin";
import { getPublicSettings } from "@/lib/settings.server";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage();
  const { site } = await getPublicSettings();
  return (
    <main className="min-h-dvh px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-[1280px] rounded-card bg-paper p-4 border border-line sm:p-6 lg:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            {site.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.logoDataUrl} alt="" className="h-7 w-7 rounded-lg object-contain" />
            ) : (
              <LogoMark size={26} />
            )}
            {site.siteName}
            <span className="chip bg-night text-white">Admin</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-ink-mute">
            {session.user.email}
            <Link href="/" className="btn-ghost !py-1.5 !text-xs">
              Retour au site
            </Link>
          </div>
        </header>
        <div className="mt-6 grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
          <aside>
            <AdminNav />
          </aside>
          <section className="min-w-0">{children}</section>
        </div>
      </div>
    </main>
  );
}
