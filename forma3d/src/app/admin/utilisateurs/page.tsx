import { requireAdminPage } from "@/lib/admin";
import { setUserRole } from "../actions";
import { RowAction } from "../RowAction";
import { AdminTitle, Card } from "../ui";

export default async function UsersPage() {
  const session = await requireAdminPage();
  const [{ data: profiles }, { data: usage }] = await Promise.all([
    session.supabase.from("profiles").select("id, email, display_name, role, created_at").order("created_at", { ascending: true }).limit(500),
    session.supabase
      .from("usage_events")
      .select("user_id, created_at")
      .gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
      .limit(10000),
  ]);
  const dayAgo = Date.now() - 86_400_000;
  const counts = new Map<string, { month: number; day: number }>();
  for (const u of usage ?? []) {
    const c = counts.get(u.user_id) ?? { month: 0, day: 0 };
    c.month += 1;
    if (new Date(u.created_at).getTime() > dayAgo) c.day += 1;
    counts.set(u.user_id, c);
  }

  return (
    <div>
      <AdminTitle title="Utilisateurs" subtitle={`${profiles?.length ?? 0} compte(s). Le premier compte créé via /setup est administrateur.`} />
      <Card className="overflow-x-auto !p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-mute">
            <tr>
              <th className="px-4 py-3 font-semibold">Compte</th>
              <th className="px-4 py-3 font-semibold">Rôle</th>
              <th className="px-4 py-3 text-right font-semibold">Générations 24 h</th>
              <th className="px-4 py-3 text-right font-semibold">30 jours</th>
              <th className="px-4 py-3 font-semibold">Inscription</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(profiles ?? []).map((p) => {
              const c = counts.get(p.id) ?? { month: 0, day: 0 };
              const self = p.id === session.user.id;
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.display_name ?? p.email}</p>
                    <p className="text-xs text-ink-mute">{p.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`chip ${p.role === "admin" ? "bg-night text-white" : "bg-paper text-ink-soft"}`}>
                      {p.role === "admin" ? "Admin" : "Utilisateur"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.day}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.month}</td>
                  <td className="px-4 py-3 text-xs text-ink-mute">{new Date(p.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3 text-right">
                    {!self &&
                      (p.role === "admin" ? (
                        <RowAction label="Retirer admin" confirmText={`Retirer le rôle admin à ${p.email} ?`} action={setUserRole.bind(null, p.id, "user")} />
                      ) : (
                        <RowAction label="Promouvoir admin" confirmText={`Donner le rôle admin à ${p.email} ?`} action={setUserRole.bind(null, p.id, "admin")} />
                      ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
