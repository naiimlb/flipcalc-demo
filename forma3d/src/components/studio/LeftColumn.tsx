"use client";

import Link from "next/link";
import type { RequestItem } from "@/lib/requests";
import { IconAlert, IconCube, IconMicroscope, IconPin, IconPlus, IconSparkles, IconStar } from "../icons";
import { RecentCard } from "./RecentCard";
import { formatDate, formatDuration, formatRelative } from "./format";
import { BulletList, Field, Panel, StatusChip } from "./ui";

export function LeftColumn({
  item,
  items,
  onSelect,
  onNew,
  onToggleFavorite,
  onSignupPrompt,
  demoMode,
  signedIn,
}: {
  item: RequestItem | null;
  items: RequestItem[];
  onSelect(id: string): void;
  onNew(): void;
  onToggleFavorite(item: RequestItem): void;
  onSignupPrompt(): void;
  demoMode: boolean;
  signedIn: boolean;
}) {
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
                {item ? item.title ?? "Nouvelle demande" : "Aucun projet"}
              </h2>
              <span className="flex shrink-0 items-center gap-1">
                {canFavorite && item && (
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(item)}
                    aria-pressed={item.isFavorite}
                    aria-label={item.isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
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
            <Field label="Demande :">
              <span className="line-clamp-4">« {item.prompt} »</span>
            </Field>
            {design && <Field label="Solution :">{design.solution.concept}</Field>}
            <Field label="Créée le :" tone="accent">
              {formatDate(item.createdAt)}
              {item.durationMs ? (
                <span className="ml-1 font-normal text-ink-mute">
                  · générée en{" "}
                  {item.durationMs < 60_000
                    ? `${(item.durationMs / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`
                    : formatDuration(Math.round(item.durationMs / 60_000))}
                </span>
              ) : null}
            </Field>
          </div>
        )}
      </section>

      {/* Analyse */}
      <Panel icon={<IconMicroscope size={15} />} title="Analyse du problème">
        {design ? (
          <div className="space-y-2">
            <div className="rounded-xl border border-line/80 p-2.5">
              <Field label="Problème :">{design.analysis.summary}</Field>
            </div>
            <div className="rounded-xl border border-line/80 p-2.5">
              <p className="mb-1 text-[10.5px] font-medium text-ink-mute">Besoins :</p>
              <BulletList items={design.analysis.needs} />
            </div>
            <div className="rounded-xl border border-line/80 p-2.5">
              <p className="mb-1 text-[10.5px] font-medium text-ink-mute">Contraintes :</p>
              <BulletList items={design.analysis.constraints} />
            </div>
            {design.analysis.assumptions.length > 0 && (
              <div className="rounded-xl border border-line/80 p-2.5">
                <p className="mb-1 text-[10.5px] font-medium text-ink-mute">Hypothèses :</p>
                <BulletList items={design.analysis.assumptions} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-ink-mute">
            {item?.status === "processing" ? "Analyse en cours…" : "L'analyse apparaîtra ici après la génération."}
          </p>
        )}
        <button type="button" onClick={onNew} className="btn-outline-accent mt-3 w-full !rounded-xl !py-2 !text-xs">
          <IconPlus size={14} /> Nouvelle demande
        </button>
      </Panel>

      {/* Alerte contextuelle */}
      <Notice item={item} demoMode={demoMode} signedIn={signedIn} onSignupPrompt={onSignupPrompt} />

      {item && signedIn && !item.sample && (
        <p className="px-1 text-[11px] text-white/85">
          {item.modelPath ? "✓ Modèle 3D sauvegardé dans votre espace · " : ""}
          <Link href="/espace" className="font-semibold underline-offset-2 hover:underline">
            Mon espace
          </Link>
        </p>
      )}

      <RecentCard items={items} selectedId={item?.id ?? null} onSelect={onSelect} />
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
  let title: string | null = null;
  let body: string | null = null;
  let meta: string | null = null;

  if (item?.guest) {
    return (
      <div className="rounded-2xl bg-white p-3 shadow-soft ring-2 ring-brand-accent/40">
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-accent">
          <IconSparkles size={14} /> Résultat non sauvegardé
        </p>
        <p className="mt-1 text-[11.5px] leading-snug text-ink-soft">
          Cet essai est gardé dans ce navigateur. Créez un compte gratuit : il sera ajouté à votre espace et vous le retrouverez partout.
        </p>
        <button type="button" onClick={onSignupPrompt} className="btn-dark mt-2.5 w-full !py-2 !text-xs">
          Sauvegarder dans mon espace
        </button>
      </div>
    );
  }

  if (item?.status === "error") {
    title = "Génération interrompue";
    body = item.error ?? "La génération a échoué. Relancez une demande.";
    meta = formatRelative(item.createdAt);
  } else if (demoMode) {
    title = "Mode démo";
    body = "Supabase n'est pas configuré : rien n'est sauvegardé. Voir le README pour brancher la base.";
  } else if (item?.sample && !signedIn) {
    title = "Projet d'exemple";
    body = "Décrivez votre propre problème dans la barre du haut : un essai est offert, sans compte.";
  } else if (item?.sample) {
    title = "Projet d'exemple";
    body = "Créez votre première demande : elle apparaîtra ici et dans l'historique.";
  } else if (item?.provider === "demo") {
    title = "Modèle d'exemple";
    body = "L'IA n'est pas disponible pour le moment (clé ou crédit manquant) : le modèle d'exemple le plus proche de votre demande a été utilisé.";
  }
  if (!title) return null;

  return (
    <div className="rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-100">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600">
        {item?.status === "error" ? <IconAlert size={14} /> : <IconSparkles size={14} />}
        {title}
      </p>
      <p className="mt-1 text-[11.5px] leading-snug text-rose-500/90">{body}</p>
      {meta && <p className="mt-1.5 text-[10.5px] text-rose-400">{meta}</p>}
    </div>
  );
}
