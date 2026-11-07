import { PageHeader } from "@/components/ui";
import { activeModules, plannedModules } from "@/modules/registry";
import { todayCards } from "@/modules/today";

export default function TodayPage() {
  return (
    <>
      <PageHeader title="Aujourd'hui" subtitle="Un peu chaque jour vaut mieux que beaucoup une fois." />
      <div className="space-y-4">
        {activeModules.map((m) => {
          const TodayCard = todayCards[m.id];
          return TodayCard ? <TodayCard key={m.id} /> : null;
        })}
      </div>
      {plannedModules.length > 0 ? (
        <section className="mt-8" aria-labelledby="a-venir">
          <h2 id="a-venir" className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
            Bientôt
          </h2>
          <ul className="mt-2 space-y-2">
            {plannedModules.map((m) => (
              <li key={m.id} className="rounded-2xl border border-dashed border-line px-4 py-3 text-[15px]">
                <span className="font-medium">{m.title}</span>
                <span className="block text-sm text-muted">{m.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
