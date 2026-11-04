import { getTranslator } from "@/lib/i18n/server";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** Squelette de la galerie pendant la lecture des publications. */
export default async function Loading() {
  const { t } = await getTranslator();
  return (
    <main className="pt-nav relative min-h-dvh overflow-x-clip">
      <LoadingRegion label={t("state.loading")} className="w-full px-4 pb-12 pt-6 sm:px-6 lg:px-10">
        <Skeleton className="h-12 w-2/3 max-w-md sm:h-16" />
        <Skeleton className="mt-3 h-4 w-full max-w-xl" />
        <Skeleton className="mt-5 h-11 w-full max-w-lg !rounded-md" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="panel p-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      </LoadingRegion>
    </main>
  );
}
