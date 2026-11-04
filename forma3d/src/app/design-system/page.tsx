import type { Metadata } from "next";
import { AppHeader } from "@/components/app/AppHeader";
import { AXIS_COLORS, COLOR_TOKENS, MOTION, TYPE_SCALE, contrast, hex, token } from "@/lib/design/tokens";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getViewer } from "@/lib/viewer";
import { ComponentGallery, IconGallery } from "./Demos";

export const metadata: Metadata = { title: "Système de design", robots: { index: false } };

/** Bloc de la page : titre, phrase d'usage, contenu. */
function Block({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line py-10">
      <h2 id={id} className="text-xl font-semibold text-ink">
        {title}
      </h2>
      {lead && <p className="mt-1 max-w-3xl text-base text-ink-mute">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Ratio({ value }: { value: number }) {
  const ok = value >= 4.5;
  return <span className={`font-mono text-xs ${ok ? "text-success" : "text-danger"}`}>{value.toFixed(1)}:1</span>;
}

/**
 * Référence du système de design de Forma3D : couleurs (tokens), typographie, formes, icônes, mouvements
 * et composants avec leurs états. Toutes les interfaces doivent s'y conformer.
 */
export default async function DesignSystemPage() {
  const { site } = await getPublicSettings();
  const demoMode = isDemoMode();
  const viewer = demoMode ? null : await getViewer();
  const surface = (theme: "light" | "dark") => token("surface")[theme];
  return (
    <main className="pt-nav min-h-dvh">
      <AppHeader siteName={site.siteName} logoDataUrl={site.logoDataUrl} viewer={viewer} demoMode={demoMode} />
      <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <header className="py-10">
          <p className="font-mono text-xs text-ink-mute">/design-system</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Système de design</h1>
          <p className="mt-2 max-w-3xl text-base text-ink-soft">
            Identité d&apos;outil d&apos;ingénierie : surfaces neutres, une seule couleur d&apos;accent réservée à la sélection et à
            l&apos;action principale, filets de 1 px plutôt que des cartes, coins de 4 à 8 px, grille de 4 px. Toutes les valeurs sont des
            variables CSS (<code className="font-mono text-sm">src/app/globals.css</code>), redéfinies pour le thème sombre.
          </p>
        </header>

        <Block id="couleurs" title="Couleurs" lead="Contraste vérifié automatiquement (test « design-tokens ») : texte ≥ 4,5:1 sur surface, toile et champ, dans les deux thèmes.">
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-line bg-paper text-start text-xs text-ink-mute">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">Variable</th>
                  <th className="px-3 py-2 text-start font-medium">Usage</th>
                  <th className="px-3 py-2 text-start font-medium">Clair</th>
                  <th className="px-3 py-2 text-start font-medium">Sombre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {COLOR_TOKENS.map((t) => (
                  <tr key={t.name}>
                    <td className="px-3 py-2 font-mono text-xs text-ink">--{t.name}</td>
                    <td className="px-3 py-2 text-ink-soft">{t.role}</td>
                    {(["light", "dark"] as const).map((theme) => (
                      <td key={theme} className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <span aria-hidden className="h-5 w-8 rounded border border-line" style={{ background: hex(t[theme]) }} />
                          <span className="font-mono text-xs text-ink-mute">{hex(t[theme])}</span>
                          {["ink", "ink-soft", "ink-mute", "accent", "success", "warning", "danger"].includes(t.name) && <Ratio value={contrast(t[theme], surface(theme))} />}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="theme-light rounded-lg border border-line bg-canvas p-4 text-ink">
              <ThemeSample label="Thème clair" />
            </div>
            <div className="dark rounded-lg border border-line bg-canvas p-4 text-ink">
              <ThemeSample label="Thème sombre" />
            </div>
          </div>
          <p className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            Axes, réservés à la 3D :
            {AXIS_COLORS.map((a) => (
              <span key={a.axis} className="inline-flex items-center gap-1.5 font-mono text-xs">
                <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: hex(a.rgb) }} /> {a.axis} {hex(a.rgb)}
              </span>
            ))}
          </p>
        </Block>

        <Block id="typo" title="Typographie" lead="Inter pour l'interface, JetBrains Mono pour les valeurs numériques et les cotes. Graisses 400, 500 et 600 uniquement.">
          <ul className="divide-y divide-line rounded-lg border border-line">
            {TYPE_SCALE.map((s) => (
              <li key={s.cls} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3">
                <span className="w-24 shrink-0 font-mono text-xs text-ink-mute">
                  {s.px} px · {s.cls}
                </span>
                <span className={`${s.cls} min-w-0 flex-1 text-ink`}>Support de téléphone incliné</span>
                <span className="text-xs text-ink-mute">{s.use}</span>
              </li>
            ))}
            <li className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3">
              <span className="w-24 shrink-0 font-mono text-xs text-ink-mute">40 px · text-display</span>
              <span className="min-w-0 flex-1 text-display font-semibold text-ink">Titre de l&apos;accueil</span>
              <span className="text-xs text-ink-mute">Accueil uniquement, jamais dans l&apos;éditeur</span>
            </li>
            <li className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-4 py-3">
              <span className="w-24 shrink-0 font-mono text-xs text-ink-mute">13 px · font-mono</span>
              <span className="min-w-0 flex-1 font-mono text-sm text-ink">X 120.50 mm · Y 64.00 mm · R 15°</span>
              <span className="text-xs text-ink-mute">Cotes, positions, angles, crédits</span>
            </li>
          </ul>
        </Block>

        <Block id="formes" title="Formes, espacement, ombres" lead="Grille de 4 px. Coins 4 px (champs, boutons) à 8 px (panneaux, dialogues). Filets de 1 px. Ombre légère uniquement sur ce qui flotte.">
          <div className="flex flex-wrap items-end gap-6">
            {[
              ["rounded", "4 px"],
              ["rounded-md", "6 px"],
              ["rounded-lg", "8 px"],
            ].map(([cls, label]) => (
              <div key={cls} className="text-center">
                <div className={`h-14 w-20 border border-line bg-surface ${cls}`} />
                <p className="mt-2 font-mono text-xs text-ink-mute">
                  {cls} · {label}
                </p>
              </div>
            ))}
            <div className="text-center">
              <div className="h-14 w-20 rounded-lg border border-line bg-surface shadow-float" />
              <p className="mt-2 font-mono text-xs text-ink-mute">shadow-float · menus</p>
            </div>
            <div className="text-center">
              <div className="flex h-14 items-end gap-1">
                {[1, 2, 3, 4, 6, 8].map((n) => (
                  <span key={n} className="w-3 bg-accent/40" style={{ height: n * 4 }} />
                ))}
              </div>
              <p className="mt-2 font-mono text-xs text-ink-mute">4 · 8 · 12 · 16 · 24 · 32</p>
            </div>
          </div>
        </Block>

        <Block id="icones" title="Icônes" lead="Lucide, trait de 1,5 px, en 16 px (barres, listes) ou 20 px (mises en avant). Un seul jeu dans toute l'application.">
          <IconGallery />
        </Block>

        <Block id="mouvement" title="Mouvements" lead="Courts et fonctionnels ; tous désactivés si le système demande de réduire les animations.">
          <ul className="grid gap-2 sm:grid-cols-3">
            {Object.entries(MOTION).map(([k, ms]) => (
              <li key={k} className="rounded-md border border-line bg-surface px-3 py-2">
                <span className="font-mono text-sm text-ink">{ms} ms</span>
                <span className="ms-2 text-xs text-ink-mute">{k === "fast" ? "survol, info-bulles" : k === "base" ? "menus, onglets, dialogues" : "tiroirs, apparitions"}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block id="composants" title="Composants" lead="Chaque composant a ses états : survol, actif, désactivé et focus visible au clavier (anneau d'accent de 2 px).">
          <ComponentGallery />
        </Block>
      </div>
    </main>
  );
}

function ThemeSample({ label }: { label: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-ink-mute">{label}</p>
      <div className="rounded-lg border border-line bg-surface p-3">
        <p className="text-base font-medium text-ink">Semelle</p>
        <p className="text-sm text-ink-soft">Pavé · PETG</p>
        <p className="font-mono text-xs text-ink-mute">120.00 × 80.00 × 4.00 mm</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="btn-primary">Exporter</span>
          <span className="btn-secondary">Dupliquer</span>
          <span className="chip bg-success/15 text-success">Imprimable</span>
          <span className="chip bg-warning/15 text-warning">Porte-à-faux</span>
          <span className="chip bg-danger/15 text-danger">Paroi trop fine</span>
        </div>
      </div>
    </div>
  );
}
