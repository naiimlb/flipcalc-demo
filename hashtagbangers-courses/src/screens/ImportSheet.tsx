import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { PrimaryButton, StorePicker } from '../components/Controls';
import { IconClipboard } from '../components/Icons';
import { toast } from '../components/Toast';
import { CATEGORIES } from '../lib/categories';
import { haptic } from '../lib/haptics';
import { buildItems, groupByCategory, newList } from '../lib/lists';
import { parseList } from '../lib/parser';
import { readClipboard } from '../lib/share';
import type { StoreId } from '../lib/types';
import { actions, useAppState } from '../state/store';

export const EXEMPLE_LISTE = `2 x Huile de friture 10L
Poulet pané 5kg x3
Cheddar tranches
4 Coca-Cola 33cl
Boîtes burger x500
Salade iceberg x6
Frites 2,5kg - 8
Sauce algérienne
Pain burger brioché x10
Liquide vaisselle`;

export function ImportSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const settings = useAppState((s) => s.settings);
  const [text, setText] = useState('');
  const [store, setStore] = useState<StoreId>(settings.lastStore);
  const [storeName, setStoreName] = useState('');

  const items = useMemo(() => buildItems(parseList(text), settings.keywords, settings.learned), [text, settings.keywords, settings.learned]);
  const groups = useMemo(() => groupByCategory(items, settings.order, false), [items, settings.order]);

  const paste = async () => {
    haptic();
    const clip = await readClipboard();
    if (clip && clip.trim()) {
      setText((t) => (t.trim() ? `${t.trimEnd()}\n${clip}` : clip));
      toast('Liste collée 📋');
    } else {
      toast('Presse-papiers vide ou bloqué : appui long dans le champ → Coller');
    }
  };

  const create = () => {
    if (!items.length) return;
    haptic('success');
    actions.createList(newList(store, items, storeName));
    setText('');
    onCreated();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      tall
      title="Coller ma liste"
      footer={
        <PrimaryButton onClick={create} disabled={!items.length}>
          {items.length ? `Créer la liste · ${items.length} article${items.length > 1 ? 's' : ''}` : 'Créer la liste'}
        </PrimaryButton>
      }
    >
      <p className="mb-2 text-[13px] font-semibold tracking-wide text-black/50 uppercase dark:text-white/50">Magasin</p>
      <StorePicker value={store} onChange={setStore} />
      <AnimatePresence initial={false}>
        {store === 'autre' && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Nom du magasin (facultatif)"
              className="mt-2 h-12 w-full rounded-2xl bg-black/[0.05] px-4 outline-none focus:ring-2 focus:ring-brand dark:bg-white/[0.08]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={paste}
        className="press mt-4 flex min-h-16 w-full items-center justify-center gap-3 rounded-[22px] bg-brand-50 font-display text-[20px] tracking-wide text-brand-700 uppercase dark:bg-brand/15 dark:text-brand-200"
      >
        <IconClipboard size={26} /> Coller depuis le presse-papiers
      </button>

      <div className="relative mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={'Une ligne par produit, par exemple :\n2 x Huile de friture 10L\nPoulet pané 5kg x3\nCheddar tranches'}
          className="block min-h-[170px] w-full resize-none rounded-[22px] bg-black/[0.04] px-4 py-3.5 text-[16px] leading-relaxed outline-none placeholder:text-black/35 focus:ring-2 focus:ring-brand dark:bg-white/[0.06] dark:placeholder:text-white/30"
          autoCapitalize="sentences"
          autoCorrect="off"
          spellCheck={false}
        />
        {text && (
          <button onClick={() => setText('')} className="press absolute top-2.5 right-2.5 rounded-full bg-black/10 px-3 py-1.5 text-[13px] font-semibold dark:bg-white/15">
            Effacer
          </button>
        )}
      </div>
      {!text && (
        <button onClick={() => setText(EXEMPLE_LISTE)} className="mt-2 px-1 py-2 text-[14px] font-semibold text-brand underline-offset-2 active:underline">
          Essayer avec une liste d'exemple
        </button>
      )}

      {items.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 flex items-baseline justify-between">
            <span className="font-display text-[20px] tracking-wide uppercase">Aperçu</span>
            <span className="text-[14px] font-semibold text-black/50 dark:text-white/50">
              {items.length} article{items.length > 1 ? 's' : ''} détecté{items.length > 1 ? 's' : ''}
            </span>
          </p>
          <div className="space-y-2.5">
            {groups.map((g) => (
              <div key={g.category} className="rounded-[20px] bg-black/[0.035] px-4 py-3 dark:bg-white/[0.05]">
                <p className="mb-1 text-[14px] font-bold">
                  {CATEGORIES[g.category].emoji} {CATEGORIES[g.category].label}
                </p>
                <ul className="text-[15px] leading-relaxed text-black/75 dark:text-white/75">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-3">
                      <span className="truncate">{it.name}</span>
                      <span className="shrink-0 font-display text-[16px] text-brand">x{it.qty}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-black/45 dark:text-white/45">
            Un article mal rangé ? Après création, appui long dessus pour le déplacer : l'app s'en souviendra.
          </p>
        </div>
      )}
    </BottomSheet>
  );
}
