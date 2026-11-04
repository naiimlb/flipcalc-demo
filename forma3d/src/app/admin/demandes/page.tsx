import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { adminDeleteRequest } from "../actions";
import { RowAction } from "../RowAction";
import { AdminTitle, Card, StatusBadge } from "../ui";

const PAGE_SIZE = 25;
const STATUSES = ["all", "ready", "processing", "error"] as const;
const STATUS_LABELS: Record<string, string> = { all: "Toutes", ready: "Prêtes", processing: "En cours", error: "Erreurs" };

export default async function RequestsAdminPage({ searchParams }: { searchParams: Promise<{ statut?: string; page?: string }> }) {
  const session = await requireAdminPage();
  const params = await searchParams;
  const status = STATUSES.includes(params.statut as (typeof STATUSES)[number]) ? (params.statut as string) : "all";
  const page = Math.max(1, Number(params.page) || 1);

  let query = session.supabase
    .from("design_requests")
    .select("id, user_id, prompt, title, status, error, provider, model, duration_ms, has_image, created_at, design", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== "all") query = query.eq("status", status);
  const { data: rows, count } = await query;

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  const ids = (rows ?? []).map((r) => r.id);
  const [{ data: profiles }, { data: debug }] = await Promise.all([
    userIds.length ? session.supabase.from("profiles").select("id, email").in("id", userIds) : Promise.resolve({ data: [] }),
    ids.length
      ? session.supabase.from("request_debug").select("request_id, raw_response, stop_reason, usage, validation_errors").in("request_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const emails = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  const debugById = new Map((debug ?? []).map((d) => [d.request_id, d]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <AdminTitle title="Demandes" subtitle={`${count ?? 0} demande(s) au total.`}>
        <div className="flex gap-1 rounded-md bg-surface p-1 ring-1 ring-line">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/demandes?statut=${s}`}
              className={`rounded-md px-3 py-1 text-xs font-medium ${status === s ? "bg-surface text-ink ring-1 ring-line" : "text-ink-soft"}`}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </div>
      </AdminTitle>

      <div className="space-y-2">
        {(rows ?? []).map((r) => {
          const d = debugById.get(r.id);
          return (
            <Card key={r.id} className="!p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.title ?? "—"}</p>
                  <p className="text-sm text-ink-soft">« {r.prompt} »</p>
                  <p className="mt-1 text-xs text-ink-mute">
                    {emails.get(r.user_id) ?? r.user_id} · {new Date(r.created_at).toLocaleString("fr-FR")} · {r.provider ?? "—"}
                    {r.model ? ` (${r.model})` : ""}
                    {r.duration_ms ? ` · ${(r.duration_ms / 1000).toFixed(1)} s` : ""}
                    {r.has_image ? " · avec photo" : ""}
                  </p>
                  {r.error && <p className="mt-1 text-xs text-danger">{r.error}</p>}
                </div>
                <StatusBadge status={r.status} />
                <RowAction label="Supprimer" tone="danger" confirmText="Supprimer cette demande ?" action={adminDeleteRequest.bind(null, r.id)} />
              </div>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer font-semibold text-brand-accent">JSON (conception et réponse brute)</summary>
                {d?.validation_errors && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-danger/10 p-3 text-danger">{JSON.stringify(d.validation_errors, null, 2)}</pre>
                )}
                <p className="mt-2 text-ink-mute">
                  stop_reason : {d?.stop_reason ?? "—"} · usage : {d?.usage ? JSON.stringify(d.usage) : "—"}
                </p>
                <pre className="mt-2 max-h-96 overflow-auto rounded-xl bg-[#0f1020] p-3 font-mono text-xs text-success scrollbar-thin">
                  {d?.raw_response ?? JSON.stringify(r.design, null, 2) ?? "—"}
                </pre>
              </details>
            </Card>
          );
        })}
        {!rows?.length && (
          <Card>
            <p className="text-sm text-ink-mute">Aucune demande.</p>
          </Card>
        )}
      </div>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          {page > 1 && (
            <Link className="btn-ghost !py-1.5" href={`/admin/demandes?statut=${status}&page=${page - 1}`}>
              Précédent
            </Link>
          )}
          <span className="text-ink-mute">
            Page {page} / {pages}
          </span>
          {page < pages && (
            <Link className="btn-ghost !py-1.5" href={`/admin/demandes?statut=${status}&page=${page + 1}`}>
              Suivant
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
