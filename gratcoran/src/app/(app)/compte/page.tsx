import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { signOut } from "@/app/(auth)/actions";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata: Metadata = { title: "Compte · Grat'Coran" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getUser();
  const since = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  return (
    <main className="pb-tabbar mx-auto max-w-md px-5">
      <h1 className="pb-4 pt-6 text-[32px] font-bold tracking-tight">Compte</h1>

      <section className="overflow-hidden rounded-2xl bg-surface">
        <div className="flex items-center gap-4 px-4 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-lg font-bold uppercase text-white">
            {user?.email?.[0] ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted">Connecté avec</p>
            <p className="truncate text-[17px] font-semibold">{user?.email}</p>
          </div>
        </div>
        {since && (
          <p className="border-t border-line px-4 py-3 text-[15px] text-muted">Membre depuis {since}</p>
        )}
      </section>

      <section className="mt-6 space-y-2 rounded-2xl bg-surface px-4 py-4 text-[15px] leading-relaxed text-muted">
        <p className="font-semibold text-ink">Confidentialité</p>
        <p>
          L&apos;audio sert uniquement à la reconnaissance : il n&apos;est jamais conservé. Seuls la sourate, les
          versets et la date sont enregistrés dans ton historique, visible par toi seul.
        </p>
      </section>

      <form action={signOut} className="mt-6">
        <SignOutButton />
      </form>

      <p className="mt-8 text-center text-xs text-muted">
        Texte du Coran et traduction française : paquet quran-json (Noble Qur&apos;an Encyclopedia).
      </p>
    </main>
  );
}
