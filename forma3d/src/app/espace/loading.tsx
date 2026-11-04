import { getTranslator } from "@/lib/i18n/server";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** Squelette de « Mon espace » pendant la lecture des projets. */
export default async function Loading() {
  const { t } = await getTranslator();
  return (
    <main className="pt-nav relative min-h-dvh overflow-x-clip">
      <LoadingRegion label={t("state.loading")} className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <Skeleton className="h-10 w-1/2 max-w-sm" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="panel p-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="mt-3 h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
      </LoadingRegion>
    </main>
  );
}
