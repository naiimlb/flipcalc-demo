"use client";

import Link from "next/link";
import type { RequestItem } from "@/lib/requests";
import type { VariantId } from "@/lib/design/variants";
import { IconAlert, IconCube, IconHistory, IconMicroscope, IconPin, IconPlus, IconSparkles, IconStar } from "../icons";
import { RecentCard } from "./RecentCard";
import { formatDate, formatDuration, formatRelative } from "./format";
import { BulletList, Field, Panel, Reveal, StatusChip } from "./ui";
import { VariantButtons } from "./VariantButtons";
import { useT } from "../app/Preferences";
import type { Translator } from "@/lib/i18n";

export function LeftColumn({
  item,
  items,
  onSelect,
  onNew,
  onToggleFavorite,
  onSignupPrompt,
  demoMode,
  signedIn,
  reveal = false,
  busy = false,
  onAdjust,
  onCompare,
  canCompare = false,
  onShare,
}: {
  item: RequestItem | null;
  items: RequestItem[];
  onSelect(id: string): void;
  onNew(): void;
  onToggleFavorite(item: RequestItem): void;
  onSignupPrompt(): void;
  demoMode: boolean;
  signedIn: boolean;
  /** Les panneaux apparaissent l'un après l'autre (conception qui vient d'arriver). */
  reveal?: boolean;
  busy?: boolean;
  onAdjust?: (variant: VariantId) => void;
  onCompare?: () => void;
  canCompare?: boolean;
  /** Partage et publication (propriétaire d'une conception terminée). */
  onShare?: () => void;
}) {
  const t = useT();
  const canFavorite = Boolean(item && signedIn && !item.sample && !item.guest && !item.id.startsWith("tmp-"));
  const design = item?.design ?? null;

  return (
    <div className="flex min-h-0 flex-col gap-3 scrollbar-thin lg:h-full lg:overflow-y-auto lg:pr-0.5 [&>*]:shrink-0">
      {/* Fiche de la demande */}
      <section className="panel p-3">
        <div className="flex items-start gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-from to-brand-to text-white shadow-soft">
            <IconCube size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="line-clamp-2 text-[13.5px] font-semibold leading-tight">
                {item ? item.title ?? t("left.newRequest") : t("left.none")}
              </h2>
              <span className="flex shrink-0 items-center gap-1">
                {canFavorite && item && (
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(item)}
                    aria-pressed={item.isFavorite}
                    aria-label={item.isFavorite ? t("left.favRemove") : t("left.favAdd")}
                    className={`rounded-full p-1 transition ${item.isFavorite ? "text-amber-500" : "text-ink-mute hover:text-amber-500"}`}
                  >
                    <IconStar size={15} fill={item.isFavorite ? "currentColor" : "none"} />
                  </button>
                )}
                {item && <StatusChip status={item.status} compact />}
              </span>
            </div>
            {design && (
              <p className="mt-0.5 text-[11px] text-ink-mute">
                {design.category} · {design.difficulty}
              </p>
            )}
            {item && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-mute">
                <IconPin size={11} /> {formatRelative(item.createdAt)}
              </p>
            )}
          </div>
        </div>
        {item && (
          <div className="mt-3 space-y-2 rounded-xl border border-line/80 p-2.5">
            <Field label={t("left.request")}>
              <span className="line-clamp-4">« {item.prompt} »</span>
            </Field>
            {design && <Field label={t("left.solution")}>{design.solution.concept}</Field>}
            {canFavorite && onShare && item.status === "ready" && (
              <button type="button" onClick={onShare} className="btn-outline-accent w-full !rounded-xl !py-1.5 !text-xs">
                {t("left.share")} · {t("left.publish")}
              </button>
            )}
            <Field label={t("left.createdOn")} tone="accent">
              {formatDate(item.createdAt)}
              {item.durationMs ? (
                <span className="ms-1 font-normal text-ink-mute">
                  ·{" "}
                  {t("left.generatedIn", {
                    d:
                      item.durationMs < 60_000
                        ? `${(item.durationMs / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`
                        : formatDuration(Math.round(item.durationMs / 60_000)),
                  })}
                </span>
              ) : null}
            </Field>
          </div>
        )}
      </section>

      {/* Analyse */}
      <Reveal index={0} on={reveal}>
      <Panel icon={<IconMicroscope size={15} />} title={t("left.analysis")}>
        {design ? (
          <div className="space-y-2">
            <div className="rounded-xl border border-line/80 p-2.5">
              <Field label={t("left.problem")}>{design.analysis.summary}</Field>
            </div>
            <div className="rounded-xl border border-line/80 p-2.5">
              <p className="mb-1 text-[10.5px] font-medium text-ink-mute">{t("left.needs")}</p>
              <BulletList items={design.analysis.needs} />
            </div>
            <div className="rounded-xl border border-line/80 p-2.5">
              <p className="mb-1 text-[10.5px] font-medium text-ink-mute">{t("left.constraints")}</p>
              <BulletList items={design.analysis.constraints} />
            </div>
            {design.analysis.assumptions.length > 0 && (
              <div className="rounded-xl border border-line/80 p-2.5">
                <p className="mb-1 text-[10.5px] font-medium text-ink-mute">{t("left.assumptions")}</p>
                <BulletList items={design.analysis.assumptions} />
              </div>
            )}
          </div>
        ) : (
          <LiveAnalysis item={item} />
        )}
        <button type="button" onClick={onNew} className="btn-outline-accent mt-3 w-full !rounded-xl !py-2 !text-xs">
          <IconPlus size={14} /> {t("left.newRequest")}
        </button>
      </Panel>
      </Reveal>

      {/* Ajuster : nouvelle version de la solution */}
      {design && onAdjust && (
        <Reveal index={1} on={reveal}>
          <Panel icon={<IconHistory size={15} />} title={t("left.adjust")}>
            {design.variante && (
              <p className="mb-2 text-[11px] text-ink-mute">
                {t("left.versionOf", { label: t(`variant.${design.variante.objectif}`), base: design.variante.base })}
              </p>
            )}
            <VariantButtons onAdjust={onAdjust} onCompare={onCompare} disabled={busy || item?.status !== "ready"} canCompare={canCompare} />
          </Panel>
        </Reveal>
      )}

      {/* Alerte contextuelle */}
      <Notice item={item} demoMode={demoMode} signedIn={signedIn} onSignupPrompt={onSignupPrompt} />

      {item && signedIn && !item.sample && (
        <p className="px-1 text-[11px] text-fg/70">
          {item.modelPath ? t("left.saved") : ""}
          <Link href="/espace" className="font-semibold underline-offset-2 hover:underline">
            {t("nav.space")}
          </Link>
        </p>
      )}

      <RecentCard items={items} selectedId={item?.id ?? null} onSelect={onSelect} />
    </div>
  );
}

