import { getServerSupabase } from "@/lib/supabase/server";
import { noticeAccepted } from "@/lib/tajweed/server";
import { NoticeGate } from "@/components/tajweed/NoticeGate";

export const dynamic = "force-dynamic";

/** Tant que l'avertissement n'a pas été accepté, l'onglet Tajweed n'affiche que lui. */
export default async function TajweedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase();
  if (!(await noticeAccepted(supabase))) return <NoticeGate />;
  return children;
}
