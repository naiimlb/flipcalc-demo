import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { AdminTitle, Card, Stat, StatusBadge } from "./ui";

interface Stats {
  users: number;
  admins: number;
  requests: number;
  ready: number;
  errors: number;
  processing: number;
  avgDurationMs: number;
  generations24h: number;
  inputTokens: number;
  outputTokens: number;
  errors24h: number;
  perDay: { day: string; count: number }[];
}

const nf = new Intl.NumberFormat("fr-FR");

export default async function AdminHome() {
  const session = await requireAdminPage();
  const [{ data: stats, error }, { data: recent }, { data: logs }] = await Promise.all([
    session.supabase.rpc("admin_stats"),
    session.supabase
      .from("design_requests")
      .select("id, prompt, title, status, created_at, provider")
      .order("created_at", { ascending: false })
      .limit(6),
    session.supabase.from("app_logs").select("id, level, source, message, created_at").eq("level", "error").order("created_at", { ascending: false }).limit(5),
  ]);

  if (error || !stats) {
    return (
      <Card>
        <p className="text-sm text-rose-600">Statistiques indisponibles : vérifiez que le script SQL a bien été exécuté.</p>
      </Card>
    );
  }
  const s = stats as Stats;
  const successRate = s.ready + s.errors > 0 ? Math.round((s.ready / (s.ready + s.errors)) * 100) : 0;
  const maxDay = Math.max(1, ...s.perDay.map((d) => d.count));

  return (
    <div>
      <AdminTitle title="Vue d'ensemble" subtitle="Activité de la plateforme." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Demandes" value={nf.format(s.requests)} hint={`${nf.format(s.generations24h)} sur 24 h`} />
        <Stat label="Réussite" value={`${successRate} %`} hint={`${nf.format(s.errors)} en erreur`} />
        <Stat label="Utilisateurs" value={nf.format(s.users)} hint={`${s.admins} admin${s.admins > 1 ? "s" : ""}`} />
        <Stat label="Durée moyenne" value={`${(s.avgDurationMs / 1000).toFixed(1)} s`} hint={`${nf.format(s.processing)} en cours`} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <h2 className="text-sm font-semibold">Générations par jour</h2>
          <p className="text-xs text-ink-mute">14 derniers jours</p>
          <div className="mt-4 flex h-40 items-end gap-[2px] border-b border-line" role="img" aria-label="Générations par jour sur 14 jours">
            {s.perDay.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[4px] bg-brand-accent transition group-hover:brightness-110"
                  style={{ height: `${d.count === 0 ? 0 : Math.max(3, (d.count / maxDay) * 100)}%` }}
                />
                <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-white group-hover:block">
                  {new Date(d.day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : {d.count}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10.5px] text-ink-mute">
            <span>{s.perDay[0] && new Date(s.perDay[0].day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
            <span>Aujourd&apos;hui</span>
          </div>
          <table className="sr-only">
            <caption>Générations par jour</caption>
            <tbody>
              {s.perDay.map((d) => (
                <tr key={d.day}>
                  <th>{d.day}</th>
                  <td>{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="grid gap-3">
          <Stat label="Jetons consommés" value={nf.format(s.inputTokens + s.outputTokens)} hint={`${nf.format(s.inputTokens)} entrée · ${nf.format(s.outputTokens)} sortie`} />
          <Stat label="Erreurs (24 h)" value={nf.format(s.errors24h)} hint="Détail dans Mode Dev · logs" />
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Dernières demandes</h2>
            <Link href="/admin/demandes" className="text-xs font-semibold text-brand-accent">
              Tout voir
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {(recent ?? []).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title ?? r.prompt}</p>
                  <p className="text-xs text-ink-mute">
                    {new Date(r.created_at).toLocaleString("fr-FR")} · {r.provider ?? "—"}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
            {!recent?.length && <li className="py-4 text-sm text-ink-mute">Aucune demande.</li>}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Dernières erreurs</h2>
            <Link href="/admin/logs" className="text-xs font-semibold text-brand-accent">
              Journal
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {(logs ?? []).map((l) => (
              <li key={l.id} className="py-2">
                <p className="text-sm">{l.message}</p>
                <p className="text-xs text-ink-mute">
                  {l.source} · {new Date(l.created_at).toLocaleString("fr-FR")}
                </p>
              </li>
            ))}
            {!logs?.length && <li className="py-4 text-sm text-ink-mute">Aucune erreur récente.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
