import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "../icons";

/** Mise en page des pages légales : sobre, lisible (16 px), liens entre les pages. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="simple-ui min-h-dvh">
      <header className="flex h-16 items-center gap-3 px-5 sm:px-8">
        <Link href="/" className="tap flex min-h-11 items-center gap-2 rounded-lg text-ink">
          <LogoMark size={24} />
          <span className="text-lead font-semibold">Forma3D</span>
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8">
        <h1 className="text-title font-semibold text-ink sm:text-hero">{title}</h1>
        <p className="mt-2 text-body text-ink-mute">Dernière mise à jour : {updated}</p>
        <div className="legal mt-8 space-y-6 text-body text-ink-soft [&_h2]:text-lead [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ms-5 [&_li]:list-disc [&_strong]:text-ink">
          {children}
        </div>
        <nav aria-label="Informations légales" className="mt-12 flex flex-wrap gap-2 border-t border-line pt-6">
          {[
            ["/mentions-legales", "Mentions légales"],
            ["/confidentialite", "Confidentialité et cookies"],
            ["/cgu", "Conditions d'utilisation"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="tap flex min-h-11 items-center rounded-lg px-3 text-body text-accent underline-offset-2 hover:underline">
              {label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}

/** Champ à compléter par l'éditeur du site (rien n'est inventé). */
export function ToFill({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-warning/15 px-1 text-warning">[À COMPLÉTER : {children}]</mark>;
}
