/* =====================================================================
   Historique — commandes passées, détail, « recommander à l'identique »
   ===================================================================== */
import { el, frag, icon, empty, sheet, toast, confirmSheet, fmtDate, fmtRelative, fmtNum, plural, todayISO, addDaysISO } from '../ui.js';
import * as store from '../store.js';
import { segbar } from './order.js';
import { buildMessage, whatsappLink, smsLink, mailtoLink, copyText, openLink } from '../message.js';

const BADGE = {
  brouillon: ['', 'Brouillon'],
  envoyee: ['accent', 'Envoyée'],
  recue: ['ok', 'Reçue'],
};

export function render(ctx) {
  const cmds = store.orders();
  const wrap = el('div', { class: 'screen' });

  wrap.appendChild(el('div', { class: 'topbar' }, [
    el('h1', {}, [el('span', { text: 'Commandes' }), el('span', { class: 'sub', text: plural(cmds.length, 'commande passée', 'commandes passées') })]),
  ]));
  wrap.appendChild(segbar(ctx, 'historique'));

  if (!cmds.length) {
    wrap.appendChild(empty('clock', 'Pas encore de commande',
      'Tes commandes envoyées apparaîtront ici, prêtes à être renvoyées à l’identique.',
      el('button', { class: 'btn primary', type: 'button', onClick: () => ctx.navigate('#/commandes') }, [icon('send', 18), 'Préparer une commande'])));
    return wrap;
  }

  wrap.appendChild(el('div', { class: 'list' }, cmds.map((o) => {
    const [cls, label] = BADGE[o.status] || BADGE.brouillon;
    const n = store.orderLines(o.id).length;
    return el('button', { class: 'list-row', type: 'button', onClick: () => ctx.navigate(`#/commande/${o.id}`) }, [
      el('span', { class: 'grow' }, [
        el('span', { class: 'name', text: o.supplier_name || 'Fournisseur' }),
        el('span', { class: 'meta', text: `${fmtRelative(o.ordered_at)} · ${plural(n, 'ligne', 'lignes')}` }),
      ]),
      el('span', { class: `badge ${cls}`, text: label }),
      icon('chevronRight', 18, 'chev'),
    ]);
  })));

  return wrap;
}

/* --------------------------------------------------------- Détail */

