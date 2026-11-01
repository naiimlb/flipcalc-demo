"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { IconImage, IconSparkles, IconX, Spinner } from "../icons";
import { readDraft, saveDraft } from "./draft";
import { prepareImage, type ImagePayload } from "./image";

const EXAMPLES = [
  "Une solution pour ranger mes câbles de charge",
  "Un support de téléphone pour mon bureau",
  "Un porte-clés mural pour l'entrée",
  "Un bac à herbes aromatiques pour le balcon",
];

export const FOCUS_PROMPT_EVENT = "forma3d:focus-prompt";

/** Barre de demande toujours visible : texte, photo optionnelle, bouton Générer. */
export function PromptBar({
  onSubmit,
  busy,
  allowImage,
  restore,
}: {
  onSubmit(prompt: string, image: ImagePayload | null): void;
  busy: boolean;
  allowImage: boolean;
  /** Demande à remettre dans la barre (ex. après rechargement en pleine génération). */
  restore: { prompt: string; image: ImagePayload | null } | null;
}) {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<ImagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  // Brouillon restauré au chargement, puis sauvegardé à chaque frappe.
  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setPrompt(draft.prompt);
      setImage(draft.image);
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) saveDraft({ prompt, image });
  }, [prompt, image]);
  useEffect(() => {
    if (restore) {
      setPrompt(restore.prompt);
      setImage(restore.image);
    }
  }, [restore]);

  useEffect(() => {
    const focus = () => area.current?.focus();
    window.addEventListener(FOCUS_PROMPT_EVENT, focus);
    return () => window.removeEventListener(FOCUS_PROMPT_EVENT, focus);
  }, []);

  // Hauteur automatique (1 à 4 lignes).
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 112)}px`;
  }, [prompt]);

  const submit = () => {
    const text = prompt.trim();
    if (text.length < 3) {
      setError("Décrivez votre besoin en quelques mots.");
      area.current?.focus();
      return;
    }
    setError(null);
    onSubmit(text, image);
    setPrompt("");
    setImage(null);
  };

  return (
    <div className="relative min-w-0">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-[22px] bg-white p-1.5 pl-3 shadow-card ring-1 ring-black/5"
      >
        <span className="mb-2.5 hidden text-brand-accent sm:block">
          <IconSparkles size={18} />
        </span>
        <label htmlFor="prompt" className="sr-only">
          Votre demande
        </label>
        <textarea
          id="prompt"
          ref={area}
          rows={1}
          maxLength={1500}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Décrivez un problème ou un objet… ex. : mes câbles tombent derrière le bureau"
          className="min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-6 outline-none placeholder:text-ink-mute"
        />
        {image && (
          <span className="relative mb-1 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.previewUrl} alt="Photo jointe" className="h-9 w-9 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => setImage(null)}
              aria-label="Retirer la photo"
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-white"
            >
              <IconX size={10} strokeWidth={3} />
            </button>
          </span>
        )}
        {allowImage && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  setImage(await prepareImage(file));
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Image illisible.");
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="icon-btn mb-0.5 !h-10 !w-10 shrink-0"
              aria-label="Joindre une photo (optionnel)"
              title="Joindre une photo (optionnel)"
            >
              <IconImage size={17} />
            </button>
          </>
        )}
        <button type="submit" disabled={busy && prompt.trim().length < 3} className="btn-accent mb-0.5 shrink-0 !rounded-[16px] !px-4 !py-2.5">
          {busy ? <Spinner /> : <IconSparkles size={15} />}
          <span className="hidden sm:inline">Générer</span>
        </button>
      </form>
      {error && <p className="mt-1.5 px-3 text-xs font-medium text-white">{error}</p>}
      <AnimatePresence>
        {focused && !prompt && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 right-0 top-full z-30 mt-2 flex flex-wrap gap-1.5 rounded-2xl bg-white p-2 shadow-float"
          >
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPrompt(ex);
                  area.current?.focus();
                }}
                className="rounded-full bg-paper px-3 py-1.5 text-xs text-ink-soft transition hover:bg-brand-accent/10 hover:text-brand-accent"
              >
                {ex}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
