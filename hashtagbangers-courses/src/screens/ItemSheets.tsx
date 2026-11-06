import { useEffect, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { CategoryPicker, PrimaryButton, QtyStepper } from '../components/Controls';
import { IconTrash } from '../components/Icons';
import { toast } from '../components/Toast';
import { CATEGORIES, type CategoryId } from '../lib/categories';
import { categorize } from '../lib/categorize';
import { haptic } from '../lib/haptics';
import type { Item } from '../lib/types';
import { actions, useAppState } from '../state/store';

const inputCls =
  'h-14 w-full rounded-2xl bg-black/[0.05] px-4 text-[17px] font-semibold outline-none focus:ring-2 focus:ring-brand dark:bg-white/[0.08]';
const labelCls = 'mb-2 mt-5 block text-[13px] font-semibold tracking-wide text-black/50 uppercase dark:text-white/50';

/** Appui long sur un article : renommer, quantité demandée, changer de catégorie, supprimer. */
export function EditItemSheet({
  listId,
  item,
  onClose,
  onDelete,
}: {
  listId: string;
  item: Item | null;
  onClose: () => void;
  onDelete: (item: Item) => void;
}) {
  const order = useAppState((s) => s.settings.order);
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [category, setCategory] = useState<CategoryId>('autres');

  useEffect(() => {
    if (item) {
      setName(item.name);
      setQty(item.qty);
      setCategory(item.category);
    }
  }, [item]);

  const save = () => {
    if (!item) return;
    const trimmed = name.trim() || item.name;
    actions.editItem(listId, item.id, { name: trimmed, qty, category });
    haptic('success');
    if (category !== item.category) toast(`Rangé dans ${CATEGORIES[category].label} · mémorisé ✓`);
    onClose();
  };

  return (
    <BottomSheet
      open={!!item}
      onClose={onClose}
      title="Modifier"
      footer={
        <div className="flex gap-2.5">
          <button
            onClick={() => item && (onClose(), onDelete(item))}
            className="press grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400"
            aria-label="Supprimer l'article"
          >
            <IconTrash size={22} />
          </button>
          <PrimaryButton onClick={save}>Enregistrer</PrimaryButton>
        </div>
      }
    >
      <label className={labelCls + ' !mt-1'} htmlFor="edit-name">
        Nom
      </label>
      <input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} enterKeyHint="done" />
      <span className={labelCls}>Quantité demandée</span>
      <QtyStepper value={qty} onChange={setQty} label="Quantité demandée" />
      <span className={labelCls}>Catégorie</span>
      <CategoryPicker value={category} onChange={setCategory} order={order} />
      <p className="mt-3 text-[13px] text-black/45 dark:text-white/45">
        Le changement de catégorie est retenu pour les prochaines listes.
      </p>
    </BottomSheet>
  );
}

/** Bouton « + » : ajouter un article à la main. */
export function AddItemSheet({ listId, open, onClose }: { listId: string; open: boolean; onClose: () => void }) {
  const settings = useAppState((s) => s.settings);
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [manual, setManual] = useState<CategoryId | null>(null);

  const auto = categorize(name, settings.keywords, settings.learned).category;
  const category = manual ?? auto;

  useEffect(() => {
    if (open) {
      setName('');
      setQty(1);
      setManual(null);
    }
  }, [open]);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const finalName = trimmed.charAt(0).toLocaleUpperCase('fr-FR') + trimmed.slice(1);
    actions.addItem(listId, { name: finalName, qty, category });
    if (manual && manual !== auto) actions.learnCategory(finalName, manual);
    haptic('success');
    toast(`${finalName} ajouté ✓`);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Ajouter un article"
      footer={
        <PrimaryButton onClick={add} disabled={!name.trim()}>
          Ajouter
        </PrimaryButton>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className={labelCls + ' !mt-1'} htmlFor="add-name">
          Produit
        </label>
        <input
          id="add-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex : Sauce samouraï 1L"
          className={inputCls}
          autoFocus
          enterKeyHint="done"
          autoComplete="off"
        />
      </form>
      <span className={labelCls}>Quantité</span>
      <QtyStepper value={qty} onChange={setQty} />
      <span className={labelCls}>
        Catégorie {!manual && name.trim() && <span className="normal-case tracking-normal text-brand">· détectée automatiquement</span>}
      </span>
      <CategoryPicker value={category} onChange={setManual} order={settings.order} />
    </BottomSheet>
  );
}
