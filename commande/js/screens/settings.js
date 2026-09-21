/* =====================================================================
   Réglages — profil, thème, sauvegarde cloud, RGPD, mentions légales
   ===================================================================== */
import { el, frag, icon, sheet, toast, confirmSheet, field, plural, fmtDate } from '../ui.js';
import * as store from '../store.js';
import * as auth from '../auth.js';
import { isCloudConfigured, setCloudConfig, clearCloudConfig, cloudConfig } from '../cloud.js';
import { applyKit, kitFor } from '../seed.js';
import { setTheme, currentTheme } from '../theme.js';

const LEGAL = {
  mentions: [
    ['Éditeur', 'Commande Express est une application de démonstration fournie telle quelle, sans garantie. Le nom de l’éditeur, son adresse et son numéro de SIRET sont à compléter avant toute mise en production.'],
    ['Hébergement', 'L’application est un site statique ; les données de compte sont hébergées par Supabase (Union européenne si la région du projet le prévoit).'],
    ['Propriété', 'Les contenus saisis (produits, fournisseurs, commandes) restent la propriété de l’utilisateur.'],
    ['Contact', 'Renseigne ici l’adresse email de contact de ton établissement.'],
  ],
  confidentialite: [
    ['Données collectées', 'Adresse email et mot de passe (chiffré) pour le compte ; nom et type de l’établissement ; produits, fournisseurs et commandes que tu saisis.'],
    ['Finalité', 'Ces données servent uniquement à faire fonctionner l’inventaire et l’envoi des commandes. Aucune publicité, aucun traçage, aucune revente.'],
    ['Messages fournisseurs', 'Les commandes partent depuis WhatsApp, l’app SMS ou l’app email de ton téléphone : aucun message ne transite par un serveur tiers.'],
    ['Conservation', 'Les données sont conservées tant que le compte existe. La suppression du compte efface immédiatement et définitivement toutes les données associées.'],
    ['Tes droits', 'Accès, rectification, suppression : tout se fait depuis cet écran (RGPD, articles 15 à 17).'],
    ['Stockage local', 'Une copie des données est gardée sur l’appareil pour fonctionner hors connexion ; elle est effacée à la déconnexion.'],
  ],
};

function legalSheet(titre, sections) {
  sheet(titre, () => el('div', { class: 'legal' }, sections.map(([h, p]) => frag([
    el('h3', { text: h }), el('p', { text: p }),
  ]))));
}

function cloudSheet(onDone) {
  sheet('Sauvegarde cloud', (close) => {
    const cfg = cloudConfig() || { url: '', anonKey: '' };
    const url = el('input', { type: 'url', value: cfg.url, placeholder: 'https://xxxx.supabase.co', autocapitalize: 'off', spellcheck: 'false' });
    const key = el('textarea', { placeholder: 'Clé publique « anon »', style: 'min-height:90px', spellcheck: 'false' });
    key.value = cfg.anonKey;
    const err = el('div', { class: 'notice err hidden' }, [icon('alert', 18), el('span')]);
    return frag([
      el('div', { class: 'notice' }, [icon('info', 18), el('span', {
        html: 'Projet Supabase → <b>Project Settings → API</b>. Exécute d’abord <b>supabase/schema.sql</b> pour créer les tables et les règles de sécurité.',
      })]),
      err,
      field('URL du projet', url),
      field('Clé anon (publique)', key),
      el('div', { class: 'sheet-actions' }, [
        el('button', { class: 'btn ghost', type: 'button', onClick: close }, ['Annuler']),
        el('button', {
          class: 'btn primary', type: 'button',
          onClick: () => {
            try {
              setCloudConfig(url.value, key.value);
              close();
              toast('Cloud configuré — reconnecte-toi pour synchroniser', 'ok');
              onDone && onDone();
            } catch (e) {
              err.classList.remove('hidden');
              err.querySelector('span').textContent = e.message;
            }
          },
        }, ['Enregistrer']),
      ]),
    ]);
  });
}