/** Analyse écrite en direct pendant que l'IA travaille (flux de la réponse), sinon texte d'attente. */
function LiveAnalysis({ item }: { item: RequestItem | null }) {
  const t = useT();
  const analysis = item?.status === "processing" ? item.stream?.analysis : null;
  if (!analysis || (!analysis.summary && !analysis.needs?.length)) {
    return (
      <p className="text-xs text-ink-mute">
        {item?.status === "processing" ? t("left.analysisPending") : t("left.analysisLater")}
      </p>
    );
  }
  return (
    <div className="space-y-2" aria-live="polite">
      {analysis.summary && (
        <div className="rounded-xl border border-line/80 p-2.5">
          <Field label={t("left.problem")}>
            {analysis.summary}
            <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-brand-accent align-middle" aria-hidden />
          </Field>
        </div>
      )}
      {analysis.needs && analysis.needs.length > 0 && (
        <div className="rounded-xl border border-line/80 p-2.5">
          <p className="mb-1 text-[10.5px] font-medium text-ink-mute">{t("left.needs")}</p>
          <BulletList items={analysis.needs} />
        </div>
      )}
      {analysis.constraints && analysis.constraints.length > 0 && (
        <div className="rounded-xl border border-line/80 p-2.5">
          <p className="mb-1 text-[10.5px] font-medium text-ink-mute">{t("left.constraints")}</p>
          <BulletList items={analysis.constraints} />
        </div>
      )}
    </div>
  );
}

function Notice({
  item,
  demoMode,
  signedIn,
  onSignupPrompt,
}: {
  item: RequestItem | null;
  demoMode: boolean;
  signedIn: boolean;
  onSignupPrompt(): void;
}) {
  const t: Translator = useT();
  let title: string | null = null;
  let body: string | null = null;
  let meta: string | null = null;

  if (item?.guest) {
    return (
      <div className="rounded-2xl bg-surface p-3 shadow-soft ring-2 ring-brand-accent/40">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-accent">
          <IconSparkles size={14} /> {t("notice.guestTitle")}
        </p>
        <p className="mt-1 text-[11.5px] leading-snug text-ink-soft">{t("notice.guestBody")}</p>
        <button type="button" onClick={onSignupPrompt} className="btn-dark mt-2.5 w-full !py-2 !text-xs">
          {t("notice.guestCta")}
        </button>
      </div>
    );
  }

  if (item?.status === "error") {
    title = t("notice.errorTitle");
    body = item.error ?? t("notice.errorBody");
    meta = formatRelative(item.createdAt);
  } else if (demoMode) {
    title = t("notice.demoTitle");
    body = t("notice.demoBody");
  } else if (item?.sample && !signedIn) {
    title = t("notice.sampleTitle");
    body = t("notice.sampleGuest");
  } else if (item?.sample) {
    title = t("notice.sampleTitle");
    body = t("notice.sampleUser");
  } else if (item?.provider === "demo" && item.design?.variante) {
    title = t("notice.localVariantTitle");
    body = t("notice.localVariantBody");
  } else if (item?.provider === "demo") {
    title = t("notice.fallbackTitle");
    body = t("notice.fallbackBody");
  }
  if (!title) return null;

  return (
    <div className="rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:ring-rose-500/20">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600">
        {item?.status === "error" ? <IconAlert size={14} /> : <IconSparkles size={14} />}
        {title}
      </p>
      <p className="mt-1 text-[11.5px] leading-snug text-rose-500/90">{body}</p>
      {meta && <p className="mt-1.5 text-[10.5px] text-rose-400">{meta}</p>}
    </div>
  );
}
