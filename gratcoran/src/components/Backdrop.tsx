/**
 * Fond de l'app : halos émeraude et bleu très doux et motif géométrique islamique
 * (étoile à huit branches) à très faible opacité. Purement décoratif.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: "rgb(var(--glow-a) / 0.2)" }} />
      <div className="absolute -right-40 top-1/3 h-[26rem] w-[26rem] rounded-full blur-3xl" style={{ background: "rgb(var(--glow-b) / 0.15)" }} />
      <div className="absolute -bottom-48 left-1/4 h-[24rem] w-[24rem] rounded-full blur-3xl" style={{ background: "rgb(var(--glow-a) / 0.12)" }} />
      <svg className="absolute inset-0 h-full w-full text-emerald-deep dark:text-emerald" style={{ opacity: "var(--pattern-opacity)" }}>
        <defs>
          <pattern id="khatam" width="64" height="64" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="currentColor" strokeWidth="1.1">
              <rect x="18" y="18" width="28" height="28" />
              <rect x="18" y="18" width="28" height="28" transform="rotate(45 32 32)" />
              <circle cx="32" cy="32" r="7" />
              <path d="M0 0 18 18M64 0 46 18M0 64l18-18M64 64 46 46M32 0v8M32 56v8M0 32h8M56 32h8" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#khatam)" />
      </svg>
    </div>
  );
}
