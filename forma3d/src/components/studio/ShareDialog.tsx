"use client";

import { useCallback, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useT } from "../app/Preferences";
import { IconX, Spinner } from "../icons";
import { Portal } from "../Portal";
import { Toggle } from "./ui";

interface ShareState {
  token: string;
  enabled: boolean;
  allowComments: boolean;
}

/**
 * Partage d'un projet : lien en lecture seule (désactivable, renouvelable, commentaires au choix)
 * et publication dans la galerie publique (choix explicite, jamais par défaut).
 */
export function ShareDialog({ requestId, onClose, onToast }: { requestId: string; onClose(): void; onToast(message: string): void }) {
  const t = useT();
  const supabase = getBrowserSupabase();
  const [share, setShare] = useState<ShareState | null>(null);
  const [shareError, setShareError] = useState(false);
  const [published, setPublished] = useState<boolean | null>(null);
  const [galleryError, setGalleryError] = useState(false);
  const [showName, setShowName] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadShare = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("shares").select("token, enabled, allow_comments").eq("request_id", requestId).maybeSingle();
    if (data) setShare({ token: data.token, enabled: data.enabled, allowComments: data.allow_comments });
  }, [supabase, requestId]);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { error } = await supabase.from("shares").select("id").limit(1);
      if (error) setShareError(true);
      else await loadShare();
      const gallery = await supabase.from("gallery").select("id, status").eq("request_id", requestId).maybeSingle();
      if (gallery.error) setGalleryError(true);
      else setPublished(gallery.data?.status === "published");
    })();
  }, [supabase, requestId, loadShare]);

  const url = share ? `${window.location.origin}/p/${share.token}` : "";

  const createLink = async (regenerate = false) => {
    if (!supabase) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_share", { p_request_id: requestId, p_regenerate: regenerate });
    setBusy(false);
    if (error || typeof data !== "string") {
      setShareError(true);
      return;
    }
    await loadShare();
  };

  const update = async (patch: { enabled?: boolean; allow_comments?: boolean }) => {
    if (!supabase || !share) return;
    const { error } = await supabase.from("shares").update(patch).eq("request_id", requestId);
    if (error) return onToast(t("toast.updateFailed"));
    setShare({ ...share, enabled: patch.enabled ?? share.enabled, allowComments: patch.allow_comments ?? share.allowComments });
    if (patch.enabled === false) onToast(t("share.disabled"));
  };

  const publish = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("publish_to_gallery", { p_request_id: requestId, p_show_author: showName });
    setBusy(false);
    if (error) return onToast(error.message.includes("HIDDEN") ? t("gallery.reportFailed") : t("toast.saveFailed"));
    setPublished(true);
    onToast(t("gallery.published"));
  };

  const unpublish = async () => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from("gallery").delete().eq("request_id", requestId);
    setBusy(false);
    if (error) return onToast(t("toast.updateFailed"));
    setPublished(false);
    onToast(t("gallery.unpublished"));
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-end justify-center bg-night/55 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-5 shadow-float">
          <div className="flex items-start justify-between gap-3">
            <h2 id="share-title" className="text-lg font-semibold">
              {t("share.title")}
            </h2>
            <button type="button" onClick={onClose} className="icon-btn" aria-label={t("menu.close")}>
              <IconX size={15} />
            </button>
          </div>

          {/* Lien de partage */}
          <section className="mt-3">
            <p className="text-sm text-ink-soft">{t("share.text")}</p>
            {shareError ? (
              <p className="mt-3 rounded-xl bg-warning/10 p-3 text-xs text-warning">{t("share.unavailable")}</p>
            ) : !share ? (
              <button type="button" onClick={() => createLink()} disabled={busy} className="btn-accent mt-3 !text-xs">
                {busy ? <Spinner size={12} /> : null} {t("left.share")}
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <input readOnly value={share.enabled ? url : "—"} className="input !py-2 !text-xs" aria-label={t("share.title")} onFocus={(e) => e.target.select()} />
                  <button
                    type="button"
                    disabled={!share.enabled}
                    onClick={async () => {
                      await navigator.clipboard?.writeText(url).catch(() => {});
                      onToast(t("share.copied"));
                    }}
                    className="btn-dark shrink-0 !text-xs"
                  >
                    {t("share.copy")}
                  </button>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm">
                  {t("share.comments")}
                  <Toggle checked={share.allowComments} onChange={(v) => update({ allow_comments: v })} label={t("share.comments")} />
                </label>
                <div className="flex flex-wrap gap-2">
                  {share.enabled ? (
                    <button type="button" onClick={() => update({ enabled: false })} className="btn-ghost !text-xs">
                      {t("share.disable")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => update({ enabled: true })} className="btn-ghost !text-xs">
                      {t("share.enable")}
                    </button>
                  )}
                  <button type="button" onClick={() => createLink(true)} disabled={busy} className="btn-ghost !text-xs">
                    {t("share.regenerate")}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Galerie publique */}
          <section className="mt-5 border-t border-line pt-4">
            <h3 className="text-sm font-semibold">{t("gallery.publishTitle")}</h3>
            <p className="mt-1 text-sm text-ink-soft">{t("gallery.publishText")}</p>
            {galleryError ? (
              <p className="mt-3 rounded-xl bg-warning/10 p-3 text-xs text-warning">{t("gallery.unavailable")}</p>
            ) : published === null ? (
              <Spinner size={16} />
            ) : published ? (
              <button type="button" onClick={unpublish} disabled={busy} className="btn-ghost mt-3 !text-xs">
                {t("gallery.unpublish")}
              </button>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Toggle checked={showName} onChange={setShowName} label={t("gallery.showName")} />
                  {t("gallery.showName")}
                </label>
                <button type="button" onClick={publish} disabled={busy} className="btn-accent !text-xs">
                  {busy ? <Spinner size={12} /> : null} {t("gallery.publish")}
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </Portal>
  );
}
