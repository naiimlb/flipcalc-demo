import type { ReactNode } from "react";
import { Logo } from "./Logo";

export const inputCls = "min-h-14 w-full rounded-2xl border-2 border-line bg-white px-4 text-[17px] font-semibold focus:border-pink";
export const primaryBtn =
  "min-h-14 w-full rounded-full bg-pink text-lg font-extrabold text-white shadow-pop active:scale-[0.98] disabled:opacity-60 disabled:shadow-none";
export const linkBtn = "inline-flex min-h-11 items-center justify-center px-2 text-[15px] font-bold text-pink-deep underline-offset-4 hover:underline";

/** Cadre commun des écrans de connexion : logo en haut, gros titre, contenu centré. */
export function AuthShell({ title, hint, children, footer }: { title: string; hint?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col pb-6">
      <div className="mb-8 mt-4 flex justify-center">
        <Logo height={64} />
      </div>
      <h1 className="h-street text-[2.2rem]">{title}</h1>
      {hint && <p className="mt-2 text-[15px] font-medium text-mute">{hint}</p>}
      <div className="mt-6 flex-1">{children}</div>
      {footer && <div className="mt-6 flex flex-col items-center gap-1">{footer}</div>}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-2xl bg-ink px-4 py-3 text-[15px] font-bold text-white">
      {message}
    </p>
  );
}
