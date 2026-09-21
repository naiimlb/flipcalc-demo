/* =====================================================================
   Produits — liste, recherche, ajout, modification, suppression
   ===================================================================== */
import { el, frag, icon, empty, sheet, toast, confirmSheet, field, fmtNum, plural } from '../ui.js';
import * as store from '../store.js';

function formSheet(p, onSaved) {
  const nouveau = !p;
  const v = p || { name: '', zone: 'Frigo', unit: 'pièce', pack_size: 1, pack_label: '', supplier_id: null, target_stock: 0, current_stock: 0 };

  sheet(nouveau ? 'Nouveau produit' : 'Modifier le produit', (close) => {
    const iName = el('input', { type: 'text', value: v.name, placeholder: 'Ex. Pain burger sésame', autocapitalize: 'sentences' });
    const iZone = el('select', {}, store.ZONES.map((z) => el('option', { value: z, text: z, selected: v.zone === z })));
    const iUnit = el('input', { type: 'text', value: v.unit || '', placeholder: 'pièce, kg, bidon…' });
    const iPack = el('input', { type: 'text', inputmode: 'decimal', value: fmtNum(v.pack_size || 1) });
    const iLabel = el('input', { type: 'text', value: v.pack_label || '', placeholder: 'carton de 48' });
    const iTarget = el('input', { type: 'text', inputmode: 'decimal', value: fmtNum(v.target_stock || 0) });
    const iCurrent = el('input', { type: 'text', inputmode: 'decimal', value: fmtNum(v.current_stock || 0) });
    const iSup = el('select', {}, [
      el('option', { value: '', text: '— Aucun —', selected: !v.supplier_id }),
      ...store.suppliers().map((s) => el('option', { value: s.id, text: s.name, selected: v.supplier_id === s.id })),
    ]);

    const num = (input) => {
      const n = parseFloat(String(input.value).replace(',', '.'));
      return Number.isNaN(n) ? 0 : Math.max(0, n);
    };

    return frag([
      field('Nom', iName),
      el('div', { class: 'row-2' }, [field('Zone', iZone), field('Unité', iUnit)]),
      el('div', { class: 'row-2' }, [
        field('Conditionnement', iPack, 'Quantité par colis'),
        field('Libellé', iLabel, 'Affiché dans le message'),
      ]),
      field('Fournisseur', iSup),
      el('div', { class: 'row-2' }, [field('Stock cible', iTarget), field('Stock actuel', iCurrent)]),
      el('div', { class: 'sheet-actions' }, [
        el('button', { class: 'btn ghost', type: 'button', onClick: close }, ['Annuler']),
        el('button', {
          class: 'btn primary', type: 'button',
          onClick: () => {
            if (!iName.value.trim()) return toast('Le nom est obligatoire', 'err');
            const pack = num(iPack) || 1;
            store.put('products', {
              id: p ? p.id : undefined,
              name: iName.value.trim(),
              zone: iZone.value,
              unit: iUnit.value.trim() || 'pièce',
              pack_size: pack,
              pack_label: iLabel.value.trim() || (pack > 1 ? `lot de ${fmtNum(pack)}` : null),
              supplier_id: iSup.value || null,
              target_stock: num(iTarget),
              current_stock: num(iCurrent),
              sort_index: p ? p.sort_index : store.products().length,
            });
            close();
            toast(nouveau ? 'Produit ajouté' : 'Produit modifié', 'ok');
            onSaved();
          },
        }, ['Enregistrer']),
      ]),
      !nouveau ? el('button', {
        class: 'btn danger full', type: 'button', style: 'margin-top:12px',
        onClick: async () => {
          if (await confirmSheet('Supprimer le produit', `« ${v.name} » sera retiré du catalogue.`, { danger: true, okLabel: 'Supprimer' })) {
            store.remove('products', p.id);
            close();
            toast('Produit supprimé');
            onSaved();
          }
        },
      }, [icon('trash', 18), 'Supprimer']) : null,
    ]);
  });
}

export function render(ctx) {
  let query = '';
  let zone = 'Toutes';
  const wrap = el('div', { class: 'screen' });
  const body = el('div');
  const refresh = () => { ctx.refresh(); };

  const all = store.products();

  wrap.appendChild(el('div', { class: 'topbar' }, [
    el('button', { class: 'icon-btn plain', type: 'button', 'aria-label': 'Retour', onClick: () => ctx.navigate('#/') }, [icon('arrowLeft', 22)]),
    el('h1', {}, [el('span', { text: 'Produits' }), el('span', { class: 'sub', text: plural(all.length, 'produit', 'produits') })]),
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Ajouter un produit', onClick: () => formSheet(null, refresh) }, [icon('plus', 22)]),
  ]));

  const search = el('input', { type: 'search', placeholder: 'Rechercher…', enterkeyhint: 'search' });
  search.addEventListener('input', () => { query = search.value; draw(); });
  wrap.appendChild(el('div', { class: 'search' }, [icon('search', 18), search]));

  wrap.appendChild(el('div', { class: 'chips', style: 'margin-bottom:10px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px' },
    ['Toutes', ...store.ZONES].map((z) => el('button', {
      class: `chip sm ${zone === z ? 'on' : ''}`, type: 'button',
      onClick: (e) => {
        zone = z;
        wrap.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
        e.currentTarget.classList.add('on');
        draw();
      },
    }, [z]))));

  function draw() {
    body.textContent = '';
    const q = query.trim().toLowerCase();
    const list = all.filter((p) => (zone === 'Toutes' || p.zone === zone) && (!q || p.name.toLowerCase().includes(q)));

    if (!all.length) {
      body.appendChild(empty('box', 'Catalogue vide', 'Ajoute ton premier produit ou charge un kit depuis les réglages.',
        el('button', { class: 'btn primary', type: 'button', onClick: () => formSheet(null, refresh) }, [icon('plus', 18), 'Ajouter un produit'])));
      return;
    }
    if (!list.length) { body.appendChild(empty('search', 'Aucun résultat', 'Essaie un autre mot ou une autre zone.')); return; }

    const zones = zone === 'Toutes' ? store.ZONES : [zone];
    for (const z of zones) {
      const inZone = list.filter((p) => p.zone === z);
      if (!inZone.length) continue;
      body.appendChild(el('div', { class: 'zone-head' }, [el('h2', { text: z }), el('span', { class: 'badge', text: String(inZone.length) })]));
      body.appendChild(el('div', { class: 'list' }, inZone.map((p) => {
        const sup = p.supplier_id ? store.supplier(p.supplier_id) : null;
        return el('button', { class: 'list-row', type: 'button', onClick: () => formSheet(p, refresh) }, [
          el('span', { class: 'grow' }, [
            el('span', { class: 'name', text: p.name }),
            el('span', { class: 'meta', text: `${sup ? sup.name : 'sans fournisseur'} · cible ${fmtNum(p.target_stock)} ${p.unit}` }),
          ]),
          el('span', { class: 'badge', text: p.pack_label || `× ${fmtNum(p.pack_size)}` }),
          icon('chevronRight', 18, 'chev'),
        ]);
      })));
    }
  }

  wrap.appendChild(body);
  draw();
  wrap.appendChild(el('button', {
    class: 'btn full', type: 'button', style: 'margin-top:16px',
    onClick: () => formSheet(null, refresh),
  }, [icon('plus', 18), 'Ajouter un produit']));
  return wrap;
}
