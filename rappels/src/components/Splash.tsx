import { Logo } from "./Logo";

/** Écran de chargement aux couleurs de la marque : affiché pendant la vérification de la session au lancement. */
export function Splash() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement" className="flex min-h-[75dvh] flex-col items-center justify-center gap-6">
      <div className="animate-pulse">
        <Logo height={84} />
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2.5 animate-bounce rounded-full bg-pink" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
      <p className="text-sm font-bold text-mute">Chargement…</p>
    </div>
  );
}
