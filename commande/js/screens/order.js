/* =====================================================================
   Commande proposée — lignes regroupées par fournisseur, envoi 1 tap
   Quantité = max(0, cible − actuel) arrondie au conditionnement supérieur.
   ===================================================================== */
import { el, frag, icon, empty, sheet, toast, fmtNum, todayISO, addDaysISO, plural, field } from '../ui.js';
import * as store from '../store.js';
import { buildMessage, whatsappLink, smsLink, mailtoLink, copyText, openLink } from '../message.js';

const SANS = '__sans__';

export function segbar(ctx, active) {
  return el('div', { class: 'seg' }, [
    el('button', { class: active === 'proposition' ? 'on' : '', type: 'button', onClick: () => ctx.navigate('#/commandes') }, ['Proposition']),
    el('button', { class: active === 'historique' ? 'on' : '', type: 'button', onClick: () => ctx.navigate('#/historique') }, ['Historique']),
  ]);
}

export function render(ctx) {
  const resto = store.restaurant();
  const overrides = ctx.state.qty || (ctx.state.qty = {});
  const envoyees = ctx.state.sent || (ctx.state.sent = {});   /* fournisseur -> commande envoyée */
  if (!ctx.state.delivery || ctx.state.delivery < todayISO()) ctx.state.delivery = addDaysISO(todayISO(), 1);

  const wrap = el('div', { class: 'screen' });
  const body = el('div');

  const qtyOf = (p) => (overrides[p.id] !== undefined ? overrides[p.id] : store.suggestedQty(p));

  function groups() {
    const out = new Map();
    for (const p of store.products()) {
      if (qtyOf(p) <= 0) continue;
      const key = p.supplier_id || SANS;
      if (!out.has(key)) out.set(key, []);
      out.get(key).push(p);
    }
    return out;
  }

  /* ------------------------------------------------------- Envoi */

  function enregistrer(sup, produits, channel, message) {
    const cmd = store.put('orders', {
      supplier_id: sup ? sup.id : null,
      supplier_name: sup ? sup.name : 'Sans fournisseur',
      ordered_at: todayISO(),
      delivery_at: ctx.state.delivery,
      status: 'envoyee',
      channel,
      message,
    });
    store.putMany('order_lines', produits.map((p) => ({
      order_id: cmd.id,
      product_id: p.id,
      product_name: p.name,
      pack_label: p.pack_label || null,
      unit: p.unit || null,
      qty: qtyOf(p),
    })));
    for (const p of produits) delete overrides[p.id];
    envoyees[sup ? sup.id : SANS] = { orderId: cmd.id, lignes: produits.length, canal: channel };
    return cmd;
  }

  function messageFor(sup, produits) {
    return buildMessage({
      supplierName: sup ? sup.name : 'Fournisseur',
      restaurantName: (resto && resto.name) || 'notre établissement',
      date: todayISO(),
      deliveryDate: ctx.state.delivery,
      lines: produits.map((p) => ({ qty: qtyOf(p), name: p.name, packLabel: p.pack_label, unit: p.unit })),
    });
  }

  async function envoyer(sup, produits, channel) {
    const message = messageFor(sup, produits);
    if (channel === 'whatsapp' && sup && !sup.phone) return toast('Ajoute un numéro WhatsApp à ce fournisseur', 'err');
    if (channel === 'sms' && sup && !sup.phone) return toast('Ajoute un numéro de téléphone à ce fournisseur', 'err');
    if (channel === 'email' && sup && !sup.email) return toast('Ajoute un email à ce fournisseur', 'err');

    if (channel === 'copie') {
      const ok = await copyText(message);
      enregistrer(sup, produits, 'copie', message);
      toast(ok ? 'Message copié, commande enregistrée' : 'Copie impossible', ok ? 'ok' : 'err');
    } else {
      enregistrer(sup, produits, channel, message);
      const href = channel === 'whatsapp' ? whatsappLink(sup && sup.phone, message)
        : channel === 'sms' ? smsLink(sup && sup.phone, message)
          : mailtoLink(sup && sup.email, `Commande ${(resto && resto.name) || ''}`.trim(), message);
      openLink(href);
      toast('Commande enregistrée dans l’historique', 'ok');
    }
    draw();
  }

  /* ------------------------------------------------------- Lignes */

  function ligne(p, onChange) {
    const pack = Number(p.pack_size) > 0 ? Number(p.pack_size) : 1;
    const line = el('div', { class: 'inv-row' });
    const input = el('input', {
      type: 'text', inputmode: 'decimal', value: fmtNum(qtyOf(p)), 'aria-label': `Quantité de ${p.name}`,
    });
    const set = (v, fromInput) => {
      const n = Math.max(0, Math.round(v * 100) / 100);
      overrides[p.id] = n;
      if (!fromInput) input.value = fmtNum(n);
      onChange();
    };
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      const n = parseFloat(String(input.value).replace(',', '.'));
      set(Number.isNaN(n) ? 0 : n, true);
    });
    input.addEventListener('blur', () => { input.value = fmtNum(qtyOf(p)); if (qtyOf(p) <= 0) onChange(true); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });

    line.appendChild(el('div', { class: 'grow' }, [
      el('div', { class: 'name', text: p.name }),
      el('div', { class: 'meta', text: `${p.pack_label || p.unit} · stock ${fmtNum(p.current_stock)}/${fmtNum(p.target_stock)}` }),
    ]));
    line.appendChild(el('div', { class: 'stepper' }, [
      el('button', { type: 'button', 'aria-label': `Retirer ${pack}`, onClick: () => set(qtyOf(p) - pack) }, [icon('minus', 20)]),
      input,
      el('button', { type: 'button', 'aria-label': `Ajouter ${pack}`, onClick: () => set(qtyOf(p) + pack) }, [icon('plus', 20)]),
    ]));
    return line;
  }

  /* ------------------------------------------------------- Rendu */

  function draw() {
    body.textContent = '';
    const g = groups();

    if (!g.size) {
      body.appendChild(empty('checkCircle', 'Rien à commander',
        store.products().length
          ? 'Tous tes stocks sont au-dessus de la cible. Fais l’inventaire pour mettre à jour.'
          : 'Ajoute des produits puis fais ton inventaire.',
        el('button', { class: 'btn primary', type: 'button', onClick: () => ctx.navigate('#/inventaire') }, [icon('clipboard', 18), 'Faire l’inventaire'])));
      return;
    }

    /* Date de livraison souhaitée */
    const dateInput = el('input', { type: 'date', value: ctx.state.delivery, min: todayISO() });
    dateInput.addEventListener('change', () => { ctx.state.delivery = dateInput.value || addDaysISO(todayISO(), 1); });
    body.appendChild(el('div', { class: 'card card-pad', style: 'margin-bottom:14px' }, [
      field('Livraison souhaitée', dateInput),
    ]));

    for (const [key, produits] of g) {
      const sup = key === SANS ? null : store.supplier(key);
      const dejaEnvoyee = envoyees[key];

      if (dejaEnvoyee) {
        body.appendChild(el('div', { class: 'card sup-block card-pad' }, [
          el('div', { style: 'display:flex;gap:10px;align-items:center' }, [
            icon('checkCircle', 22),
            el('div', { class: 'grow', style: 'flex:1' }, [
              el('div', { class: 'name', text: sup ? sup.name : 'Sans fournisseur', style: 'font-weight:600' }),
              el('div', { class: 'meta', style: 'font-size:.8rem;color:var(--text-dim)', text: `Commande envoyée · ${plural(dejaEnvoyee.lignes, 'ligne', 'lignes')}` }),
            ]),
            el('span', { class: 'badge ok', text: 'Envoyée' }),
          ]),
          el('div', { class: 'btn-row', style: 'margin-top:12px' }, [
            el('button', { class: 'btn sm', type: 'button', onClick: () => ctx.navigate(`#/commande/${dejaEnvoyee.orderId}`) }, [icon('eye', 16), 'Voir la commande']),
            el('button', {
              class: 'btn sm ghost', type: 'button',
              onClick: () => { delete envoyees[key]; draw(); },
            }, [icon('rotate', 16), 'Préparer une nouvelle commande']),
          ]),
        ]));
        continue;
      }

      const block = el('div', { class: 'card sup-block' });
      const total = () => produits.reduce((n, p) => n + (qtyOf(p) > 0 ? 1 : 0), 0);

      const meta = el('div', { class: 'meta' });
      const refreshMeta = () => {
        meta.textContent = sup
          ? `${plural(total(), 'ligne', 'lignes')}${sup.order_days && sup.order_days.length ? ` · commandes ${sup.order_days.join(', ')}` : ''}`
          : `${plural(total(), 'ligne', 'lignes')} · aucun fournisseur associé`;
      };

      const onChange = (redraw) => { refreshMeta(); if (redraw) draw(); };

      block.appendChild(el('div', { class: 'sup-head' }, [
        el('div', { class: 'grow' }, [
          el('div', { class: 'name', text: sup ? sup.name : 'Sans fournisseur' }),
          meta,
        ]),
        sup ? el('button', {
          class: 'icon-btn plain', type: 'button', 'aria-label': 'Modifier le fournisseur',
          onClick: () => ctx.navigate(`#/fournisseurs?edit=${sup.id}`),
        }, [icon('pencil', 18)]) : null,
      ]));
      refreshMeta();

      for (const p of produits) block.appendChild(ligne(p, onChange));

      const apercu = el('button', {
        class: 'btn quiet sm', type: 'button', style: 'margin:6px 14px 0',
        onClick: () => sheet('Aperçu du message', () => frag([
          el('pre', {
            text: messageFor(sup, produits.filter((p) => qtyOf(p) > 0)),
            style: 'white-space:pre-wrap;font:inherit;font-size:.88rem;background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:12px;color:var(--text)',
          }),
        ])),
      }, [icon('eye', 16), 'Aperçu du message']);

      if (sup) {
        block.appendChild(el('div', { class: 'send-row' }, [
          el('button', { class: 'btn wa', type: 'button', onClick: () => envoyer(sup, produits.filter((p) => qtyOf(p) > 0), 'whatsapp') }, [icon('message', 18), 'WhatsApp']),
          el('button', { class: 'btn', type: 'button', onClick: () => envoyer(sup, produits.filter((p) => qtyOf(p) > 0), 'sms') }, [icon('phone', 18), 'SMS']),
          el('button', { class: 'btn', type: 'button', onClick: () => envoyer(sup, produits.filter((p) => qtyOf(p) > 0), 'email') }, [icon('mail', 18), 'Email']),
          el('button', { class: 'btn', type: 'button', onClick: () => envoyer(sup, produits.filter((p) => qtyOf(p) > 0), 'copie') }, [icon('copy', 18), 'Copier']),
        ]));
        block.appendChild(el('div', { style: 'padding:0 0 10px' }, [apercu]));
      } else {
        block.appendChild(el('div', { class: 'card-pad' }, [
          el('div', { class: 'notice', style: 'margin:0' }, [icon('info', 18), el('span', { text: 'Associe ces produits à un fournisseur pour pouvoir envoyer la commande.' })]),
          el('button', { class: 'btn full', type: 'button', style: 'margin-top:10px', onClick: () => ctx.navigate('#/produits') }, [icon('box', 18), 'Ouvrir les produits']),
        ]));
      }

      body.appendChild(block);
    }
  }

  wrap.appendChild(el('div', { class: 'topbar' }, [
    el('h1', {}, [el('span', { text: 'Commande' }), el('span', { class: 'sub', text: 'Proposée d’après ton inventaire' })]),
  ]));
  wrap.appendChild(segbar(ctx, 'proposition'));
  wrap.appendChild(body);
  draw();
  return wrap;
}
