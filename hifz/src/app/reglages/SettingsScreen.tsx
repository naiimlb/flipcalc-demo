"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AccountSection } from "@/components/auth/AccountSection";
import { ArabicText } from "@/components/ArabicText";
import { Icon } from "@/components/icons";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Segmented, Stepper } from "@/components/Stepper";
import { Switch } from "@/components/Switch";
import { Button, Card, PageHeader, SectionTitle } from "@/components/ui";
import { clearAudioCache, countCachedAudio } from "@/lib/audio/cache";
import { basmalaText, reciters } from "@/lib/quran/catalog";
import { backupFileName, exportBackup, importBackup, parseBackup } from "@/lib/storage/backup";
import { getDb } from "@/lib/storage/client";
import { ARABIC_SIZE, DAILY_NEW, PLAYBACK_RATES, REPEAT } from "@/lib/storage/settings";

const rateLabel = (r: number) => `${String(r).replace(".", ",")}×`;

export function SettingsScreen() {
  const { settings, update } = useSettings();

  return (
    <>
      <PageHeader title="Réglages" />

      <AccountSection />

      <SectionTitle>Récitation</SectionTitle>
      <Card className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block font-medium">Récitateur</span>
          <select
            value={settings.reciter}
            onChange={(e) => void update({ reciter: e.target.value })}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-3 text-base outline-none focus:border-accent"
          >
            {reciters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium">Répétitions</span>
            <span className="block text-sm text-muted">Écoutes enchaînées d&apos;un verset</span>
          </span>
          <Stepper
            label="Répétitions"
            value={settings.repeatCount}
            min={REPEAT.min}
            max={REPEAT.max}
            onChange={(v) => void update({ repeatCount: v })}
            format={(v) => `${v}×`}
          />
        </div>
        <div>
          <span className="mb-1.5 block font-medium">Vitesse</span>
          <Segmented
            label="Vitesse de lecture"
            options={PLAYBACK_RATES.map((r) => ({ value: r, label: rateLabel(r) }))}
            value={settings.playbackRate}
            onChange={(v) => void update({ playbackRate: v })}
          />
        </div>
      </Card>

      <SectionTitle>Texte arabe</SectionTitle>
      <Card className="space-y-5">
        <div className="rounded-2xl bg-elevated px-4 py-3">
          <ArabicText text={basmalaText} className="text-center" />
        </div>
        <div>
          <span className="mb-1.5 block font-medium">Police</span>
          <Segmented
            label="Police du texte arabe"
            options={[
              { value: "amiri", label: "Amiri Quran" },
              { value: "scheherazade", label: "Scheherazade" },
            ]}
            value={settings.arabicFont}
            onChange={(v) => void update({ arabicFont: v })}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="font-medium">Taille</span>
          <Stepper
            label="Taille du texte arabe"
            value={settings.arabicSize / ARABIC_SIZE.step}
            min={ARABIC_SIZE.min / ARABIC_SIZE.step}
            max={ARABIC_SIZE.max / ARABIC_SIZE.step}
            onChange={(v) => void update({ arabicSize: v * ARABIC_SIZE.step })}
            format={(v) => `${v * ARABIC_SIZE.step}`}
          />
        </div>
        <Switch
          label="Traduction française"
          description="Hamidullah, affichée sous le verset révélé"
          checked={settings.showTranslation}
          onChange={(v) => void update({ showTranslation: v })}
        />
      </Card>

      <SectionTitle>Apparence</SectionTitle>
      <Card>
        <Segmented
          label="Thème"
          options={[
            { value: "system", label: "Système" },
            { value: "light", label: "Clair" },
            { value: "dark", label: "Sombre" },
          ]}
          value={settings.theme}
          onChange={(v) => void update({ theme: v })}
        />
      </Card>

      <SectionTitle>Mémorisation</SectionTitle>
      <Card>
        <div className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-medium">Nouveaux versets par jour</span>
            <span className="block text-sm text-muted">En plus des révisions prévues</span>
          </span>
          <Stepper
            label="Nouveaux versets par jour"
            value={settings.dailyNewLimit}
            min={DAILY_NEW.min}
            max={DAILY_NEW.max}
            onChange={(v) => void update({ dailyNewLimit: v })}
          />
        </div>
      </Card>

      <SectionTitle>Hors ligne</SectionTitle>
      <OfflineSection keepAudio={settings.cacheAudio} onKeepAudio={(v) => void update({ cacheAudio: v })} />

      <SectionTitle>Mes données</SectionTitle>
      <DataSection />

      <SectionTitle>À propos</SectionTitle>
      <Card className="space-y-2 text-[15px]">
        <Link href="/sources" className="flex min-h-11 items-center justify-between font-medium text-accent">
          Sources du texte, de la traduction et de l&apos;audio <span aria-hidden="true">›</span>
        </Link>
        <p className="text-sm text-muted">
          Vos données restent sur cet appareil : aucun compte, aucun serveur, aucune publicité.
        </p>
      </Card>
    </>
  );
}

function OfflineSection({ keepAudio, onKeepAudio }: { keepAudio: boolean; onKeepAudio: (v: boolean) => void }) {
  const [audioFiles, setAudioFiles] = useState<number | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    void countCachedAudio().then((n) => alive && setAudioFiles(n));
    void navigator.storage
      ?.estimate?.()
      .then((e) => alive && e.usage !== undefined && setUsage(`${(e.usage / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [refresh]);

  async function clear() {
    if (!window.confirm("Supprimer l'audio gardé sur cet appareil ? Il sera retéléchargé à la prochaine écoute.")) return;
    await clearAudioCache();
    setRefresh((r) => r + 1);
  }

  return (
    <Card className="space-y-3">
      <Switch
        label="Garder l'audio écouté"
        description="Chaque verset écouté reste disponible sans réseau"
        checked={keepAudio}
        onChange={onKeepAudio}
      />
      <p className="text-sm text-muted">
        {audioFiles === null ? "…" : `${audioFiles} fichier${audioFiles > 1 ? "s" : ""} audio gardé${audioFiles > 1 ? "s" : ""}`}
        {usage ? ` · ${usage} utilisés au total` : null}. Le texte des sourates de vos programmes est enregistré
        automatiquement.
      </p>
      {audioFiles ? (
        <Button variant="danger" className="w-full" onClick={clear}>
          Vider le cache audio
        </Button>
      ) : null}
    </Card>
  );
}

type Message = { tone: "ok" | "error"; text: string } | null;

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<Message>(null);
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    setMessage(null);
    try {
      const backup = await exportBackup(getDb());
      const name = backupFileName();
      const file = new File([JSON.stringify(backup, null, 2)], name, { type: "application/json" });
      // Sur iPhone, la feuille de partage permet « Enregistrer dans Fichiers ».
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Sauvegarde Hifz" });
          setMessage({ tone: "ok", text: "Sauvegarde prête." });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage({ tone: "ok", text: `Fichier « ${name} » téléchargé.` });
    } catch {
      setMessage({ tone: "error", text: "L'export a échoué." });
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setMessage(null);
    const result = parseBackup(await file.text());
    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    const { cards, programs } = result.backup.data;
    const ok = window.confirm(
      `Remplacer vos données actuelles par cette sauvegarde ?\n\n${programs.length} programme(s), ${cards.length} verset(s) suivis. Cette action est définitive.`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await importBackup(getDb(), result.backup);
      setMessage({ tone: "ok", text: "Sauvegarde restaurée." });
    } catch {
      setMessage({ tone: "error", text: "La restauration a échoué : vos données n'ont pas été modifiées." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <p className="text-sm text-muted">
        Vos données ne sont enregistrées que sur cet appareil. Exportez-les régulièrement pour pouvoir les restaurer.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={exportData} disabled={busy}>
          <Icon name="upload" width={20} height={20} /> Exporter
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name="download" width={20} height={20} /> Importer
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFile(file);
        }}
      />
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-again" : "text-good"}`}>
          {message.text}
        </p>
      ) : null}
    </Card>
  );
}
