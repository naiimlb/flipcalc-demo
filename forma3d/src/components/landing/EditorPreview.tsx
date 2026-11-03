import { IconCamera, IconCube, IconDownload, IconHistory, IconLayers, IconRotate, IconRuler, IconSparkles } from "../icons";

/**
 * Aperçu (illustration HTML/SVG, non interactive) de l'éditeur : outils à gauche, vue 3D au centre,
 * panneau de propriétés à onglets à droite, barre du haut et historique des versions en bas.
 */
export function EditorPreview({ label, tabs, title, prompt }: { label: string; tabs: string[]; title: string; prompt: string }) {
  const tools = [IconCube, IconRotate, IconRuler, IconLayers, IconCamera, IconSparkles];
  return (
    <figure aria-label={label} className="w-full">
      <div className="overflow-hidden rounded-3xl bg-surface/70 text-ink ring-1 ring-fg/10 backdrop-blur">
        {/* Barre du haut */}
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-neon-coral" />
          <span className="truncate text-xs font-semibold">{title}</span>
          <span className="ms-auto hidden gap-1 sm:flex">
            {["↶", "↷"].map((s) => (
              <span key={s} className="flex h-7 w-7 items-center justify-center rounded-lg bg-paper text-xs text-ink-soft">
                {s}
              </span>
            ))}
          </span>
          <span className="flex h-7 items-center gap-1 rounded-lg bg-paper px-2 text-[11px] text-ink-soft">
            <IconDownload size={12} /> STL
          </span>
          <span className="chip bg-neon-blue/15 text-neon-blue">⚡ 42</span>
        </div>
        <div className="grid grid-cols-[44px_1fr] sm:grid-cols-[52px_1fr_200px]">
          {/* Outils */}
          <div className="flex flex-col items-center gap-1.5 border-e border-line py-3">
            {tools.map((Icon, i) => (
              <span key={i} className={`flex h-9 w-9 items-center justify-center rounded-xl ${i === 0 ? "bg-neon-blue text-white" : "text-ink-soft"}`}>
                <Icon size={16} />
              </span>
            ))}
          </div>
          {/* Vue 3D (illustration) */}
          <div className="relative aspect-[4/3] bg-[radial-gradient(circle_at_50%_40%,rgb(var(--neon-blue)/0.16),transparent_65%)] sm:aspect-auto sm:min-h-[300px]">
            <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" aria-hidden>
              <g stroke="rgb(var(--fg) / 0.08)" strokeWidth="1">
                {Array.from({ length: 11 }, (_, i) => (
                  <line key={`a${i}`} x1={40 + i * 32} y1="250" x2={120 + i * 16} y2="150" />
                ))}
                {Array.from({ length: 6 }, (_, i) => (
                  <line key={`b${i}`} x1={40 + i * 16} y1={250 - i * 20} x2={360 + i * -16} y2={250 - i * 20} />
                ))}
              </g>
              {/* Support de téléphone en isométrie */}
              <polygon points="130,210 250,240 300,215 180,186" fill="#14151c" />
              <polygon points="150,200 160,110 185,104 182,196" fill="#2f6bff" />
              <polygon points="232,224 242,134 267,128 262,218" fill="#2f6bff" />
              <polygon points="160,110 242,134 267,128 185,104" fill="#5d8bff" />
              <polygon points="165,165 247,188 250,176 168,152" fill="#e8ebf5" />
              <polygon points="140,205 250,233 252,226 142,198" fill="#ff6b4a" />
              {/* Poignées de transformation */}
              <line x1="206" y1="150" x2="206" y2="70" stroke="#3ddc84" strokeWidth="3" />
              <polygon points="206,62 200,74 212,74" fill="#3ddc84" />
              <line x1="206" y1="150" x2="290" y2="170" stroke="#ff4d4d" strokeWidth="3" />
              <polygon points="298,172 286,165 288,177" fill="#ff4d4d" />
              <line x1="206" y1="150" x2="150" y2="178" stroke="#3d7aff" strokeWidth="3" />
              <polygon points="143,182 156,180 151,170" fill="#3d7aff" />
              <circle cx="206" cy="150" r="5" fill="#fff" />
            </svg>
            <span className="chip absolute bottom-3 start-3 bg-night/80 text-white">120 × 85 × 96 mm</span>
          </div>
          {/* Propriétés */}
          <div className="hidden border-s border-line p-3 sm:block">
            <div className="flex flex-wrap gap-1">
              {tabs.map((tab, i) => (
                <span key={tab} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${i === 0 ? "bg-fg text-canvas" : "bg-paper text-ink-soft"}`}>
                  {tab}
                </span>
              ))}
            </div>
            <div className="mt-3 space-y-2.5">
              {[
                ["X", "120"],
                ["Y", "85"],
                ["Z", "96"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[11px]">
                  <span className="w-3 font-bold text-ink-mute">{k}</span>
                  <span className="flex-1 rounded-lg bg-paper px-2 py-1.5 font-mono tabular-nums">{v} mm</span>
                </div>
              ))}
              <div className="flex gap-1.5 pt-1">
                {["#2f6bff", "#ff6b4a", "#8b5cf6", "#e8ebf5", "#14151c"].map((c) => (
                  <span key={c} className="h-5 w-5 rounded-full ring-1 ring-line" style={{ background: c }} />
                ))}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-neon-blue to-neon-coral" />
              </div>
            </div>
          </div>
        </div>
        {/* Historique des versions */}
        <div className="flex items-center gap-2 border-t border-line px-3 py-2.5 sm:px-4">
          <IconHistory size={14} className="text-ink-mute" />
          {["v1", "v2", "v3"].map((v, i) => (
            <span key={v} className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${i === 2 ? "bg-neon-blue/15 text-neon-blue" : "bg-paper text-ink-soft"}`}>
              {v}
            </span>
          ))}
          <span className="ms-2 h-7 flex-1 rounded-full bg-paper px-3 text-[11px] leading-7 text-ink-mute">{prompt}</span>
        </div>
      </div>
    </figure>
  );
}
