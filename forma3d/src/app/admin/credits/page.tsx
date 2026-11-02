import { requireAdminPage } from "@/lib/admin";
import { getCreditSettings } from "@/lib/settings.server";
import { AdminTitle, Card } from "../ui";
import { CreditSettingsForm, UserCreditActions } from "./CreditsForms";

export const dynamic = "force-dynamic";

interface Account {
  user_id: string;
  free_balance: number;
  bonus_balance: number;
  monthly_allowance: number | null;
}
interface Movement {
  user_id: string;
  delta: number;
  kind: string;
  action: string | null;
  created_at: string;
}

/** Crédits : réglages (allocation, coûts), soldes, consommation par utilisateur et par jour, cadeaux. Aucun paiement. */
export default async function CreditsAdminPage() {
  const session = await requireAdminPage();
  const settings = await getCreditSettings();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: profiles }, accounts, ledger] = await Promise.all([
    session.supabase.from("profiles").select("id, email, display_name, role").order("created_at", { ascending: false }).limit(200),
    session.supabase.from("credit_accounts").select("user_id, free_balance, bonus_balance, monthly_allowance"),
    session.supabase.from("credit_ledger").select("user_id, delta, kind, action, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
  ]);
  const enabled = !accounts.error && !ledger.error;
  const byUser = new Map(((accounts.data ?? []) as Account[]).map((a) => [a.user_id, a]));
  const moves = (ledger.data ?? []) as Movement[];

  // Consommation (nette des remboursements) par utilisateur sur 30 jours, et par jour sur 14 jours.
  const used30 = new Map<string, number>();
  const perDay = new Map<string, number>();
  const dayLimit = Date.now() - 14 * 86_400_000;
  for (const m of moves) {
    if (m.kind !== "consume" && m.kind !== "refund") continue;
    used30.set(m.user_id, (used30.get(m.user_id) ?? 0) - m.delta);
    if (new Date(m.created_at).getTime() >= dayLimit) {
      const day = m.created_at.slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) - m.delta);
    }
  }
  const days = [...perDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  // Matrice utilisateur × jour (7 derniers jours).
  const week = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  const matrix = new Map<string, Map<string, number>>();
  for (const m of moves) {
    if (m.kind !== "consume" && m.kind !== "refund") continue;
    const day = m.created_at.slice(0, 10);
    if (!week.includes(day)) continue;
    const row = matrix.get(m.user_id) ?? new Map<string, number>();
    row.set(day, (row.get(day) ?? 0) - m.delta);
    matrix.set(m.user_id, row);
  }
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name || p.email]));
  const maxDay = Math.max(1, ...days.map(([, n]) => n));

  return (
    <div className="space-y-4">
      <AdminTitle
        title="Crédits"
        subtitle={
          enabled
            ? "Chaque action consomme des crédits ; les crédits gratuits se renouvellent chaque mois. Aucun paiement en ligne."
            : "Les crédits ne sont pas encore activés : appliquez le script SQL de la phase 5 (supabase/migrations/20261105000000_phase5_credits.sql). D'ici là, aucune limite de crédits."
        }
      />
      <Card>
        <h2 className="mb-3 font-semibold">Réglages</h2>
        <CreditSettingsForm initial={settings} />
        <p className="mt-3 text-xs text-ink-mute">
          Les administrateurs ne consomment pas de crédits. Une génération échouée ou servie sans IA (cache, modèle d&apos;exemple) est
          remboursée automatiquement.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Consommation par jour (14 derniers jours)</h2>
        {days.length === 0 ? (
          <p className="text-sm text-ink-mute">Aucune consommation.</p>
        ) : (
          <ul className="space-y-1.5">
            {days.map(([day, n]) => (
              <li key={day} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-ink-soft">{new Date(day).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span>
                <span className="h-2.5 rounded-full bg-gradient-to-r from-brand-from to-brand-to" style={{ width: `${Math.max(4, (n / maxDay) * 100)}%` }} />
                <span className="tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 font-semibold">Consommation par utilisateur et par jour (7 jours)</h2>
        {matrix.size === 0 ? (
          <p className="text-sm text-ink-mute">Aucune consommation cette semaine.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-ink-mute">
              <tr>
                <th className="pb-2">Compte</th>
                {week.map((d) => (
                  <th key={d} className="pb-2 text-center font-medium">
                    {new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...matrix.entries()].map(([uid, row]) => (
                <tr key={uid} className="border-t border-line">
                  <td className="py-1.5 pe-2">{names.get(uid) ?? uid.slice(0, 8)}</td>
                  {week.map((d) => (
                    <td key={d} className="py-1.5 text-center tabular-nums">
                      {row.get(d) ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="mb-3 font-semibold">Utilisateurs</h2>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-mute">
            <tr>
              <th className="pb-2">Compte</th>
              <th className="pb-2">Solde</th>
              <th className="pb-2">Gratuits / offerts</th>
              <th className="pb-2">Utilisés (30 j)</th>
              <th className="pb-2">Offrir, retirer, allocation</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const a = byUser.get(p.id);
              return (
                <tr key={p.id} className="border-t border-line align-middle">
                  <td className="py-2 pe-2">
                    <span className="block font-medium">{p.display_name || p.email}</span>
                    <span className="text-xs text-ink-mute">
                      {p.email}
                      {p.role === "admin" ? " · admin (illimité)" : ""}
                    </span>
                  </td>
                  <td className="py-2 pe-2 font-semibold tabular-nums">{a ? a.free_balance + a.bonus_balance : "—"}</td>
                  <td className="py-2 pe-2 tabular-nums text-ink-soft">
                    {a ? `${a.free_balance} / ${a.bonus_balance}` : `${settings.monthlyFree} / 0 (pas encore utilisé)`}
                    {a?.monthly_allowance != null && <span className="block text-xs text-brand-accent">allocation : {a.monthly_allowance}/mois</span>}
                  </td>
                  <td className="py-2 pe-2 tabular-nums">{used30.get(p.id) ?? 0}</td>
                  <td className="py-2">{enabled ? <UserCreditActions userId={p.id} allowance={a?.monthly_allowance ?? null} /> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
