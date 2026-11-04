"use client";

import { useState } from "react";
import * as Icons from "@/components/icons";
import { Choice, Sheet } from "@/components/studio/editor/Sheet";
import { Toggle } from "@/components/studio/ui";
import { NumberField } from "@/components/ui/NumberField";
import { EmptyState, Skeleton, SkeletonLines } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";

const ICON_NAMES = Object.keys(Icons).filter((k) => k.startsWith("Icon") && typeof (Icons as Record<string, unknown>)[k] === "function");

/** Toutes les icônes de l'application, en 16 et 20 px. */
export function IconGallery() {
  return (
    <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 lg:grid-cols-6">
      {ICON_NAMES.map((name) => {
        const Icon = (Icons as unknown as Record<string, (p: { size?: number }) => React.ReactElement>)[name];
        return (
          <li key={name} className="flex items-center gap-3 bg-surface px-3 py-2.5 text-ink-soft">
            <Icon size={16} />
            <Icon size={20} />
            <span className="truncate font-mono text-xs text-ink-mute">{name.slice(4)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b border-line py-4 last:border-b-0 md:grid-cols-[180px_1fr]">
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Composants de référence, interactifs (survol, focus clavier, glisser pour ajuster, dialogue). */
export function ComponentGallery() {
  const [size, setSize] = useState({ x: 120, y: 80, z: 4 });
  const [thickness, setThickness] = useState(2);
  const [tab, setTab] = useState("objet");
  const [selected, setSelected] = useState("semelle");
  const [mode, setMode] = useState<"plein" | "trou">("plein");
  const [snap, setSnap] = useState(true);
  const [dialog, setDialog] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-surface px-4">
      <Row label="Boutons">
        <button type="button" className="btn-primary">
          <Icons.IconDownload /> Exporter
        </button>
        <button type="button" className="btn-secondary">
          <Icons.IconCopy /> Dupliquer
        </button>
        <button type="button" className="btn-subtle">
          Annuler
        </button>
        <button type="button" className="btn-danger">
          <Icons.IconTrash /> Supprimer
        </button>
        <button type="button" className="btn-primary" disabled>
          Désactivé
        </button>
        <button type="button" className="btn-secondary" disabled>
          Désactivé
        </button>
      </Row>
      <Row label="Boutons icône + info-bulle">
        {[
          { label: "Annuler", key: "⌘Z", icon: <Icons.IconUndo /> },
          { label: "Rétablir", key: "⇧⌘Z", icon: <Icons.IconRedo /> },
          { label: "Déplacer", key: "W", icon: <Icons.IconMove /> },
          { label: "Pivoter", key: "E", icon: <Icons.IconRotate /> },
          { label: "Mesurer", key: "U", icon: <Icons.IconRuler /> },
        ].map((b, i) => (
          <Tooltip key={b.label} label={b.label} shortcut={b.key}>
            <button type="button" className="icon-btn" aria-label={`${b.label} (${b.key})`} aria-pressed={i === 2}>
              {b.icon}
            </button>
          </Tooltip>
        ))}
        <span className="text-xs text-ink-mute">Survol : nom et raccourci après 400 ms ; immédiat au focus clavier.</span>
      </Row>
      <Row label="Champs numériques">
        <div className="grid w-full max-w-md grid-cols-3 gap-1">
          {(["x", "y", "z"] as const).map((k) => (
            <NumberField key={k} label={k.toUpperCase()} value={size[k]} unit="mm" step={0.5} onCommit={(v) => setSize((s) => ({ ...s, [k]: v }))} />
          ))}
        </div>
        <div className="w-40">
          <NumberField layout="stacked" label="Épaisseur de paroi" value={thickness} unit="mm" min={0.4} step={0.2} onCommit={setThickness} />
        </div>
        <span className="text-xs text-ink-mute">Glisser sur le libellé : 1 pas / 4 px, ×10 avec Maj, ×0,1 avec Alt. Flèches ↑ ↓ au clavier.</span>
      </Row>
      <Row label="Champ texte, liste">
        <input className="input max-w-xs" placeholder="Nom de la pièce" aria-label="Nom de la pièce" />
        <input className="input max-w-[160px]" disabled value="Désactivé" aria-label="Champ désactivé" readOnly />
        <select className="input !w-auto" aria-label="Matière" defaultValue="petg">
          <option value="pla">PLA</option>
          <option value="petg">PETG</option>
          <option value="abs">ABS</option>
        </select>
      </Row>
      <Row label="Choix exclusif, interrupteur">
        <div className="w-56">
          <Choice<"plein" | "trou">
            label="Type de forme"
            value={mode}
            onChange={setMode}
            options={[
              { id: "plein", label: "Plein" },
              { id: "trou", label: "Trou" },
            ]}
          />
        </div>
        <Toggle checked={snap} onChange={setSnap} label="Magnétisme" />
        <span className="text-sm text-ink-soft">Magnétisme</span>
      </Row>
      <Row label="Onglets">
        <div role="tablist" aria-label="Propriétés" className="flex border-b border-line">
          {["objet", "matière", "dimensions"].map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className="tab capitalize">
              {id}
            </button>
          ))}
        </div>
      </Row>
      <Row label="Liste">
        <ul role="listbox" aria-label="Pièces" className="w-64 space-y-0.5">
          {[
            ["semelle", "Semelle", "Pavé"],
            ["flasque", "Flasque gauche", "Profilé"],
            ["pied", "Pied avant", "Cylindre"],
          ].map(([id, name, shape]) => (
            <li key={id} role="option" aria-selected={selected === id} tabIndex={0} onClick={() => setSelected(id)} onKeyDown={(e) => e.key === "Enter" && setSelected(id)} className="list-item cursor-default">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-ink-mute/50" />
              <span className="flex-1 truncate">{name}</span>
              <span className="text-xs text-ink-mute">{shape}</span>
            </li>
          ))}
        </ul>
      </Row>
      <Row label="Menu contextuel">
        <div role="menu" aria-label="Pièce" className="menu w-56">
          {[
            ["Dupliquer", "⌘D"],
            ["Grouper", "⌘G"],
            ["Verrouiller", "L"],
          ].map(([label, key]) => (
            <button key={label} type="button" role="menuitem" className="list-item justify-between">
              {label}
              <kbd className="font-mono text-xs text-ink-mute">{key}</kbd>
            </button>
          ))}
          <div className="rule my-1" />
          <button type="button" role="menuitem" className="list-item text-danger hover:text-danger">
            Supprimer
            <kbd className="ms-auto font-mono text-xs text-ink-mute">⌫</kbd>
          </button>
        </div>
      </Row>
      <Row label="Étiquettes">
        <span className="chip border border-line text-ink-soft">Pavé</span>
        <span className="chip bg-accent/15 text-accent">Sélection</span>
        <span className="chip bg-success/15 text-success">Imprimable</span>
        <span className="chip bg-warning/15 text-warning">Porte-à-faux</span>
        <span className="chip bg-danger/15 text-danger">Erreur</span>
      </Row>
      <Row label="Panneau à filets">
        <div className="w-72 rounded-lg border border-line">
          <div className="border-b border-line px-3 py-2 text-xs font-medium text-ink-mute">Position (mm)</div>
          <div className="border-b border-line px-3 py-2 font-mono text-sm text-ink">75.00 · 20.00 · 0.00</div>
          <div className="px-3 py-2 text-xs font-medium text-ink-mute">Rotation (°)</div>
        </div>
      </Row>
      <Row label="Boîte de dialogue">
        <button type="button" className="btn-secondary" onClick={() => setDialog(true)}>
          Ouvrir un dialogue
        </button>
        {dialog && (
          <Sheet title="Exporter" onClose={() => setDialog(false)}>
            <p className="text-base text-ink-soft">Fichier STL en millimètres, une pièce par corps.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDialog(false)}>
                Annuler
              </button>
              <button type="button" className="btn-primary" onClick={() => setDialog(false)}>
                Exporter
              </button>
            </div>
          </Sheet>
        )}
      </Row>
      <Row label="États vide et chargement">
        <div className="w-64 rounded-lg border border-line">
          <EmptyState icon={<Icons.IconCube />} title="Aucune pièce pour l'instant" hint="Décrivez un objet dans la barre du bas : ses pièces apparaîtront ici." />
        </div>
        <div className="w-64 space-y-2 rounded-lg border border-line p-3">
          <Skeleton className="h-6 w-2/3" />
          <SkeletonLines lines={3} />
        </div>
      </Row>
    </div>
  );
}