function profilSheet(onSaved) {
  const r = store.restaurant();
  sheet('Mon établissement', (close) => {
    const iName = el('input', { type: 'text', value: (r && r.name) || '', autocapitalize: 'words' });
    const iAddr = el('input', { type: 'text', value: (r && r.address) || '', placeholder: 'Facultatif', autocapitalize: 'words' });
    const iKind = el('select', {}, store.TYPES_RESTO.map((t) =>
      el('option', { value: t.id, text: t.label, selected: r && r.kind === t.id })));
    return frag([
      field('Nom', iName),
      field('Type', iKind),
      field('Adresse', iAddr),
      el('div', { class: 'sheet-actions' }, [
        el('button', { class: 'btn ghost', type: 'button', onClick: close }, ['Annuler']),
        el('button', {
          class: 'btn primary', type: 'button',
          onClick: () => {
            if (!iName.value.trim()) return toast('Le nom est obligatoire', 'err');
            store.put('restaurants', { id: r ? r.id : undefined, name: iName.value.trim(), kind: iKind.value, address: iAddr.value.trim() || null });
            close();
            toast('Profil mis à jour', 'ok');
            onSaved();
          },
        }, ['Enregistrer']),
      ]),
    ]);
  });
}

const rowLink = (iconName, label, meta, onClick, trailing) =>
  el('button', { class: 'list-row', type: 'button', onClick }, [
    icon(iconName, 20),
    el('span', { class: 'grow' }, [
      el('span', { class: 'name', text: label }),
      meta ? el('span', { class: 'meta', text: meta }) : null,
    ]),
    trailing || icon('chevronRight', 18, 'chev'),
  ]);

