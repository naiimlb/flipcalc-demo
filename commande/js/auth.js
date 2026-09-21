/* =====================================================================
   auth.js — comptes : cloud (Supabase Auth) ou local (cet appareil)
   ===================================================================== */
import { client, isCloudConfigured, traduireErreur } from './cloud.js';

const LS_LOCAL = 'ce:local-user';
const listeners = new Set();

let session = null;      // { id, email, mode: 'cloud' | 'local' }
let pret = false;        // vrai une fois la session restaurée
let recovery = false;    // arrivée par un lien « mot de passe oublié »
let messageURL = null;   // message à afficher après un retour de lien email

const recoveryListeners = new Set();

/** Prévient quand l'utilisateur arrive par un lien de réinitialisation. */
export function onRecovery(fn) {
  recoveryListeners.add(fn);
  if (recovery) fn();
  return () => recoveryListeners.delete(fn);
}

/** Message issu du lien email (confirmation réussie, lien expiré…). */
export function prendreMessageURL() {
  const m = messageURL;
  messageURL = null;
  return m;
}

/**
 * Supabase renvoie sur le site avec les jetons dans l'URL
 * (#access_token=…&type=recovery ou ?code=…). Une fois la session établie,
 * on nettoie l'adresse pour ne pas perturber le routeur par ancres.
 */
function nettoyerURLAuth() {
  const h = location.hash || '';
  const q = location.search || '';
  const aJeton = /access_token=|refresh_token=|type=(recovery|signup|magiclink|invite)|error_code=|error_description=/.test(h)
    || /[?&](code|error|error_description)=/.test(q);
  if (!aJeton) return;

  const params = new URLSearchParams(h.replace(/^#\/?/, '') + '&' + q.replace(/^\?/, ''));
  const erreur = params.get('error_description') || params.get('error');
  const type = params.get('type');
  if (erreur) {
    messageURL = { texte: decodeURIComponent(String(erreur).replace(/\+/g, ' ')), kind: 'err' };
  } else if (type === 'signup') {
    messageURL = { texte: 'Email confirmé, bienvenue !', kind: 'ok' };
  } else if (type === 'recovery') {
    recovery = true;
  }
  try { history.replaceState(null, '', location.pathname + '#/'); } catch { location.hash = '#/'; }
}

const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    }));

function emit() { for (const fn of listeners) fn(session); }
export function onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export const current = () => session;

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_LOCAL);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Restaure la session au démarrage (et traite un éventuel retour de lien email). */
export async function restore() {
  const sb = await client();
  if (sb) {
    sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        recovery = true;
        for (const fn of [...recoveryListeners]) fn();
        return;
      }
      if (event === 'SIGNED_OUT' || !s) {
        if (session && session.mode === 'cloud') { session = null; if (pret) emit(); }
        return;
      }
      if (s.user && (!session || session.id !== s.user.id)) {
        session = { id: s.user.id, email: s.user.email, mode: 'cloud' };
        if (pret) emit();
      }
    });

    /* getSession() attend le traitement des jetons présents dans l'URL. */
    const { data } = await sb.auth.getSession();
    nettoyerURLAuth();

    if (data && data.session) {
      const u = data.session.user;
      session = { id: u.id, email: u.email, mode: 'cloud' };
      pret = true;
      emit();
      return session;
    }
  }
  pret = true;
  const local = readLocal();
  if (local) { session = { ...local, mode: 'local' }; emit(); return session; }
  return null;
}

export async function signUp(email, password) {
  const sb = await client();
  if (!sb) throw new Error('Cloud non configuré.');
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(traduireErreur(error));
  if (!data.session) return { needsConfirm: true };     // confirmation email activée
  session = { id: data.user.id, email: data.user.email, mode: 'cloud' };
  emit();
  return { needsConfirm: false };
}

export async function signIn(email, password) {
  const sb = await client();
  if (!sb) throw new Error('Cloud non configuré.');
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(traduireErreur(error));
  session = { id: data.user.id, email: data.user.email, mode: 'cloud' };
  emit();
  return session;
}

export async function resetPassword(email) {
  const sb = await client();
  if (!sb) throw new Error('Cloud non configuré.');
  const redirectTo = location.href.split('#')[0];
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw new Error(traduireErreur(error));
}

export async function updatePassword(password) {
  const sb = await client();
  if (!sb) throw new Error('Cloud non configuré.');
  const { error } = await sb.auth.updateUser({ password });
  if (error) throw new Error(traduireErreur(error));
}

/** Compte local : tout reste sur cet appareil (aucune synchro). */
export function startLocal(label = 'Mode local') {
  const user = { id: `local-${uuid()}`, email: label };
  localStorage.setItem(LS_LOCAL, JSON.stringify(user));
  session = { ...user, mode: 'local' };
  emit();
  return session;
}

export async function signOut() {
  if (session && session.mode === 'cloud') {
    const sb = await client();
    if (sb) await sb.auth.signOut();
  } else {
    localStorage.removeItem(LS_LOCAL);
  }
  session = null;
  emit();
}

/** Suppression RGPD : données cloud + compte, ou données locales. */
export async function deleteAccount() {
  if (session && session.mode === 'cloud') {
    const sb = await client();
    if (!sb) throw new Error('Cloud non configuré.');
    const { error } = await sb.rpc('delete_my_account');
    if (error) throw new Error(traduireErreur(error));
    await sb.auth.signOut();
  } else {
    localStorage.removeItem(LS_LOCAL);
  }
  session = null;
  emit();
}

export { isCloudConfigured, uuid };
