import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { moderateGalleryItem } from "../actions";
import { RowAction } from "../RowAction";
import { AdminTitle, Card } from "../ui";

export const dynamic = "force-dynamic";

interface Item {
  id: string;
  title: string;
  category: string;
  prompt: string;
  author_name: string | null;
  status: string;
  reports_count: number;
  created_at: string;
  user_id: string;
}

/** Modération de la galerie publique : publications signalées d'abord, motifs des signalements. */
export default async function GalleryAdminPage() {
  const session = await requireAdminPage();
  const { data, error } = await session.supabase
    .from("gallery")
    .select("id, title, category, prompt, author_name, status, reports_count, created_at, user_id")
    .order("reports_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data ?? []) as Item[];
  const ids = items.filter((i) => i.reports_count > 0).map((i) => i.id);
  const { data: reports } = ids.length
    ? await session.supabase.from("gallery_reports").select("gallery_id, reason, created_at").in("gallery_id", ids).order("created_at", { ascending: false })
    : { data: [] as { gallery_id: string; reason: string; created_at: string }[] };
  const reasons = new Map<string, string[]>();
  for (const r of reports ?? []) reasons.set(r.gallery_id, [...(reasons.get(r.gallery_id) ?? []), r.reason]);

  return (
    <div>
      <AdminTitle
        title="Galerie"
        subtitle={
          error
            ? "La galerie n'est pas encore activée : appliquez le script SQL de la phase 4 (supabase/migrations/20261104000000_phase4_galerie_partage.sql)."
            : `${items.length} publication(s). Masquée automatiquement au 5e signalement.`
        }
      />
      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id} className="!p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  <Link href={`/galerie/${item.id}`} className="hover:text-brand-accent">
                    {item.title}
                  </Link>{" "}
                  <span className={`chip ${item.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-night text-white"}`}>
                    {item.status === "published" ? "Publiée" : "Masquée"}
                  </span>{" "}
                  {item.reports_count > 0 && <span className="chip bg-rose-100 text-rose-700">{item.reports_count} signalement(s)</span>}
                </p>
                <p className="mt-0.5 text-xs text-ink-mute">
                  {item.category} · {item.author_name || "Anonyme"} · {new Date(item.created_at).toLocaleString("fr-FR")}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-soft">« {item.prompt} »</p>
                {(reasons.get(item.id) ?? []).length > 0 && (
                  <ul className="mt-2 list-disc ps-5 text-xs text-rose-700">
                    {(reasons.get(item.id) ?? []).slice(0, 5).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.status === "published" ? (
                  <RowAction label="Masquer" action={moderateGalleryItem.bind(null, item.id, "hide")} />
                ) : (
                  <RowAction label="Réafficher" action={moderateGalleryItem.bind(null, item.id, "show")} />
                )}
                <RowAction label="Supprimer" tone="danger" confirmText="Supprimer définitivement cette publication ?" action={moderateGalleryItem.bind(null, item.id, "delete")} />
              </div>
            </div>
          </Card>
        ))}
        {!error && items.length === 0 && <Card>Aucune publication pour l&apos;instant.</Card>}
      </div>
    </div>
  );
}
