/* =====================================================================
   Fournisseurs — liste, ajout, modification
   ===================================================================== */
import { el, frag, icon, empty, sheet, toast, confirmSheet, field, plural } from '../ui.js';
import * as store from '../store.js';
import { phoneIntl } from '../message.js';

function formSheet(s, onSaved) {
  const nouveau = !s;
  const v = s || { name: '', phone: '', email: '', order_days: [] };
  const jours = new Set(v.order_days || []);

  sheet(nouveau ? 'Nouveau fournisseur' : 'Modifier le fournisseur', (close) => {
    const iName = el('input', { type: 'text', value: v.name, placeholder: 'Ex. Metro Pro', autocapitalize: 'words' });
    const iPhone = el('input', { type: 'tel', inputmode: 'tel', value: v.phone || '', placeholder: '+33 6 12 34 56 78', autocomplete: 'tel' });
    const iMail = el('input', { type: 'email', inputmode: 'email', value: v.email || '', placeholder: 'commandes@fournisseur.fr', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });

    const chips = el('div', { class: 'chips' }, store.JOURS.map((j) => {
      const b = el('button', { class: `chip sm ${jours.has(j) ? 'on' : ''}`, type: 'button' }, [j]);
      b.addEventListener('click', () => {
        if (jours.has(j)) jours.delete(j); else jours.add(j);
        b.classList.toggle('on', jours.has(j));
      });
      return b;
    }));

    return frag([
      field('Nom', iName),
      field('WhatsApp / téléphone', iPhone, 'Format international conseillé : +33…'),
      field('Email', iMail),
      el('div', { class: 'field' }, [el('label', { text: 'Jours de commande' }), chips]),
      el('div', { class: 'sheet-actions' }, [
        el('button', { class: 'btn ghost', type: 'button', onClick: close }, ['Annuler']),
        el('button', {
          class: 'btn primary', type: 'button',
          onClick: () => {
            if (!iName.value.trim()) return toast('Le nom est obligatoire', 'err');
            store.put('suppliers', {
              id: s ? s.id : undefined,
              name: iName.value.trim(),
              phone: iPhone.value.trim() || null,
              email: iMail.value.trim() || null,
              order_days: store.JOURS.filter((j) => jours.has(j)),
            });
            close();
            toast(nouveau ? 'Fournisseur ajouté' : 'Fournisseur modifié', 'ok');
            onSaved();
          },
        }, ['Enregistrer']),
      ]),
      !nouveau ? el('button', {
        class: 'btn danger full', type: 'button', style: 'margin-top:12px',
        onClick: async () => {
          const lies = store.products().filter((p) => p.supplier_id === s.id);
          const msg = lies.length
            ? `${plural(lies.length, 'produit sera détaché', 'produits seront détachés')} de ce fournisseur.`
            : 'Ce fournisseur sera supprimé.';
          if (await confirmSheet('Supprimer le fournisseur', msg, { danger: true, okLabel: 'Supprimer' })) {
            if (lies.length) store.putMany('products', lies.map((p) => ({ id: p.id, supplier_id: null })));
            store.remove('suppliers', s.id);
            close();
            toast('Fournisseur supprimé');
            onSaved();
          }
        },
      }, [icon('trash', 18), 'Supprimer']) : null,
    ]);
  });
}

export function render(ctx, params) {
  const list = store.suppliers();
  const wrap = el('div', { class: 'screen' });
  const refresh = () => ctx.refresh();

  wrap.appendChild(el('div', { class: 'topbar' }, [
    el('button', { class: 'icon-btn plain', type: 'button', 'aria-label': 'Retour', onClick: () => ctx.navigate('#/') }, [icon('arrowLeft', 22)]),
    el('h1', {}, [el('span', { text: 'Fournisseurs' }), el('span', { class: 'sub', text: plural(list.length, 'fournisseur', 'fournisseurs') })]),
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Ajouter un fournisseur', onClick: () => formSheet(null, refresh) }, [icon('plus', 22)]),
  ]));

  if (!list.length) {
    wrap.appendChild(empty('users', 'Aucun fournisseur', 'Ajoute tes fournisseurs pour envoyer tes commandes en un tap.',
      el('button', { class: 'btn primary', type: 'button', onClick: () => formSheet(null, refresh) }, [icon('plus', 18), 'Ajouter un fournisseur'])));
    return wrap;
  }

  wrap.appendChild(el('div', { class: 'list' }, list.map((s) => {
    const nb = store.products().filter((p) => p.supplier_id === s.id).length;
    const contact = [s.phone ? phoneIntl(s.phone) : null, s.email].filter(Boolean).join(' · ');
    return el('button', { class: 'list-row', type: 'button', onClick: () => formSheet(s, refresh) }, [
      el('span', { class: 'grow' }, [
        el('span', { class: 'name', text: s.name }),
        el('span', { class: 'meta', text: contact || 'aucun contact' }),
      ]),
      el('span', { class: 'badge', text: `${nb}` }),
      icon('chevronRight', 18, 'chev'),
    ]);
  })));

  wrap.appendChild(el('div', { style: 'margin-top:10px;font-size:.8rem;color:var(--text-dim)' }, [
    'Les jours de commande s’affichent sur l’écran de commande proposée.',
  ]));

  wrap.appendChild(el('button', {
    class: 'btn full', type: 'button', style: 'margin-top:16px',
    onClick: () => formSheet(null, refresh),
  }, [icon('plus', 18), 'Ajouter un fournisseur']));

  /* Ouverture directe d'une fiche (#/fournisseurs?edit=<id>) */
  if (params && params.edit) {
    const s = store.supplier(params.edit);
    if (s) setTimeout(() => formSheet(s, refresh), 60);
  }

  return wrap;
}
