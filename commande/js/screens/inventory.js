/* =====================================================================
   Inventaire — produits groupés par zone, stock modifiable − / +
   Orange = sous le stock cible, rouge = rupture.
   ===================================================================== */
import { el, frag, icon, empty, fmtNum, debounce } from '../ui.js';
import * as store from '../store.js';

export function render(ctx) {
  const all = store.products();
  let zoneFilter = ctx.state.invZone || 'Toutes';
  let query = '';

  const wrap = el('div', { class: 'screen has-cta' });
  const body = el('div');
  const ctaWrap = el('div', { class: 'cta-bar' });

  /* Compteur de la barre d'action, rafraîchi sans redessiner la liste */
  const cta = el('button', {
    class: 'btn primary big', type: 'button',
    onClick: () => ctx.navigate('#/commandes'),
  });
  const refreshCta = () => {
    const n = store.toOrder().length;
    cta.textContent = '';
    cta.appendChild(icon('send', 20));
    cta.appendChild(document.createTextNode(n ? `Voir la commande proposée (${n})` : 'Voir la commande proposée'));
    cta.disabled = n === 0;
  };

  const saveStock = debounce((id, value) => {
    store.put('products', { id, current_stock: value });
  }, 350);

  function row(p) {
    const line = el('div', { class: 'inv-row' });
    const stepper = el('div', { class: 'stepper' });
    const input = el('input', {
      type: 'text', inputmode: 'decimal', enterkeyhint: 'done',
      value: fmtNum(p.current_stock), 'aria-label': `Stock de ${p.name}`,
    });

    const paint = () => {
      const state = store.stockState(p);
      line.className = `inv-row ${state === 'rupture' ? 'danger' : state === 'bas' ? 'warn' : ''}`;
      stepper.className = `stepper ${state === 'rupture' ? 'danger' : state === 'bas' ? 'warn' : ''}`;
    };

    const setValue = (v, fromInput) => {
      const n = Math.max(0, Math.round(v * 100) / 100);
      p.current_stock = n;
      if (!fromInput) input.value = fmtNum(n);
      paint();
      refreshCta();
      saveStock(p.id, n);
    };

    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      const n = parseFloat(String(input.value).replace(',', '.'));
      if (!Number.isNaN(n)) setValue(n, true);
      else if (input.value.trim() === '') setValue(0, true);
    });
    input.addEventListener('blur', () => { input.value = fmtNum(p.current_stock); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });

    stepper.appendChild(el('button', {
      type: 'button', 'aria-label': 'Retirer 1',
      onClick: () => setValue(Number(p.current_stock || 0) - 1),
    }, [icon('minus', 20)]));
    stepper.appendChild(input);
    stepper.appendChild(el('button', {
      type: 'button', 'aria-label': 'Ajouter 1',
      onClick: () => setValue(Number(p.current_stock || 0) + 1),
    }, [icon('plus', 20)]));

    line.appendChild(el('div', { class: 'grow' }, [
      el('div', { class: 'name', text: p.name }),
      el('div', { class: 'meta', text: `cible ${fmtNum(p.target_stock)} ${p.unit}${p.pack_label ? ` · ${p.pack_label}` : ''}` }),
    ]));
    line.appendChild(stepper);
    paint();
    return line;
  }

  function drawList() {
    body.textContent = '';
    const q = query.trim().toLowerCase();
    const list = all.filter((p) =>
      (zoneFilter === 'Toutes' || p.zone === zoneFilter) &&
      (!q || p.name.toLowerCase().includes(q)));

    if (!all.length) {
      body.appendChild(empty('box', 'Aucun produit', 'Ajoute des produits ou charge un kit de départ depuis les réglages.',
        el('button', { class: 'btn primary', type: 'button', onClick: () => ctx.navigate('#/produits') }, [icon('plus', 18), 'Ajouter un produit'])));
      return;
    }
    if (!list.length) {
      body.appendChild(empty('search', 'Aucun résultat', 'Change de zone ou modifie ta recherche.'));
      return;
    }

    for (const zone of store.ZONES) {
      const inZone = list.filter((p) => p.zone === zone);
      if (!inZone.length) continue;
      const nb = inZone.filter((p) => store.suggestedQty(p) > 0).length;
      body.appendChild(el('div', { class: 'zone-head' }, [
        el('h2', { text: zone }),
        nb ? el('span', { class: 'badge warn', text: `${nb} à commander` }) : el('span', { class: 'badge ok', text: 'OK' }),
      ]));
      body.appendChild(el('div', { class: 'card' }, inZone.map(row)));
    }

    const autres = list.filter((p) => !store.ZONES.includes(p.zone));
    if (autres.length) {
      body.appendChild(el('div', { class: 'zone-head' }, [el('h2', { text: 'Autres' })]));
      body.appendChild(el('div', { class: 'card' }, autres.map(row)));
    }
  }

  /* --- En-tête --- */
  wrap.appendChild(el('div', { class: 'topbar' }, [
    el('h1', {}, [el('span', { text: 'Inventaire' }), el('span', { class: 'sub', text: `${all.length} produits` })]),
    el('button', {
      class: 'icon-btn', type: 'button', 'aria-label': 'Gérer les produits',
      onClick: () => ctx.navigate('#/produits'),
    }, [icon('pencil', 20)]),
  ]));

  const search = el('input', { type: 'search', placeholder: 'Rechercher un produit…', enterkeyhint: 'search' });
  search.addEventListener('input', () => { query = search.value; drawList(); });
  wrap.appendChild(el('div', { class: 'search' }, [icon('search', 18), search]));

  wrap.appendChild(el('div', { class: 'chips', style: 'margin-bottom:6px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px' },
    ['Toutes', ...store.ZONES].map((z) => el('button', {
      class: `chip sm ${zoneFilter === z ? 'on' : ''}`, type: 'button',
      onClick: (e) => {
        zoneFilter = z;
        ctx.state.invZone = z;
        wrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
        e.currentTarget.classList.add('on');
        drawList();
      },
    }, [z]))));

  wrap.appendChild(body);
  drawList();
  refreshCta();
  ctaWrap.appendChild(cta);
  wrap.appendChild(ctaWrap);
  return wrap;
}
