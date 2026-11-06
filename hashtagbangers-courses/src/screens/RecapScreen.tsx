import { motion } from 'motion/react';
import { PrimaryButton } from '../components/Controls';
import { IconCopy, IconPlus, IconShare, IconWhatsApp, IconX } from '../components/Icons';
import { BrushCart } from '../components/Logo';
import { toast } from '../components/Toast';
import { CATEGORIES } from '../lib/categories';
import { haptic } from '../lib/haptics';
import { groupByCategory, storeLabel } from '../lib/lists';
import { buildMissingMessage, formatDate, whatsappUrl } from '../lib/message';
import { copyText, shareText } from '../lib/share';
import { actions, useAppState } from '../state/store';

/**
 * Récap de fin de courses, et vue d'une liste « Manquants » depuis l'historique.
 * `finishedId` : la liste de courses terminée (peut manquer si on ouvre des manquants orphelins).
 * `missingId` : la liste des manquants (null si rien ne manque).
 */
export function RecapScreen({
  finishedId,
  missingId,
  onClose,
  onNewList,
  fresh,
}: {
  finishedId: string | null;
  missingId: string | null;
  onClose: () => void;
  onNewList: () => void;
  /** Vrai juste après « Terminer les courses » (titre « Courses terminées »). */
  fresh: boolean;
}) {
  const lists = useAppState((s) => s.lists);
  const order = useAppState((s) => s.settings.order);
  const phone = useAppState((s) => s.settings.managerPhone);
  const missing = lists.find((l) => l.id === missingId) ?? null;
  const finished = lists.find((l) => l.id === (finishedId ?? missing?.sourceId)) ?? null;
  const ref = missing ?? finished;

  const takenCount = finished ? finished.items.filter((i) => i.taken > 0).length : null;
  const missingCount = missing?.items.length ?? 0;
  const message = missing ? buildMissingMessage(missing, order) : '';
  const groups = missing ? groupByCategory(missing.items, order, false) : [];
  const store = ref ? storeLabel(ref) : '';
  const date = ref ? formatDate(ref.finishedAt ?? ref.createdAt) : '';

  const send = async () => {
    haptic();
    const r = await shareText(message, `Manquants ${store}`.trim());
    if (r === 'copied') toast('Message copié : colle-le dans ta conversation');
    if (r === 'failed') toast('Impossible de partager ni de copier');
  };
  const copy = async () => {
    haptic();
    toast((await copyText(message)) ? 'Message copié ✓' : 'Copie impossible');
  };
  const whatsapp = () => {
    haptic();
    window.open(whatsappUrl(message, phone), '_blank');
  };
  const newFromMissing = () => {
    if (!missing) return;
    haptic('success');
    actions.coursesFromList(missing.id);
    toast('Nouvelle liste créée avec les manquants');
    onNewList();
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col bg-paper dark:bg-night"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
    >
      <div className="scroll-area flex-1">
        <header className="halftone relative overflow-hidden px-6 pb-14 text-white" style={{ paddingTop: 'calc(var(--safe-top) + 14px)' }}>
          <button
            onClick={() => (haptic(), onClose())}
            className="press absolute right-4 grid h-12 w-12 place-items-center rounded-full bg-white/20 backdrop-blur"
            style={{ top: 'calc(var(--safe-top) + 10px)' }}
            aria-label="Fermer"
          >
            <IconX size={22} />
          </button>
          <motion.div initial={{ scale: 0.6, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.12 }}>
            <p className="font-display text-[46px] leading-[0.95] tracking-wide uppercase">
              {fresh ? (
                <>
                  Courses
                  <br />
                  terminées
                </>
              ) : (
                <>Manquants</>
              )}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="-rotate-2 font-marker text-[24px] text-ink">{fresh ? (missingCount ? 'presque tout !' : 'bien joué !') : `${store} ${date}`.trim()}</span>
              <BrushCart className="w-8 -rotate-6" />
            </div>
          </motion.div>
          {fresh && (
            <p className="mt-2 text-[15px] font-medium text-white/85">
              {store ? `${store} · ` : ''}
              {date}
            </p>
          )}
        </header>

        <div className="relative z-10 -mt-9 space-y-4 px-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 24 }}
              className="rounded-[24px] bg-white px-4 py-4 shadow-[0_12px_30px_-18px_rgba(120,0,50,0.4)] dark:bg-night-card"
            >
              <p className="text-[14px] font-semibold">✅ Pris</p>
              <p className="font-display text-[44px] leading-none">{takenCount ?? '–'}</p>
              <p className="text-[13px] text-black/50 dark:text-white/50">article{(takenCount ?? 0) > 1 ? 's' : ''}</p>
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.28, type: 'spring', stiffness: 300, damping: 24 }}
              className={`rounded-[24px] px-4 py-4 shadow-[0_12px_30px_-18px_rgba(120,0,50,0.4)] ${
                missingCount ? 'bg-partial-50 dark:bg-[#2a2016]' : 'bg-white dark:bg-night-card'
              }`}
            >
              <p className="text-[14px] font-semibold">⚠️ Manquants</p>
              <p className={`font-display text-[44px] leading-none ${missingCount ? 'text-[#c25e00] dark:text-partial' : ''}`}>{missingCount}</p>
              <p className="text-[13px] text-black/50 dark:text-white/50">article{missingCount > 1 ? 's' : ''}</p>
            </motion.div>
          </div>

          {missing ? (
            <>
              <div className="overflow-hidden rounded-[26px] bg-white shadow-[0_12px_30px_-18px_rgba(120,0,50,0.35)] dark:bg-night-card">
                <p className="border-b border-black/[0.06] px-5 pt-4 pb-3 font-display text-[20px] tracking-wide uppercase dark:border-white/[0.07]">
                  🛒 Manquants {store} – {date}
                </p>
                <div className="space-y-3 px-5 py-4">
                  {groups.map((g) => (
                    <div key={g.category}>
                      <p className="text-[15px] font-bold">
                        {CATEGORIES[g.category].emoji} {CATEGORIES[g.category].label}
                      </p>
                      <ul className="mt-0.5 text-[16px] leading-relaxed">
                        {g.items.map((it) => (
                          <li key={it.id} className="flex justify-between gap-3">
                            <span>• {it.name}</span>
                            <span className="font-display text-[18px] text-[#c25e00] dark:text-partial">x{it.qty}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <PrimaryButton onClick={send} className="min-h-16 text-[21px]">
                  <IconShare size={24} /> Envoyer à mon responsable
                </PrimaryButton>
                <div className="grid grid-cols-2 gap-2.5">
                  <PrimaryButton variant="whatsapp" onClick={whatsapp} className="text-[17px]">
                    <IconWhatsApp size={22} /> WhatsApp
                  </PrimaryButton>
                  <PrimaryButton variant="soft" onClick={copy} className="text-[17px]">
                    <IconCopy size={22} /> Copier
                  </PrimaryButton>
                </div>
                <PrimaryButton variant="outline" onClick={newFromMissing} className="text-[16px]">
                  <IconPlus size={20} /> Nouvelle liste avec les manquants
                </PrimaryButton>
              </div>
            </>
          ) : (
            <div className="rounded-[26px] bg-white px-6 py-8 text-center dark:bg-night-card">
              <p className="text-[44px]">🎉</p>
              <p className="font-display text-[26px] uppercase">Rien ne manque</p>
              <p className="mt-1 text-black/55 dark:text-white/55">Tout a été pris. Rien à envoyer.</p>
            </div>
          )}

          <button onClick={() => (haptic(), onClose())} className="press min-h-14 w-full rounded-2xl text-[16px] font-semibold text-black/55 dark:text-white/55">
            Fermer
          </button>
        </div>
        <div style={{ height: 'var(--safe-bottom)' }} />
      </div>
    </motion.div>
  );
}
