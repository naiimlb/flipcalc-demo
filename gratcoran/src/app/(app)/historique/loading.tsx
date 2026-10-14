export default function HistoryLoading() {
  return (
    <main className="pb-tabbar mx-auto max-w-md px-5" aria-busy="true" aria-label="Chargement de l'historique">
      <h1 className="pb-4 pt-6 text-[32px] font-bold tracking-tight">Historique</h1>
      <div className="mb-3 h-4 w-28 animate-pulse rounded-md bg-line" />
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-line" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 animate-pulse rounded-md bg-line" />
              <div className="h-3.5 w-1/3 animate-pulse rounded-md bg-line" />
            </div>
            <div className="h-6 w-14 animate-pulse rounded-md bg-line" />
          </div>
        ))}
      </div>
    </main>
  );
}
