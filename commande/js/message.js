/* =====================================================================
   message.js — texte de commande et liens wa.me / sms: / mailto:
   Aucune API externe : on ouvre simplement l'app du téléphone.
   ===================================================================== */
import { fmtDate, fmtNum } from './ui.js';

const INDICATIF_DEFAUT = '33';   // France : 06… devient +336…

/** Numéro au format international sans « + » (pour wa.me). */
export function phoneDigits(raw) {
  let s = String(raw || '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  else if (s.startsWith('0')) s = INDICATIF_DEFAUT + s.slice(1);
  return s.replace(/\D/g, '');
}

export const phoneIntl = (raw) => {
  const d = phoneDigits(raw);
  return d ? `+${d}` : '';
};

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Message de commande.
 * @param {{supplierName:string, restaurantName:string, date:string,
 *          lines:Array<{qty:number, name:string, packLabel?:string, unit?:string}>,
 *          deliveryDate?:string}} o
 */
export function buildMessage(o) {
  const lignes = (o.lines || [])
    .filter((l) => Number(l.qty) > 0)
    .map((l) => {
      const cond = l.packLabel || l.unit || '';
      return `- ${fmtNum(l.qty)} x ${l.name}${cond ? ` (${cond})` : ''}`;
    });
  const tete = `Bonjour ${o.supplierName || 'Fournisseur'}, commande de ${o.restaurantName || 'notre établissement'} du ${fmtDate(o.date)} :`;
  const pied = `Livraison souhaitée : ${fmtDate(o.deliveryDate || o.date)}. Merci !`;
  return [tete, ...lignes, '', pied].join('\n');
}

export function whatsappLink(phone, text) {
  const d = phoneDigits(phone);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function smsLink(phone, text) {
  const num = phoneIntl(phone);
  const sep = isIOS() ? '&' : '?';        // iOS attend sms:numéro&body=…
  return `sms:${num}${sep}body=${encodeURIComponent(text)}`;
}

export function mailtoLink(email, subject, text) {
  return `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/** Copie dans le presse-papiers, avec repli pour les vieux navigateurs. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* on tente le repli */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

/** Ouvre un lien externe sans casser la PWA en plein écran iOS. */
export function openLink(href) {
  const a = document.createElement('a');
  a.href = href;
  a.rel = 'noopener';
  if (/^https?:/.test(href)) a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
