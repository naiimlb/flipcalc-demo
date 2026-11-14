"use client";

import { useId, useRef, useState } from "react";
import { PRINTER_PRESETS } from "@/lib/fabrication/printer";
import { IconArrowRight, IconCamera, IconBulb, IconPrinter, LogoMark } from "../icons";

/**  : un clic remplit la demande (rien n'est envoyé sans confirmation). */
export const IDEAS = [
  { label: "Range-câbles", prompt: "Un range-câbles pour les chargeurs posés sur mon bureau" },
  { label: "Support téléphone", prompt: "Un support pour mon téléphone sur le vélo" },
  { label: "Cache-trou", prompt: "Un cache pour un trou de 35 mm dans mon bureau" },
  { label: "Pied de meuble", prompt: "Un pied de meuble pour caler une table bancale de 8 mm" },
  { label: "Organiseur de tiroir", prompt: "Un organiseur pour ranger les couverts dans un tiroir" },
  { label: "Clip", prompt: "Un clip pour fermer un sachet de café" },
];

/**
 * Premier écran du parcours Simple : une question, un champ, deux options (photo, imprimante) et des idées.
 * Un seul bouton principal. `demo` : phrase honnête sur les résultats d'exemple.
 */
export interface SimpleRequest {
  prompt: string;
  printer: string;
  photo: File | null;
}

export function SimpleHome({
  demo,
  signedIn,
  allowPhoto = true,
  initial,
  notice,
  onDraft,
  onSubmit,
}: {
  demo: boolean;
  signedIn: boolean;
  allowPhoto?: boolean;
  /** Saisie à restaurer (retour depuis une erreur, brouillon, « Modifier ma demande »). */
  initial?: Partial<SimpleRequest>;
  /** Message humain (erreur, annulation) avec une action éventuelle. */
  notice?: { text: string; action?: { label: string; href: string } } | null;
  /** Appelé à chaque frappe : le texte n'est jamais perdu. */
  onDraft?(prompt: string): void;
  onSubmit(request: SimpleRequest): void;
}) {
  const id = useId();
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [printer, setPrinter] = useState(initial?.printer ?? PRINTER_PRESETS[0].id);
  const [photo, setPhoto] = useState<File | null>(initial?.photo ?? null);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const ready = prompt.trim().length >= 3;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center gap-3 px-5 sm:px-8">
        <span className="flex items-center gap-2 text-ink">
          <LogoMark size={24} />
          <span className="text-lead font-semibold">Forma3D</span>
        </span>
        <nav aria-label="Compte" className="ms-auto flex items-center gap-1">
          <a href="/espace" className="tap flex min-h-11 items-center rounded-lg px-3 text-body text-ink-soft hover:bg-paper hover:text-ink">
            Mes projets
          </a>
          <a href="/connexion" className="tap flex min-h-11 items-center rounded-lg px-3 text-body text-ink-soft hover:bg-paper hover:text-ink">
            {signedIn ? "Mon compte" : "Se connecter"}
          </a>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center px-5 pb-16 pt-[8vh] sm:px-8">
        <form
          className="w-full max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) onSubmit({ prompt: prompt.trim(), printer, photo });
            else field.current?.focus();
          }}
        >
          <h1 id={`${id}-title`} className="block text-center text-title font-semibold text-ink sm:text-hero">
            Quel problème voulez-vous résoudre{"\u202f"}?
          </h1>
          {notice && (
            <p role="alert" className="mt-6 rounded-xl bg-warning/10 px-4 py-3 text-body text-warning">
              {notice.text}
              {notice.action && (
                <>
                  {" "}
                  <a href={notice.action.href} className="font-medium underline underline-offset-2">
                    {notice.action.label}
                  </a>
                </>
              )}
            </p>
          )}
          <div className="mt-8 flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 ps-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
            <textarea
              id={`${id}-prompt`}
              aria-labelledby={`${id}-title`}
              ref={field}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                onDraft?.(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={2}
              maxLength={1500}
              placeholder="Ex. : un support pour mon téléphone sur le vélo"
              className="min-h-[3.5rem] w-full flex-1 resize-none bg-transparent py-2 text-lead text-ink outline-none placeholder:text-ink-mute"
            />
            <button
              type="submit"
              aria-label="Créer ma pièce"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-strong text-white transition-colors hover:bg-accent-strong/90 disabled:opacity-40"
              disabled={!ready}
            >
              <IconArrowRight size={20} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {allowPhoto ? (
            <button type="button" onClick={() => file.current?.click()} className="tap flex min-h-11 items-center gap-2 rounded-lg px-3 text-body text-ink-soft hover:bg-paper hover:text-ink">
              <IconCamera size={20} /> {photo ? `Photo : ${photo.name.slice(0, 24)}` : "Ajouter une photo"}
            </button>
            ) : (
              <span />
            )}
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            <label className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-body text-ink-soft">
              <IconPrinter size={20} />
              <span className="sr-only sm:not-sr-only">Mon imprimante :</span>
              <select value={printer} onChange={(e) => setPrinter(e.target.value)} className="min-h-11 rounded-lg bg-transparent py-1 font-medium text-ink outline-none hover:bg-paper focus-visible:ring-2 focus-visible:ring-accent">
                {PRINTER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>

        <section className="mt-10 flex w-full max-w-2xl flex-col items-center">
          <button
            type="button"
            aria-expanded={ideasOpen}
            aria-controls={`${id}-ideas`}
            onClick={() => setIdeasOpen((o) => !o)}
            className="tap flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-body text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
          >
            <IconBulb size={20} /> Voir des idées
          </button>
          <ul id={`${id}-ideas`} className={`mt-4 flex-wrap justify-center gap-2 ${ideasOpen ? "flex" : "hidden"}`}>
            {IDEAS.map((idea) => (
              <li key={idea.label}>
                <button
                  type="button"
                  onClick={() => {
                    setPrompt(idea.prompt);
                    onDraft?.(idea.prompt);
                    setIdeasOpen(false);
                    field.current?.focus();
                  }}
                  className="tap flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-body text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
                >
                  {idea.label}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {demo && (
          <p className="mt-10 max-w-xl text-center text-body text-ink-mute">
            Aperçu : les résultats sont des exemples. Connectez-vous pour générer vos propres pièces.
          </p>
        )}
      </main>
    </div>
  );
}
