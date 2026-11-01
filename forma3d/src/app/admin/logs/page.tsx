import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { getPublicSettings } from "@/lib/settings.server";
import { clearLogs } from "../actions";
import { RowAction } from "../RowAction";
import { AdminTitle, Card } from "../ui";

const LEVELS = ["all", "error", "warn", "info"] as const;
const LEVEL_STYLE: Record<string, string> = {
  error: "bg-rose-500 text-white",
  warn: "bg-amber-400 text-ink",
  info: "bg-paper text-ink-soft",
};

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ niveau?: string }> }) {
  const session = await requireAdminPage();
  const { features } = await getPublicSettings();
  const params = await searchParams;
  const level = LEVELS.includes(params.niveau as (typeof LEVELS)[number]) ? (params.niveau as string) : "all";
  let query = session.supabase
    .from("app_logs")
    .select("id, level, source, message, details, request_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (level !== "all") query = query.eq("level", level);
  const { data: logs } = await query;

  return (
    <div>
      <AdminTitle title="Mode Dev · logs" subtitle="Erreurs de génération, refus de l'IA, validations échouées et actions d'administration.">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-line">
            {LEVELS.map((l) => (
              <Link key={l} href={`/admin/logs?niveau=${l}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${level === l ? "bg-ink text-white" : "text-ink-soft"}`}>
                {l === "all" ? "Tous" : l}
              </Link>
            ))}
          </div>
          <RowAction label="Vider" tone="danger" confirmText="Vider tout le journal ?" action={clearLogs} />
        </div>
      </AdminTitle>
      <Card className="mb-3 !py-3">
        <p className="text-sm">
          Mode Dev dans le tableau de bord :{" "}
          <strong className={features.devMode ? "text-emerald-600" : "text-ink-mute"}>{features.devMode ? "activé" : "désactivé"}</strong>{" "}
          — bouton « JSON » sur la visionneuse (admins uniquement).{" "}
          <Link href="/admin/fonctionnalites" className="font-semibold text-brand-accent">
            Modifier
          </Link>
        </p>
      </Card>
      <ul className="space-y-2">
        {(logs ?? []).map((l) => (
          <li key={l.id}>
            <Card className="!p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`chip ${LEVEL_STYLE[l.level] ?? ""}`}>{l.level}</span>
                <span className="font-mono text-ink-soft">{l.source}</span>
                <span className="text-ink-mute">{new Date(l.created_at).toLocaleString("fr-FR")}</span>
                {l.request_id && <span className="font-mono text-ink-mute">demande {l.request_id.slice(0, 8)}</span>}
              </div>
              <p className="mt-1.5 text-sm">{l.message}</p>
              {l.details != null && (
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-brand-accent">Détails</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-xl bg-[#0f1020] p-3 font-mono text-[11px] text-emerald-200 scrollbar-thin">
                    {JSON.stringify(l.details, null, 2)}
                  </pre>
                </details>
              )}
            </Card>
          </li>
        ))}
        {!logs?.length && (
          <Card>
            <p className="text-sm text-ink-mute">Journal vide.</p>
          </Card>
        )}
      </ul>
    </div>
  );
}
