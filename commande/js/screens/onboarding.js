/* =====================================================================
   Onboarding — étape 2 (restaurant) puis étape 3 (kit de départ)
   L'étape 1 (création du compte) vient de l'écran de connexion.
   ===================================================================== */
import { el, frag, icon, field, toast } from '../ui.js';
import * as store from '../store.js';
import { kitList, applyKit } from '../seed.js';

export function render(ctx) {
  let step = 2;
  let name = '';
  let kind = 'fast-food';
  let address = '';
  let kit = 'kit';

  const wrap = el('div', { class: 'screen no-tabs' });

  const steps = () => el('div', { class: 'steps' }, [
    el('i', { class: 'on' }), el('i', { class: step >= 2 ? 'on' : '' }), el('i', { class: step >= 3 ? 'on' : '' }),
  ]);

  const draw = () => {
    wrap.textContent = '';
    wrap.appendChild(steps());

    if (step === 2) {
      const iName = el('input', { type: 'text', value: name, placeholder: 'Ex. Burger du Coin', autocapitalize: 'words', maxlength: '60' });
      const iAddr = el('input', { type: 'text', value: address, placeholder: '12 rue des Halles, Lyon', autocapitalize: 'words' });
      const chips = el('div', { class: 'chips' }, store.TYPES_RESTO.map((t) =>
        el('button', {
          class: `chip ${kind === t.id ? 'on' : ''}`, type: 'button',
          onClick: () => { kind = t.id; name = iName.value; address = iAddr.value; draw(); },
        }, [t.label])));

      const next = el('button', {
        class: 'btn primary big full', type: 'submit',
      }, ['Continuer', icon('chevronRight', 20)]);

      wrap.appendChild(el('form', {
        onSubmit: (e) => {
          e.preventDefault();
          if (!iName.value.trim()) return toast('Donne un nom à ton établissement', 'err');
          name = iName.value.trim();
          address = iAddr.value.trim();
          step = 3;
          draw();
        },
      }, [
        el('h1', { text: 'Ton établissement', style: 'margin-bottom:6px' }),
        el('p', { text: 'Ce nom apparaîtra dans les messages envoyés à tes fournisseurs.', style: 'color:var(--text-dim);font-size:.9rem;margin-bottom:20px' }),
        field('Nom', iName),
        el('div', { class: 'field' }, [el('label', { text: 'Type' }), chips]),
        field('Adresse (facultatif)', iAddr),
        next,
      ]));
      return;
    }

    /* Étape 3 : kit de départ */
    const kits = kitList();
    const chosen = kits.find((k) => k.id === kind) || kits[0];

    const options = el('div', {}, [
      el('button', {
        class: `kit ${kit === 'kit' ? 'on' : ''}`, type: 'button',
        onClick: () => { kit = 'kit'; draw(); },
      }, [
        el('div', { class: 'ic' }, [icon('box', 20)]),
        el('div', { class: 'grow' }, [
          el('div', { class: 'name', text: chosen.label }),
          el('div', { class: 'meta', text: chosen.desc }),
        ]),
      ]),
      el('button', {
        class: `kit ${kit === 'vide' ? 'on' : ''}`, type: 'button',
        onClick: () => { kit = 'vide'; draw(); },
      }, [
        el('div', { class: 'ic' }, [icon('file', 20)]),
        el('div', { class: 'grow' }, [
          el('div', { class: 'name', text: 'Catalogue vide' }),
          el('div', { class: 'meta', text: 'Je saisis mes produits et fournisseurs moi-même.' }),
        ]),
      ]),
    ]);

    const go = el('button', { class: 'btn primary big full', type: 'button' }, ['Terminer', icon('check', 20)]);
    go.addEventListener('click', () => {
      go.disabled = true;
      store.put('restaurants', { name, kind, address: address || null });
      if (kit === 'kit') {
        const r = applyKit(kind);
        toast(`${r.products} produits et ${r.suppliers} fournisseurs chargés`, 'ok');
      }
      store.scheduleSync(200);
      location.hash = '#/';
      ctx.refresh();
    });

    wrap.appendChild(frag([
      el('h1', { text: 'Ton catalogue', style: 'margin-bottom:6px' }),
      el('p', { text: 'Pars d’une base toute prête (modifiable) ou d’une page blanche.', style: 'color:var(--text-dim);font-size:.9rem;margin-bottom:20px' }),
      options,
      el('div', { style: 'height:20px' }),
      go,
      el('button', {
        class: 'btn quiet full', type: 'button', style: 'margin-top:8px',
        onClick: () => { step = 2; draw(); },
      }, [icon('arrowLeft', 18), 'Retour']),
    ]));
  };

  draw();
  return wrap;
}
