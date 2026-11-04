import { getTranslator } from "@/lib/i18n/server";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/** Squelette de l'éditeur : barre du haut, colonne de gauche, vue 3D, propriétés et barre de demande. */
export default async function Loading() {
  const { t } = await getTranslator();
  return (
    <LoadingRegion label={t("state.loading")} className="flex h-dvh flex-col gap-3 p-3">
      <Skeleton className="h-12 w-full !rounded-2xl" />
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(240px,300px)_1fr_minmax(260px,340px)]">
        <div className="hidden space-y-3 lg:block">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="min-h-[300px] !rounded-lg" />
        <div className="hidden space-y-3 lg:block">
          <Skeleton className="h-10" />
          <Skeleton className="h-56" />
          <Skeleton className="h-32" />
        </div>
      </div>
      <Skeleton className="h-14 w-full !rounded-md" />
    </LoadingRegion>
  );
}
