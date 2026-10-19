import type { Metadata } from "next";
import Link from "next/link";
import { NoticeText } from "@/components/tajweed/NoticeText";

export const metadata: Metadata = { title: "Avertissement Tajweed · Grat'Coran" };

export default function NoticePage() {
  return (
    <main className="pb-tabbar mx-auto max-w-md px-5 pt-6">
      <Link href="/compte" className="pressable inline-flex min-h-[44px] items-center gap-1 text-[15px] font-semibold text-emerald-deep dark:text-emerald">
        ‹ Compte
      </Link>
      <div className="glass mt-2 rounded-[28px] p-6">
        <h1 className="mb-4 text-[26px] font-bold tracking-tight">Avant de commencer</h1>
        <NoticeText />
      </div>
    </main>
  );
}
