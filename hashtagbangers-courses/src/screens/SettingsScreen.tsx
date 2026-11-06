import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState, type ReactNode } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { CategoryPicker, PrimaryButton, Segmented } from '../components/Controls';
import { IconChevron, IconDown, IconPlus, IconUp, IconX } from '../components/Icons';
import { CoursesLogo } from '../components/Logo';
import { toast } from '../components/Toast';
import { CATEGORIES, DEFAULT_ORDER, type CategoryId } from '../lib/categories';
import { backupFileName, buildBackup, parseBackup, type ParsedBackup } from '../lib/backup';
import { haptic } from '../lib/haptics';
import { shareFile } from '../lib/share';
import { normalize } from '../lib/normalize';
import type { Theme } from '../lib/types';
import { useSaveStatus, whenSaved } from '../state/persistence';
import { actions, getState, useAppState } from '../state/store';
import { MEMORY_TOAST } from './ItemSheets';

function Card({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[26px] bg-white p-4 shadow-[0_10px_28px_-20px_rgba(120,0,50,0.4)] dark:bg-night-card">
      <h2 className="font-display text-[21px] tracking-wide uppercase">{title}</h2>
      {hint && <p className="mt-0.5 mb-3 text-[14px] leading-snug text-black/55 dark:text-white/55">{hint}</p>}
      {!hint && <div className="h-3" />}
      {children}
    </section>
  );
}