export function render(ctx) {
  const session = auth.current();
  const r = store.restaurant();
  const wrap = el('div', { class: 'screen' });
  const refresh = () => ctx.refresh();

  wrap.appendChild(el('div', { class: 'topbar' }, [
    el('h1', {}, [el('span', { text: 'Réglages' }), el('span', { class: 'sub', text: (session && session.email) || '' })]),
  ]));

  /* --- Établissement & catalogue --- */
  wrap.appendChild(el('div', { class: 'section' }, [el('h2', { text: 'Établissement' })]));
  wrap.appendChild(el('div', { class: 'list' }, [
    rowLink('store', (r && r.name) || 'Mon établissement',
      r ? (store.TYPES_RESTO.find((t) => t.id === r.kind) || {}).label : null,
      () => profilSheet(refresh)),
    rowLink('box', 'Produits', plural(store.products().length, 'produit', 'produits'), () => ctx.navigate('#/produits')),
    rowLink('users', 'Fournisseurs', plural(store.suppliers().length, 'fournisseur', 'fournisseurs'), () => ctx.navigate('#/fournisseurs')),
    rowLink('clock', 'Historique des commandes', plural(store.orders().length, 'commande', 'commandes'), () => ctx.navigate('#/historique')),
  ]));

  if (!store.products().length && r) {
    wrap.appendChild(el('button', {
      class: 'btn full', type: 'button', style: 'margin-top:10px',
      onClick: async () => {
        const kit = kitFor(r.kind);
        if (await confirmSheet('Charger le kit de départ', `${kit.label} : ${kit.desc}`, { okLabel: 'Charger' })) {
          const res = applyKit(r.kind);
          toast(`${res.products} produits chargés`, 'ok');
          refresh();
        }
      },
    }, [icon('download', 18), 'Charger un kit de départ']));
  }

  /* --- Apparence --- */
  wrap.appendChild(el('div', { class: 'section' }, [el('h2', { text: 'Apparence' })]));
  const theme = currentTheme();
  wrap.appendChild(el('div', { class: 'card card-pad' }, [
    el('div', { class: 'chips' }, [
      ['dark', 'Sombre', 'moon'], ['light', 'Clair', 'sun'], ['auto', 'Système', 'settings'],
    ].map(([v, label, ic]) => el('button', {
      class: `chip ${theme === v ? 'on' : ''}`, type: 'button',
      onClick: () => { setTheme(v); refresh(); },
    }, [icon(ic, 16), label]))),
  ]));

  /* --- Sauvegarde --- */
  const cloudOn = isCloudConfigured();
  const cloudMode = session && session.mode === 'cloud';
  wrap.appendChild(el('div', { class: 'section' }, [el('h2', { text: 'Sauvegarde' })]));

  const enAttente = store.pendingCount();
  wrap.appendChild(el('div', { class: 'list' }, [
    rowLink(cloudMode ? 'cloud' : 'cloudOff',
      cloudMode ? 'Sauvegarde cloud active' : 'Mode local (cet appareil)',
      cloudMode
        ? (store.syncedAt() ? `Dernière synchro : ${new Date(store.syncedAt()).toLocaleString('fr-FR')}` : 'Jamais synchronisé')
        : (cloudOn ? 'Cloud configuré : déconnecte-toi pour créer un compte' : 'Aucune donnée ne quitte le téléphone'),
      () => cloudSheet(refresh),
      el('span', { class: `badge ${cloudMode ? 'ok' : 'warn'}`, text: cloudMode ? 'Actif' : 'Local' })),
    cloudMode ? rowLink('refresh', 'Synchroniser maintenant',
      enAttente ? `${plural(enAttente, 'modification en attente', 'modifications en attente')}` : 'Tout est à jour',
      async () => {
        toast('Synchronisation…');
        try {
          await store.sync({ silent: false });
          toast('Synchronisé', 'ok');
        } catch (e) { toast(e.message, 'err'); }
        refresh();
      }, el('span', { class: `badge ${enAttente ? 'warn' : 'ok'}`, text: enAttente ? String(enAttente) : 'OK' })) : null,
  ].filter(Boolean)));

  /* --- Légal --- */
  wrap.appendChild(el('div', { class: 'section' }, [el('h2', { text: 'Informations légales' })]));
  wrap.appendChild(el('div', { class: 'list' }, [
    rowLink('file', 'Mentions légales', null, () => legalSheet('Mentions légales', LEGAL.mentions)),
    rowLink('shield', 'Politique de confidentialité', 'RGPD', () => legalSheet('Politique de confidentialité', LEGAL.confidentialite)),
  ]));

  /* --- Compte --- */
  wrap.appendChild(el('div', { class: 'section' }, [el('h2', { text: 'Compte' })]));
  wrap.appendChild(el('div', { class: 'list' }, [
    cloudMode ? rowLink('key', 'Changer de mot de passe', null, () => {
      sheet('Nouveau mot de passe', (close) => {
        const p1 = el('input', { type: 'password', autocomplete: 'new-password', placeholder: '6 caractères minimum' });
        return frag([
          field('Mot de passe', p1),
          el('div', { class: 'sheet-actions' }, [
            el('button', { class: 'btn ghost', type: 'button', onClick: close }, ['Annuler']),
            el('button', {
              class: 'btn primary', type: 'button',
              onClick: async () => {
                if (p1.value.length < 6) return toast('6 caractères minimum', 'err');
                try { await auth.updatePassword(p1.value); close(); toast('Mot de passe modifié', 'ok'); }
                catch (e) { toast(e.message, 'err'); }
              },
            }, ['Enregistrer']),
          ]),
        ]);
      });
    }) : null,
    rowLink('logout', 'Se déconnecter', null, async () => {
      if (enAttente && cloudMode) {
        const ok = await confirmSheet('Modifications en attente',
          `${plural(enAttente, 'modification n’est pas encore synchronisée', 'modifications ne sont pas encore synchronisées')}. Se déconnecter quand même ?`,
          { danger: true, okLabel: 'Se déconnecter' });
        if (!ok) return;
      }
      store.wipeLocal();
      store.close();
      await auth.signOut();
      location.hash = '#/';
      ctx.refresh();
    }, el('span')),
  ].filter(Boolean)));

  wrap.appendChild(el('button', {
    class: 'btn danger full', type: 'button', style: 'margin-top:14px',
    onClick: async () => {
      const ok = await confirmSheet('Supprimer mon compte',
        'Le compte et toutes les données (produits, fournisseurs, commandes) seront définitivement effacés. Cette action est irréversible.',
        { danger: true, okLabel: 'Tout supprimer' });
      if (!ok) return;
      try {
        store.wipeLocal();
        store.close();
        await auth.deleteAccount();
        toast('Compte supprimé');
        location.hash = '#/';
        ctx.refresh();
      } catch (e) { toast(e.message, 'err'); }
    },
  }, [icon('trash', 18), 'Supprimer mon compte et mes données']));

  wrap.appendChild(el('div', {
    style: 'text-align:center;margin-top:22px;font-size:.76rem;color:var(--text-faint)',
    text: `Commande Express · ${fmtDate(new Date().toISOString().slice(0, 10))}`,
  }));

  return wrap;
}
