/* =====================================================================
   Écran de connexion / inscription (étape 1 de l'onboarding)
   ===================================================================== */
import { el, frag, icon, field, sheet, toast } from '../ui.js';
import * as auth from '../auth.js';
import { isCloudConfigured, setCloudConfig, cloudConfig } from '../cloud.js';

function logo() {
  return el('div', { class: 'brand' }, [
    el('div', { class: 'mark' }, [icon('clipboard', 28)]),
    el('h1', { text: 'Commande Express' }),
    el('p', { text: 'Compte ton stock, envoie ta commande fournisseur en 2 minutes.' }),
  ]);
}

function cloudSheet(onDone) {
  sheet('Sauvegarde cloud', (close) => {
    const cfg = cloudConfig() || { url: '', anonKey: '' };
    const url = el('input', { type: 'url', value: cfg.url, placeholder: 'https://xxxx.supabase.co', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
    const key = el('textarea', { placeholder: 'Clé publique « anon »', style: 'min-height:90px', autocapitalize: 'off', spellcheck: 'false' });
    key.value = cfg.anonKey;
    const err = el('div', { class: 'notice err hidden' }, [icon('alert', 18), el('span')]);
    return frag([
      el('div', { class: 'notice' }, [icon('info', 18), el('span', {
        html: 'Crée un projet gratuit sur <b>supabase.com</b>, exécute le fichier <b>supabase/schema.sql</b>, puis colle ici l’URL et la clé « anon » (Project Settings → API).',
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
              toast('Cloud configuré', 'ok');
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

export function render(ctx) {
  const cloudOn = isCloudConfigured();
  let tab = 'connexion';

  const wrap = el('div', { class: 'auth' });

  const draw = () => {
    wrap.textContent = '';
    wrap.appendChild(logo());

    const notice = el('div', { class: 'notice err hidden' }, [icon('alert', 18), el('span')]);
    const okNote = el('div', { class: 'notice ok hidden' }, [icon('checkCircle', 18), el('span')]);
    const fail = (m) => { notice.classList.remove('hidden'); notice.querySelector('span').textContent = m; };
    const info = (m) => { okNote.classList.remove('hidden'); okNote.querySelector('span').textContent = m; };

    const email = el('input', { type: 'email', inputmode: 'email', autocomplete: 'email', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', placeholder: 'ton@email.fr' });
    const pass = el('input', { type: 'password', autocomplete: tab === 'connexion' ? 'current-password' : 'new-password', placeholder: '••••••••' });

    const submit = el('button', { class: 'btn primary big full', type: 'submit' },
      [tab === 'connexion' ? 'Se connecter' : 'Créer mon compte']);

    const form = el('form', {
      onSubmit: async (e) => {
        e.preventDefault();
        notice.classList.add('hidden'); okNote.classList.add('hidden');
        if (!email.value.trim() || pass.value.length < 6) {
          return fail('Email et mot de passe (6 caractères minimum) requis.');
        }
        submit.disabled = true;
        submit.textContent = '';
        submit.appendChild(el('span', { class: 'spinner' }));
        try {
          if (tab === 'connexion') {
            await auth.signIn(email.value, pass.value);
          } else {
            const r = await auth.signUp(email.value, pass.value);
            if (r.needsConfirm) {
              info('Compte créé. Ouvre le lien de confirmation envoyé par email, puis connecte-toi.');
              tab = 'connexion';
              submit.disabled = false;
              return draw();
            }
          }
          ctx.refresh();
        } catch (e2) {
          fail(e2.message);
          submit.disabled = false;
          submit.textContent = tab === 'connexion' ? 'Se connecter' : 'Créer mon compte';
        }
      },
    }, [
      notice, okNote,
      field('Email', email),
      field('Mot de passe', pass),
      submit,
    ]);

    const seg = el('div', { class: 'seg' }, [
      el('button', { class: tab === 'connexion' ? 'on' : '', type: 'button', onClick: () => { tab = 'connexion'; draw(); } }, ['Connexion']),
      el('button', { class: tab === 'inscription' ? 'on' : '', type: 'button', onClick: () => { tab = 'inscription'; draw(); } }, ['Inscription']),
    ]);

    const card = el('div', { class: 'card card-pad' }, [seg, form]);

    if (!cloudOn) {
      card.textContent = '';
      card.appendChild(el('div', { class: 'notice' }, [icon('cloudOff', 18), el('span', {
        html: 'Aucune sauvegarde cloud configurée. Tu peux <b>démarrer tout de suite en mode local</b> (données gardées sur cet appareil) ou brancher ton projet Supabase pour retrouver tes données sur un autre téléphone.',
      })]));
      card.appendChild(el('button', {
        class: 'btn primary big full', type: 'button',
        onClick: () => { auth.startLocal(); ctx.refresh(); },
      }, [icon('clipboard', 20), 'Démarrer en mode local']));
      card.appendChild(el('button', {
        class: 'btn ghost full', type: 'button', style: 'margin-top:10px',
        onClick: () => cloudSheet(() => ctx.refresh()),
      }, [icon('cloud', 20), 'Configurer la sauvegarde cloud']));
    }

    wrap.appendChild(card);

    if (cloudOn) {
      wrap.appendChild(el('div', { class: 'switch' }, [
        el('button', {
          class: 'btn quiet sm', type: 'button',
          onClick: () => {
            const mail = el('input', { type: 'email', inputmode: 'email', placeholder: 'ton@email.fr', value: email.value });
            sheet('Mot de passe oublié', (close) => frag([
              el('p', { text: 'On t’envoie un lien pour choisir un nouveau mot de passe.', style: 'color:var(--text-dim);font-size:.9rem;margin-bottom:14px' }),
              field('Email', mail),
              el('div', { class: 'sheet-actions' }, [
                el('button', { class: 'btn ghost', type: 'button', onClick: close }, ['Annuler']),
                el('button', {
                  class: 'btn primary', type: 'button',
                  onClick: async () => {
                    try {
                      await auth.resetPassword(mail.value);
                      close();
                      toast('Email envoyé', 'ok');
                    } catch (e) { toast(e.message, 'err'); }
                  },
                }, ['Envoyer le lien']),
              ]),
            ]));
          },
        }, ['Mot de passe oublié ?']),
      ]));
      wrap.appendChild(el('div', { class: 'switch', style: 'margin-top:4px' }, [
        el('button', { class: 'btn quiet sm', type: 'button', onClick: () => cloudSheet(() => ctx.refresh()) }, ['Changer de projet cloud']),
      ]));
    }
  };

  draw();
  return wrap;
}