export function SettingsScreen() {
  const settings = useAppState((s) => s.settings);
  const [openCat, setOpenCat] = useState<CategoryId | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const rules = Object.entries(settings.learned).sort((x, y) => y[1].at - x[1].at);
  const [ruleKey, setRuleKey] = useState<string | null>(null);
  const rule = ruleKey ? settings.learned[ruleKey] : undefined;
  const save = useSaveStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Extract<ParsedBackup, { ok: true }> | null>(null);

  const forgetOne = (key: string, name: string) => {
    const prev = actions.forgetLearned(key);
    haptic();
    toast(`${name} oublié`, { actionLabel: 'Annuler', onAction: () => actions.restoreLearned(prev) });
  };
  const resetRules = () => {
    const prev = actions.forgetLearned();
    haptic('medium');
    toast('Catégories mémorisées réinitialisées', { actionLabel: 'Annuler', onAction: () => actions.restoreLearned(prev) });
  };

  const exportData = async () => {
    haptic();
    await whenSaved();
    const json = JSON.stringify(buildBackup(getState()), null, 2);
    const file = new File([json], backupFileName(), { type: 'application/json' });
    const r = await shareFile(file, 'Sauvegarde Hashtagbangers Courses');
    if (r === 'shared') toast('Sauvegarde partagée ✓');
    if (r === 'downloaded') toast('Fichier de sauvegarde téléchargé ✓');
    if (r === 'failed') toast('Export impossible sur ce navigateur');
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (fileRef.current) fileRef.current.value = '';
    if (!parsed.ok) {
      haptic('medium');
      toast(parsed.error);
      return;
    }
    setPending(parsed);
  };
  const confirmImport = () => {
    if (!pending) return;
    const prev = actions.replaceState(pending.state);
    setPending(null);
    haptic('success');
    toast('Sauvegarde importée ✓', { actionLabel: 'Annuler', onAction: () => actions.replaceState(prev) });
  };

  const move = (index: number, delta: number) => {
    const order = [...settings.order];
    const j = index + delta;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j], order[index]];
    haptic();
    actions.updateSettings({ order });
  };

  const addKeyword = (c: CategoryId) => {
    const words = draft
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
    if (!words.length) return;
    const existing = new Set(settings.keywords[c].map(normalize));
    const added = words.filter((w) => !existing.has(normalize(w)));
    actions.setKeywords(c, [...settings.keywords[c], ...added]);
    setDraft('');
    haptic('success');
  };

  return (
    <div className="min-h-full pb-10">
      <header className="halftone px-5 pt-5 pb-7 text-white">
        <h1 className="font-display text-[44px] leading-none tracking-wide uppercase">Réglages</h1>
        <p className="mt-1 -rotate-1 font-marker text-[20px] text-ink">à ta sauce.</p>
      </header>

      <div className="relative z-10 -mt-3 space-y-4 px-4">
        <Card title="Apparence">
          <Segmented<Theme>
            value={settings.theme}
            onChange={(theme) => actions.updateSettings({ theme })}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
            ]}
          />
          <label className="mt-3 flex min-h-12 items-center justify-between gap-3">
            <span className="text-[16px] font-semibold">Vibrations au toucher</span>
            <input
              type="checkbox"
              checked={settings.haptics}
              onChange={(e) => actions.updateSettings({ haptics: e.target.checked })}
              className="peer sr-only"
            />
            <span className="relative h-8 w-[52px] rounded-full bg-black/15 transition-colors peer-checked:bg-brand dark:bg-white/20">
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${settings.haptics ? 'translate-x-5' : ''}`}
              />
            </span>
          </label>
        </Card>

        <Card title="Mon responsable" hint="Numéro WhatsApp utilisé par le bouton « Ouvrir sur WhatsApp ». Laisse vide pour choisir le contact à chaque fois.">
          <input
            type="tel"
            inputMode="tel"
            value={settings.managerPhone}
            onChange={(e) => actions.updateSettings({ managerPhone: e.target.value })}
            placeholder="06 12 34 56 78"
            className="h-12 w-full rounded-2xl bg-black/[0.05] px-4 text-[17px] outline-none focus:ring-2 focus:ring-brand dark:bg-white/[0.08]"
          />
        </Card>

        <Card title="Ordre des rayons" hint="L'ordre dans lequel les catégories s'affichent, comme ton parcours en magasin.">
          <ul className="space-y-1.5">
            {settings.order.map((c, i) => (
              <motion.li
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                key={c}
                className="flex min-h-12 items-center gap-2 rounded-2xl bg-black/[0.035] pl-3 dark:bg-white/[0.05]"
              >
                <span className="w-5 text-center font-display text-[15px] text-black/35 dark:text-white/35">{i + 1}</span>
                <span className="text-xl">{CATEGORIES[c].emoji}</span>
                <span className="flex-1 text-[15px] font-semibold">{CATEGORIES[c].label}</span>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="press grid h-11 w-11 place-items-center rounded-xl disabled:opacity-20" aria-label="Monter">
                  <IconUp size={20} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === settings.order.length - 1}
                  className="press grid h-11 w-11 place-items-center rounded-xl disabled:opacity-20"
                  aria-label="Descendre"
                >
                  <IconDown size={20} />
                </button>
              </motion.li>
            ))}
          </ul>
          <button onClick={() => (actions.updateSettings({ order: DEFAULT_ORDER }), toast('Ordre par défaut rétabli'))} className="mt-2 px-1 py-2 text-[14px] font-semibold text-brand">
            Rétablir l'ordre par défaut
          </button>
        </Card>

        <Card title="Mots-clés" hint="Un produit qui contient un de ces mots est rangé dans la catégorie (accents et majuscules ignorés, pluriels reconnus).">
          <div className="space-y-1.5">
            {settings.order.map((c) => {
              const open = openCat === c;
              const words = settings.keywords[c];
              return (
                <div key={c} className="overflow-hidden rounded-2xl bg-black/[0.035] dark:bg-white/[0.05]">
                  <button
                    onClick={() => {
                      haptic();
                      setOpenCat(open ? null : c);
                      setDraft('');
                    }}
                    className="flex min-h-12 w-full items-center gap-2 px-3 text-left"
                  >
                    <span className="text-xl">{CATEGORIES[c].emoji}</span>
                    <span className="flex-1 text-[15px] font-semibold">{CATEGORIES[c].label}</span>
                    <span className="text-[13px] text-black/45 dark:text-white/45">{words.length}</span>
                    <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-black/35 dark:text-white/35">
                      <IconChevron size={20} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="px-3 pb-3">
                          <form
                            className="flex gap-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              addKeyword(c);
                            }}
                          >
                            <input
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              placeholder="Ajouter (séparés par des virgules)"
                              className="h-11 min-w-0 flex-1 rounded-xl bg-white px-3 text-[15px] outline-none focus:ring-2 focus:ring-brand dark:bg-white/[0.08]"
                              autoCapitalize="off"
                              enterKeyHint="done"
                            />
                            <button type="submit" className="press grid h-11 w-11 place-items-center rounded-xl bg-brand text-white" aria-label="Ajouter le mot-clé">
                              <IconPlus size={20} />
                            </button>
                          </form>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {words.length === 0 && <p className="text-[13px] text-black/45 dark:text-white/45">Aucun mot-clé : catégorie par défaut.</p>}
                            {words.map((w) => (
                              <span key={w} className="inline-flex items-center gap-0.5 rounded-full bg-white py-1 pr-1 pl-3 text-[14px] font-medium dark:bg-white/10">
                                {w}
                                <button
                                  onClick={() => actions.setKeywords(c, words.filter((x) => x !== w))}
                                  className="grid h-7 w-7 place-items-center rounded-full text-black/40 active:bg-black/10 dark:text-white/40"
                                  aria-label={`Retirer ${w}`}
                                >
                                  <IconX size={14} />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
          <button onClick={() => (actions.resetKeywords(), toast('Mots-clés par défaut rétablis'))} className="mt-2 px-1 py-2 text-[14px] font-semibold text-brand">
            Rétablir les mots-clés par défaut
          </button>
        </Card>

        <Card
          title="Mes catégories mémorisées"
          hint="Quand tu changes la catégorie d'un article, l'app s'en souvient pour ce produit : il passe avant les mots-clés. Touche une ligne pour la modifier."
        >
          {rules.length === 0 ? (
            <p className="text-[14px] leading-relaxed text-black/50 dark:text-white/50">
              Rien de mémorisé pour l'instant. Appui long sur un article, puis « Changer de catégorie ».
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rules.map(([key, r]) => (
                <li key={key} className="flex min-h-14 items-center rounded-2xl bg-black/[0.035] dark:bg-white/[0.05]">
                  <button
                    onClick={() => (haptic(), setRuleKey(key))}
                    className="press flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-2xl pl-3 text-left"
                    aria-label={`Modifier ${r.name}`}
                  >
                    <span className="text-xl">{CATEGORIES[r.category].emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                      <span className="block truncate text-[13px] text-black/55 dark:text-white/55">{CATEGORIES[r.category].label}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => forgetOne(key, r.name)}
                    className="press grid h-14 w-12 shrink-0 place-items-center text-black/40 dark:text-white/40"
                    aria-label={`Oublier ${r.name}`}
                  >
                    <IconX size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rules.length > 0 && (
            <button onClick={resetRules} className="press mt-2 min-h-11 px-1 text-[15px] font-semibold text-brand">
              Réinitialiser
            </button>
          )}
        </Card>

        <Card
          title="Sauvegarde"
          hint="Chaque action est enregistrée tout de suite sur ce téléphone, sans bouton. Exporte un fichier pour ne rien perdre si tu changes de téléphone."
        >
          <div className="mb-3 space-y-0.5 rounded-2xl bg-black/[0.035] px-4 py-3 text-[14px] leading-relaxed dark:bg-white/[0.05]" data-testid="save-status">
            <p className="font-semibold">
              {save.idb === 'error' ? '⚠️ IndexedDB indisponible : copie de secours seulement' : '✅ Enregistrement automatique actif'}
            </p>
            <p className="text-black/60 dark:text-white/60">
              Dernière écriture :{' '}
              {save.savedAt ? new Date(save.savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'à ta prochaine action'}
            </p>
            <p className="text-black/60 dark:text-white/60">
              Stockage persistant : {save.persisted === true ? 'accordé ✅' : save.persisted === false ? 'non accordé' : 'non géré ici'}
            </p>
          </div>
          <div className="space-y-2.5">
            <PrimaryButton variant="ink" onClick={exportData} className="text-[17px]">
              Exporter mes données
            </PrimaryButton>
            <PrimaryButton variant="soft" onClick={() => fileRef.current?.click()} className="text-[17px]">
              Importer une sauvegarde
            </PrimaryButton>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Fichier de sauvegarde"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>
        </Card>

        <Card title="Installer sur l'iPhone">
          <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-black/70 dark:text-white/70">
            <li>Ouvre l'app dans <b>Safari</b>.</li>
            <li>
              Touche <b>Partager</b> (carré avec flèche ↑).
            </li>
            <li>
              Choisis <b>« Sur l'écran d'accueil »</b>, puis <b>Ajouter</b>.
            </li>
          </ol>
          <p className="mt-2 text-[14px] text-black/50 dark:text-white/50">L'app s'ouvre alors en plein écran et fonctionne sans réseau.</p>
        </Card>

        <Card title="Données" hint="Tout est enregistré uniquement sur ce téléphone. Aucun compte, aucun serveur.">
          <PrimaryButton variant="danger" onClick={() => setConfirmReset(true)} className="text-[16px]">
            Effacer toutes les données
          </PrimaryButton>
        </Card>

        <div className="flex flex-col items-center gap-2 pt-4 pb-2 text-center">
          <div className="halftone rounded-[22px] px-5 py-4">
            <CoursesLogo size="sm" />
          </div>
          <p className="text-[12px] text-black/40 dark:text-white/40">Hashtagbangers Courses · v1.0 · Roubaix</p>
        </div>
      </div>

      <BottomSheet
        open={!!rule}
        onClose={() => setRuleKey(null)}
        title={rule?.name ?? ''}
        footer={
          <PrimaryButton
            variant="danger"
            onClick={() => {
              if (ruleKey && rule) forgetOne(ruleKey, rule.name);
              setRuleKey(null);
            }}
          >
            Oublier ce produit
          </PrimaryButton>
        }
      >
        <p className="mb-3 text-[14px] text-black/55 dark:text-white/55">Ce produit est toujours rangé dans :</p>
        {rule && (
          <CategoryPicker
            value={rule.category}
            order={settings.order}
            onChange={(c) => {
              if (ruleKey) actions.setLearnedCategory(ruleKey, c);
              setRuleKey(null);
              toast(MEMORY_TOAST);
            }}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={!!pending}
        onClose={() => setPending(null)}
        title="Importer ?"
        footer={<PrimaryButton onClick={confirmImport}>Remplacer mes données</PrimaryButton>}
      >
        {pending && (
          <div className="space-y-3 text-[16px] leading-relaxed text-black/70 dark:text-white/70">
            <p>
              Cette sauvegarde contient <b>{pending.listCount} liste{pending.listCount > 1 ? 's' : ''}</b> et{' '}
              <b>{pending.learnedCount} catégorie{pending.learnedCount > 1 ? 's' : ''} mémorisée{pending.learnedCount > 1 ? 's' : ''}</b>
              {pending.exportedAt ? ` (exportée le ${new Date(pending.exportedAt).toLocaleDateString('fr-FR')})` : ''}.
            </p>
            <p>Elle remplacera les listes, l'historique et les réglages de ce téléphone. Tu pourras annuler juste après.</p>
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Tout effacer ?"
        footer={
          <PrimaryButton
            variant="danger"
            onClick={() => {
              actions.resetAll();
              setConfirmReset(false);
              toast('Toutes les données ont été effacées');
            }}
          >
            Oui, tout effacer
          </PrimaryButton>
        }
      >
        <p className="text-[16px] leading-relaxed text-black/65 dark:text-white/65">
          Listes, historique, mots-clés personnalisés et classements appris seront supprimés de ce téléphone. Impossible d'annuler.
        </p>
      </BottomSheet>
    </div>
  );
}