export function renderDetail(ctx, id) {
  const o = store.order(id);
  const wrap = el('div', { class: 'screen' });

  if (!o) {
    wrap.appendChild(empty('alert', 'Commande introuvable', 'Elle a peut-être été supprimée.',
      el('button', { class: 'btn primary', type: 'button', onClick: () => ctx.navigate('#/historique') }, ['Retour à l’historique'])));
    return wrap;
  }

  const lines = store.orderLines(o.id);
  const sup = o.supplier_id ? store.supplier(o.supplier_id) : null;
  const resto = store.restaurant();

  const message = () => o.message || buildMessage({
    supplierName: o.supplier_name || 'Fournisseur',
    restaurantName: (resto && resto.name) || 'notre établissement',
    date: o.ordered_at,
    deliveryDate: o.delivery_at || o.ordered_at,
    lines: lines.map((l) => ({ qty: l.qty, name: l.product_name, packLabel: l.pack_label, unit: l.unit })),
  });

  wrap.appendChild(el('div', { class: 'topbar' }, [
    el('button', { class: 'icon-btn plain', type: 'button', 'aria-label': 'Retour', onClick: () => ctx.navigate('#/historique') }, [icon('arrowLeft', 22)]),
    el('h1', {}, [
      el('span', { text: o.supplier_name || 'Fournisseur' }),
      el('span', { class: 'sub', text: fmtDate(o.ordered_at) }),
    ]),
  ]));

  /* Statut */
  const statusRow = el('div', { class: 'chips', style: 'margin-bottom:14px' },
    [['brouillon', 'Brouillon'], ['envoyee', 'Envoyée'], ['recue', 'Reçue']].map(([v, label]) =>
      el('button', {
        class: `chip sm ${o.status === v ? 'on' : ''}`, type: 'button',
        onClick: async () => {
          if (v === 'recue' && o.status !== 'recue') {
            const ok = await confirmSheet('Commande reçue',
              'Ajouter les quantités commandées au stock actuel de chaque produit ?', { okLabel: 'Oui, ajouter' });
            if (ok) {
              store.putMany('products', lines
                .filter((l) => l.product_id && store.product(l.product_id))
                .map((l) => ({ id: l.product_id, current_stock: Number(store.product(l.product_id).current_stock || 0) + Number(l.qty || 0) })));
              toast('Stock mis à jour', 'ok');
            }
          }
          store.put('orders', { id: o.id, status: v });
          ctx.refresh();
        },
      }, [label])));
  wrap.appendChild(statusRow);

  /* Lignes */
  wrap.appendChild(el('div', { class: 'card' }, lines.length ? lines.map((l) => el('div', { class: 'inv-row' }, [
    el('div', { class: 'grow' }, [
      el('div', { class: 'name', text: l.product_name }),
      el('div', { class: 'meta', text: l.pack_label || l.unit || '' }),
    ]),
    el('div', { class: 'badge accent num', text: `${fmtNum(l.qty)}` }),
  ])) : [el('div', { class: 'card-pad', style: 'color:var(--text-dim)' }, ['Aucune ligne.'])]));

  if (o.delivery_at) {
    wrap.appendChild(el('div', { style: 'margin-top:10px;font-size:.84rem;color:var(--text-dim)' }, [
      `Livraison souhaitée : ${fmtDate(o.delivery_at)}`,
    ]));
  }

  /* Renvoi */
  const renvoyer = (channel) => {
    const txt = message();
    if (channel === 'copie') {
      copyText(txt).then((ok) => toast(ok ? 'Message copié' : 'Copie impossible', ok ? 'ok' : 'err'));
      return;
    }
    if ((channel === 'whatsapp' || channel === 'sms') && !(sup && sup.phone)) return toast('Aucun numéro pour ce fournisseur', 'err');
    if (channel === 'email' && !(sup && sup.email)) return toast('Aucun email pour ce fournisseur', 'err');
    openLink(channel === 'whatsapp' ? whatsappLink(sup.phone, txt)
      : channel === 'sms' ? smsLink(sup.phone, txt)
        : mailtoLink(sup.email, `Commande ${(resto && resto.name) || ''}`.trim(), txt));
  };

  wrap.appendChild(el('div', { class: 'section' }, [el('h2', { text: 'Renvoyer ce message' })]));
  wrap.appendChild(el('div', { class: 'card' }, [
    el('div', { class: 'send-row' }, [
      el('button', { class: 'btn wa', type: 'button', onClick: () => renvoyer('whatsapp') }, [icon('message', 18), 'WhatsApp']),
      el('button', { class: 'btn', type: 'button', onClick: () => renvoyer('sms') }, [icon('phone', 18), 'SMS']),
      el('button', { class: 'btn', type: 'button', onClick: () => renvoyer('email') }, [icon('mail', 18), 'Email']),
      el('button', { class: 'btn', type: 'button', onClick: () => renvoyer('copie') }, [icon('copy', 18), 'Copier']),
    ]),
  ]));

  wrap.appendChild(el('button', {
    class: 'btn primary full', type: 'button', style: 'margin-top:14px',
    onClick: () => {
      const copy = store.put('orders', {
        supplier_id: o.supplier_id,
        supplier_name: o.supplier_name,
        ordered_at: todayISO(),
        delivery_at: addDaysISO(todayISO(), 1),
        status: 'brouillon',
        channel: null,
        message: null,
      });
      store.putMany('order_lines', lines.map((l) => ({
        order_id: copy.id, product_id: l.product_id, product_name: l.product_name,
        pack_label: l.pack_label, unit: l.unit, qty: l.qty,
      })));
      toast('Nouvelle commande créée à l’identique', 'ok');
      ctx.navigate(`#/commande/${copy.id}`);
    },
  }, [icon('rotate', 18), 'Recommander à l’identique']));

  wrap.appendChild(el('button', {
    class: 'btn quiet full', type: 'button', style: 'margin-top:6px',
    onClick: () => sheet('Message envoyé', () => el('pre', {
      text: message(),
      style: 'white-space:pre-wrap;font:inherit;font-size:.88rem;background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px;color:var(--text)',
    })),
  }, [icon('eye', 18), 'Voir le message']));

  wrap.appendChild(el('button', {
    class: 'btn danger full', type: 'button', style: 'margin-top:18px',
    onClick: async () => {
      if (await confirmSheet('Supprimer la commande', 'Cette commande sera retirée de l’historique.', { danger: true, okLabel: 'Supprimer' })) {
        for (const l of lines) store.remove('order_lines', l.id);
        store.remove('orders', o.id);
        toast('Commande supprimée');
        ctx.navigate('#/historique');
      }
    },
  }, [icon('trash', 18), 'Supprimer']));

  return wrap;
}
