"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { IconImage, IconSparkles, IconX } from "../icons";
import { Portal } from "../Portal";

const EXAMPLES = [
  "Une solution pour ranger mes câbles de charge",
  "Un support de téléphone pour mon bureau",
  "Un porte-clés mural pour l'entrée",
  "Un pot à crayons qui tient aussi ma tablette",
];

export interface ImagePayload {
  mediaType: "image/jpeg";
  data: string;
  previewUrl: string;
}

/** Réduit l'image (1024 px max, JPEG) avant l'envoi : requêtes légères, coût IA maîtrisé. */
async function prepareImage(file: File): Promise<ImagePayload> {
  if (!file.type.startsWith("image/")) throw new Error("Choisissez une image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image trop lourde (15 Mo max).");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image illisible.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: dataUrl.split(",")[1] ?? "", previewUrl: dataUrl };
}

export function NewRequestDialog({
  open,
  onClose,
  onSubmit,
  allowImage,
  canCreate,
  paused,
}: {
  open: boolean;
  onClose(): void;
  onSubmit(prompt: string, image: ImagePayload | null): void;
  allowImage: boolean;
  canCreate: boolean;
  paused: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<ImagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (text.length < 3) {
      setError("Décrivez votre besoin en quelques mots.");
      return;
    }
    onSubmit(text, image);
    setPrompt("");
    setImage(null);
    setError(null);
  };

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-request-title"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="w-full max-w-lg rounded-t-[28px] bg-white p-5 shadow-card sm:rounded-[28px] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="new-request-title" className="text-xl font-semibold tracking-tight">
                  Nouvelle demande
                </h2>
                <p className="mt-0.5 text-sm text-ink-mute">Décrivez un problème ou l&apos;objet que vous imaginez.</p>
              </div>
              <button type="button" onClick={onClose} className="icon-btn" aria-label="Fermer">
                <IconX size={15} />
              </button>
            </div>

            {!canCreate ? (
              <div className="mt-5 rounded-2xl bg-paper p-4 text-sm">
                <p className="font-semibold">Connectez-vous pour créer vos conceptions.</p>
                <p className="mt-1 text-ink-mute">Vos demandes et modèles 3D sont sauvegardés dans votre historique.</p>
                <div className="mt-3 flex gap-2">
                  <Link href="/connexion" className="btn-dark !text-xs">
                    Se connecter
                  </Link>
                  <Link href="/connexion?mode=inscription" className="btn-ghost !text-xs">
                    Créer un compte
                  </Link>
                </div>
              </div>
            ) : paused ? (
              <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
                Les nouvelles demandes sont temporairement suspendues. Réessayez plus tard.
              </p>
            ) : (
              <form onSubmit={submit} className="mt-5">
                <label htmlFor="prompt" className="sr-only">
                  Votre demande
                </label>
                <textarea
                  id="prompt"
                  autoFocus
                  rows={4}
                  maxLength={1500}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
                  }}
                  placeholder="Ex. : mes câbles de charge tombent sans arrêt derrière le bureau…"
                  className="input resize-none !rounded-2xl !text-[15px]"
                />
                <div className="mt-1 flex justify-end text-[11px] text-ink-mute">{prompt.length}/1500</div>

                <div className="mt-1 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setPrompt(ex)}
                      className="rounded-full bg-paper px-3 py-1.5 text-xs text-ink-soft transition hover:bg-brand-accent/10 hover:text-brand-accent"
                    >
                      {ex}
                    </button>
                  ))}
                </div>

                {allowImage && (
                  <div className="mt-4">
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
                    {image ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-line p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.previewUrl} alt="Photo jointe" className="h-14 w-14 rounded-xl object-cover" />
                        <p className="flex-1 text-xs text-ink-soft">Photo jointe : l&apos;IA s&apos;en servira pour le contexte et les dimensions.</p>
                        <button type="button" onClick={() => setImage(null)} className="icon-btn" aria-label="Retirer la photo">
                          <IconX size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-4 py-3 text-xs font-semibold text-ink-soft transition hover:border-brand-accent/50 hover:text-brand-accent"
                      >
                        <IconImage size={16} /> Ajouter une photo (optionnel)
                      </button>
                    )}
                  </div>
                )}

                {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

                <div className="mt-5 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-ink-mute">Génération : 30 à 90 s</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={onClose} className="btn-ghost">
                      Annuler
                    </button>
                    <button type="submit" className="btn-accent" disabled={prompt.trim().length < 3}>
                      <IconSparkles size={15} /> Générer
                    </button>
                  </div>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </Portal>
  );
}
