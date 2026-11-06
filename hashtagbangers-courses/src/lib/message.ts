import { CATEGORIES, type CategoryId } from './categories';
import { groupByCategory, storeLabel } from './lists';
import type { ShoppingList } from './types';

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Message lisible à envoyer au responsable :
 *
 * 🛒 Manquants Métro – 06/11
 *
 * 🥩 Viandes & Poulet
 * • Poulet pané x3
 */
export function buildMissingMessage(list: ShoppingList, order: CategoryId[]): string {
  const store = storeLabel(list);
  const title = `🛒 Manquants${store ? ` ${store}` : ''} – ${formatDate(list.finishedAt ?? list.createdAt)}`;
  const blocks = groupByCategory(list.items, order, false).map((g) => {
    const cat = CATEGORIES[g.category];
    const lines = g.items.map((it) => `• ${it.name} x${it.qty}`);
    return [`${cat.emoji} ${cat.label}`, ...lines].join('\n');
  });
  if (blocks.length === 0) return `${title}\n\nRien ne manque ✅`;
  return [title, ...blocks].join('\n\n');
}

export function whatsappUrl(text: string, phone?: string): string {
  let digits = (phone ?? '').replace(/\D/g, '').replace(/^00/, '');
  // Numéro français saisi en national (06 12 34 56 78) → 33612345678
  if (/^0\d{9}$/.test(digits)) digits = `33${digits.slice(1)}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
