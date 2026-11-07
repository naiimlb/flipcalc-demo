import { Card, PageHeader } from "@/components/ui";
import { plannedModules } from "@/modules/registry";

export default function TodayPage() {
  return (
    <>
      <PageHeader title="Aujourd'hui" />
      <Card>
        <p className="text-muted">Session du jour : bientôt disponible.</p>
      </Card>
      <ul className="mt-6 space-y-2">
        {plannedModules.map((m) => (
          <li key={m.id} className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">
            <span className="font-medium text-ink">{m.title}</span> — à venir. {m.summary}
          </li>
        ))}
      </ul>
    </>
  );
}
