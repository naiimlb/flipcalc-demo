import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { SignOutButton } from "@/components/SignOutButton";
import { StatTile, FlameIcon } from "@/components/StatTile";
import { StreakValue } from "@/components/StreakValue";
import pkg from "../../../../package.json";

export const metadata: Metadata = { title: "Compte · Grat'Coran" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await getServerSupabase();
  const [{ data: auth }, recCount, tajCount, recDates, tajDates] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("recognitions").select("id", { count: "exact", head: true }),
    supabase.from("tajweed_sessions").select("id", { count: "exact", head: true }),
    supabase.from("recognitions").select("created_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("tajweed_sessions").select("created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  const user = auth.user;
  const since = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" })
    : null;
  const dates = [...(recDates.data ?? []), ...(tajDates.data ?? [])].map((r) => r.created_at as string);

  return (
    <main className="pb-tabbar mx-auto max-w-md space-y-5 px-5">
      <h1 className="pt-6 text-[32px] font-bold tracking-tight">Compte</h1>

      <section className="glass overflow-hidden rounded-3xl">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold uppercase text-white">
            {user?.email?.[0] ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted">Connecté avec</p>
            <p className="truncate text-[17px] font-semibold">{user?.email}</p>
          </div>
        </div>
        {since && <p className="border-t border-line px-4 py-3 text-[15px] text-muted">Membre depuis {since}</p>}
      </section>

      <section aria-label="Statistiques" className="grid grid-cols-3 gap-2">
        <StatTile label="Reconnaissances" value={recCount.count ?? 0} />
        <StatTile label="Essais tajweed" value={tajCount.count ?? 0} />
        <StatTile label="Série" icon={<FlameIcon />} value={<StreakValue dates={dates} />} />
      </section>

      <nav className="glass divide-y divide-line overflow-hidden rounded-3xl" aria-label="Liens">
        <Link href="/tajweed/parcours" className="pressable flex min-h-[52px] items-center justify-between px-4 text-[16px] font-medium">
          Mon parcours Tajweed <span className="text-muted" aria-hidden>›</span>
        </Link>
        <Link href="/avertissement-tajweed" className="pressable flex min-h-[52px] items-center justify-between px-4 text-[16px] font-medium">
          Relire l&apos;avertissement Tajweed <span className="text-muted" aria-hidden>›</span>
        </Link>
      </nav>

      <section className="glass space-y-2 rounded-3xl px-4 py-4 text-[15px] leading-relaxed text-muted">
        <p className="font-semibold text-ink">Confidentialité</p>
        <p>
          L&apos;audio sert uniquement à l&apos;analyse : il n&apos;est jamais conservé. Seuls la sourate, les versets, les
          résultats et la date sont enregistrés, visibles par toi seul.
        </p>
      </section>

      <form action={signOut}>
        <SignOutButton />
      </form>

      <p className="pb-2 text-center text-xs text-muted">
        Grat&apos;Coran · version {pkg.version}
        <br />
        Texte du Coran et traduction française : paquet quran-json (Noble Qur&apos;an Encyclopedia).
      </p>
    </main>
  );
}
