"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Design } from "@/lib/design/schema";
import { usePreferences } from "../app/Preferences";
import { IconAlert, IconSparkles, Spinner } from "../icons";
import { DEFAULT_VIEWER_SETTINGS, viewerBackgroundCss, type RenderMode } from "../viewer/settings";

const ModelViewer = dynamic(() => import("../viewer/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-white/80">
      <Spinner size={20} />
    </div>
  ),
});

export interface SharedComment {
  id: number;
  pseudo: string;
  body: string;
  created_at: string;
}

const REASONS = ["inappropriate", "dangerous", "spam", "other"] as const;

/** Projet en lecture seule : galerie publique ou lien de partage (avec commentaires). */
export function ProjectView({
  kind,
  id,
  title,
  prompt,
  design,
  meta,
  comments = [],
  allowComments = false,
}: {
  kind: "gallery" | "share";
  id: string;
  title: string;
  prompt: string;
  design: Design;
  meta?: string;
  comments?: SharedComment[];
  allowComments?: boolean;
}) {
  const { t, dark } = usePreferences();
  const [mode, setMode] = useState<RenderMode>("neon");
  const d = design.dimensions;

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="relative h-[52dvh] min-h-[320px] overflow-hidden rounded-[24px] shadow-card" style={{ background: viewerBackgroundCss(mode, dark) }}>
        <ModelViewer design={design} settings={{ ...DEFAULT_VIEWER_SETTINGS, mode }} focusId={null} onFocusChange={() => {}} />
        <div className="absolute end-3 top-3 flex gap-1 rounded-full bg-black/25 p-1 backdrop-blur">
          {(["neon", "real"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === m ? "bg-white text-brand-accent" : "text-white"}`}
            >
              {t(m === "neon" ? "mode.neon" : "mode.real")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <section className="panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-accent">{kind === "share" ? t("share.readOnly") : design.category}</p>
          <h1 className="mt-1 text-xl font-semibold leading-snug">{title}</h1>
          {meta && <p className="mt-0.5 text-xs text-ink-mute">{meta}</p>}
          <p className="mt-3 text-[13px] text-ink-soft">« {prompt} »</p>
          <p className="mt-3 text-[13px] leading-relaxed">{design.solution.concept}</p>
          <dl className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            {[
              [t("dim.width"), d.width],
              [t("dim.depth"), d.depth],
              [t("dim.height"), d.height],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-paper px-2 py-2">
                <dt className="text-[10px] font-semibold text-brand-accent">{label}</dt>
                <dd className="text-[12.5px] font-semibold tabular-nums">{Math.round(Number(value))} mm</dd>
              </div>
            ))}
          </dl>
          {design.materiaux_conseilles[0] && (
            <p className="mt-3 text-[12px] text-ink-soft">
              <span className="font-semibold text-ink">{t("mat.recommended")} :</span> {design.materiaux_conseilles[0].nom} — {design.materiaux_conseilles[0].pourquoi}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {kind === "gallery" ? (
              <Link href={`/studio?depart=${id}`} className="btn-accent !text-xs">
                <IconSparkles size={14} /> {t("gallery.useAsStart")}
              </Link>
            ) : (
              <Link href="/studio" className="btn-accent !text-xs">
                <IconSparkles size={14} /> {t("share.createOwn")}
              </Link>
            )}
            {kind === "gallery" && <ReportButton id={id} />}
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="text-sm font-semibold">{t("left.analysis")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{design.analysis.summary}</p>
          {design.fabrication.length > 0 && (
            <>
              <h2 className="mt-3 text-sm font-semibold">{t("panel.fabrication")}</h2>
              <ol className="mt-1 list-decimal space-y-1 ps-5 text-[12.5px] text-ink-soft">
                {design.fabrication.map((f, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink">{f.title}</span> — {f.detail}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        {kind === "share" && <Comments token={id} comments={comments} allow={allowComments} />}
      </div>
    </div>
  );
}

function ReportButton({ id }: { id: string }) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("inappropriate");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/gallery/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reason: t(`gallery.reason.${reason}`) }),
      });
      setMessage(res.ok ? t("gallery.reported") : t("gallery.reportFailed"));
      if (res.ok) setOpen(false);
    } catch {
      setMessage(t("gallery.reportFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost !text-xs">
          <IconAlert size={14} /> {t("gallery.report")}
        </button>
      ) : (
        <div className="rounded-xl border border-line p-3">
          <label htmlFor="report-reason" className="label">
            {t("gallery.reportReason")}
          </label>
          <select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])} className="input">
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`gallery.reason.${r}`)}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={send} disabled={busy} className="btn-dark !text-xs">
              {busy ? <Spinner size={12} /> : null} {t("gallery.report")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost !text-xs">
              {t("menu.close")}
            </button>
          </div>
        </div>
      )}
      {message && <p className="mt-2 text-xs text-ink-soft" role="status">{message}</p>}
    </div>
  );
}

function Comments({ token, comments, allow }: { token: string; comments: SharedComment[]; allow: boolean }) {
  const { t, locale } = usePreferences();
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pseudo.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/share/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pseudo, body }),
      });
      if (res.ok) {
        setBody("");
        setMessage(t("share.sent"));
        router.refresh();
      } else setMessage(t("share.sendFailed"));
    } catch {
      setMessage(t("share.sendFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-4" aria-labelledby="comments-title">
      <h2 id="comments-title" className="text-sm font-semibold">
        {t("share.commentsTitle")} ({comments.length})
      </h2>
      {comments.length === 0 ? (
        <p className="mt-2 text-xs text-ink-mute">{t("share.noComments")}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl bg-paper p-2.5">
              <p className="text-[12px] font-semibold">
                {c.pseudo}{" "}
                <span className="font-normal text-ink-mute">
                  · {new Date(c.created_at).toLocaleDateString(locale === "ar" ? "ar" : locale === "en" ? "en-GB" : "fr-FR")}
                </span>
              </p>
              <p className="mt-0.5 whitespace-pre-line text-[12.5px] text-ink-soft">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {allow ? (
        <form onSubmit={send} className="mt-3 space-y-2">
          <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={40} required placeholder={t("share.pseudo")} aria-label={t("share.pseudo")} className="input" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} required rows={3} placeholder={t("share.comment")} aria-label={t("share.comment")} className="input resize-y" />
          <button type="submit" disabled={busy} className="btn-dark !text-xs">
            {busy ? <Spinner size={12} /> : null} {t("share.send")}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-ink-mute">{t("share.closed")}</p>
      )}
      {message && <p className="mt-2 text-xs text-ink-soft" role="status">{message}</p>}
    </section>
  );
}
