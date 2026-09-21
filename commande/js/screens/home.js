/* =====================================================================
   Accueil — action principale, produits sous le seuil, dernières commandes
   ===================================================================== */
import { el, frag, icon, empty, fmtRelative, fmtNum, plural } from '../ui.js';
import * as store from '../store.js';

const ETAT_BADGE = {
  rupture: ['danger', 'Rupture'],
  bas: ['warn', 'À commander'],
  ok: ['ok', 'OK'],
};

export function render(ctx) {
  const resto = store.restaurant();
  const prods = store.products();
  const besoins = store.toOrder();
  const ruptures = prods.filter((p) => store.stockState(p) === 'rupture');
  const cmds = store.orders().slice(0, 3);

  const wrap = el('div', { class: 'screen' });

  wrap.appendChild(el('div', { class: 'topbar' }, [
    el('div', { class: 'logo' }, [
      el('span', { class: 'mark' }, [icon('clipboard', 19)]),
      el('span', { class: 'txt' }, [
        el('span', { text: (resto && resto.name) || 'Commande Express', style: 'display:block' }),
        el('span', { class: 'sub', text: 'Commande Express' }),
      ]),
    ]),
  ]));

  wrap.appendChild(el('button', {
    class: 'btn primary big full', type: 'button',
    onClick: () => ctx.navigate('#/inventaire'),
  }, [icon('clipboard', 22), 'Faire l’inventaire']));

  wrap.appendChild(el('div', { class: 'section' }, [el('h2', { text: 'État du stock' })]));
  wrap.appendChild(el('div', { class: 'stats' }, [
    el('div', { class: 'stat' }, [el('b', { class: 'num', text: String(prods.length) }), el('span', { text: 'produits' })]),
    el('div', { class: `stat ${besoins.length ? 'warn' : ''}` }, [el('b', { class: 'num', text: String(besoins.length) }), el('span', { text: 'à commander' })]),
    el('div', { class: `stat ${ruptures.length ? 'danger' : ''}` }, [el('b', { class: 'num', text: String(ruptures.length) }), el('span', { text: 'ruptures' })]),
  ]));

  /* --- Sous le seuil --- */
  wrap.appendChild(el('div', { class: 'section' }, [
    el('h2', { text: 'Sous le stock cible' }),
    besoins.length > 5 ? el('button', {
      class: 'btn quiet sm', type: 'button', onClick: () => ctx.navigate('#/inventaire'),
    }, ['Tout voir']) : null,
  ]));

  if (!prods.length) {
    wrap.appendChild(empty('box', 'Catalogue vide', 'Ajoute tes produits pour démarrer ton premier inventaire.',
      el('button', { class: 'btn primary', type: 'button', onClick: () => ctx.navigate('#/produits') }, [icon('plus', 18), 'Ajouter un produit'])));
  } else if (!besoins.length) {
    wrap.appendChild(el('div', { class: 'card card-pad' }, [
      el('div', { style: 'display:flex;gap:10px;align-items:center' }, [
        icon('checkCircle', 22), el('div', {}, [
          el('div', { text: 'Tout est au niveau.', style: 'font-weight:600' }),
          el('div', { class: 'meta', text: 'Aucun produit sous le stock cible.', style: 'font-size:.82rem;color:var(--text-dim)' }),
        ]),
      ]),
    ]));
  } else {
    wrap.appendChild(el('div', { class: 'list' }, besoins.slice(0, 5).map((p) => {
      const state = store.stockState(p);
      const [cls, label] = ETAT_BADGE[state];
      return el('button', {
        class: 'list-row', type: 'button', onClick: () => ctx.navigate('#/inventaire'),
      }, [
        el('span', { class: `dot ${cls === 'ok' ? '' : cls}` }),
        el('span', { class: 'grow' }, [
          el('span', { class: 'name', text: p.name }),
          el('span', { class: 'meta', text: `${p.zone} · ${fmtNum(p.current_stock)}/${fmtNum(p.target_stock)} ${p.unit}` }),
        ]),
        el('span', { class: `badge ${cls}`, text: label }),
      ]);
    })));
  }

  if (besoins.length) {
    wrap.appendChild(el('button', {
      class: 'btn full', type: 'button', style: 'margin-top:10px',
      onClick: () => ctx.navigate('#/commandes'),
    }, [icon('send', 18), `Voir la commande proposée (${besoins.length})`]));
  }

  /* --- Dernières commandes --- */
  wrap.appendChild(el('div', { class: 'section' }, [
    el('h2', { text: 'Dernières commandes' }),
    cmds.length ? el('button', { class: 'btn quiet sm', type: 'button', onClick: () => ctx.navigate('#/historique') }, ['Historique']) : null,
  ]));

  if (!cmds.length) {
    wrap.appendChild(el('div', { class: 'card card-pad', style: 'color:var(--text-dim);font-size:.88rem' }, [
      'Aucune commande pour l’instant. Fais ton inventaire, la commande se prépare toute seule.',
    ]));
  } else {
    wrap.appendChild(el('div', { class: 'list' }, cmds.map((o) => {
      const lines = store.orderLines(o.id);
      const badge = o.status === 'recue' ? ['ok', 'Reçue'] : o.status === 'envoyee' ? ['accent', 'Envoyée'] : ['', 'Brouillon'];
      return el('button', {
        class: 'list-row', type: 'button', onClick: () => ctx.navigate(`#/commande/${o.id}`),
      }, [
        el('span', { class: 'grow' }, [
          el('span', { class: 'name', text: o.supplier_name || 'Fournisseur' }),
          el('span', { class: 'meta', text: `${fmtRelative(o.ordered_at)} · ${plural(lines.length, 'ligne', 'lignes')}` }),
        ]),
        el('span', { class: `badge ${badge[0]}`, text: badge[1] }),
        icon('chevronRight', 18, 'chev'),
      ]);
    })));
  }

  /* --- Raccourcis catalogue --- */
  wrap.appendChild(el('div', { class: 'section' }, [el('h2', { text: 'Catalogue' })]));
  wrap.appendChild(el('div', { class: 'list' }, [
    el('button', { class: 'list-row', type: 'button', onClick: () => ctx.navigate('#/produits') }, [
      icon('box', 20), el('span', { class: 'grow' }, [
        el('span', { class: 'name', text: 'Produits' }),
        el('span', { class: 'meta', text: plural(prods.length, 'produit', 'produits') }),
      ]), icon('chevronRight', 18, 'chev'),
    ]),
    el('button', { class: 'list-row', type: 'button', onClick: () => ctx.navigate('#/fournisseurs') }, [
      icon('users', 20), el('span', { class: 'grow' }, [
        el('span', { class: 'name', text: 'Fournisseurs' }),
        el('span', { class: 'meta', text: plural(store.suppliers().length, 'fournisseur', 'fournisseurs') }),
      ]), icon('chevronRight', 18, 'chev'),
    ]),
  ]));

  return wrap;
}
