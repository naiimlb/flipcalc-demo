/* =====================================================================
   auth.js — comptes : cloud (Supabase Auth) ou local (cet appareil)
   ===================================================================== */
import { client, isCloudConfigured, traduireErreur } from './cloud.js';

const LS_LOCAL = 'ce:local-user';
const listeners = new Set();

let session = null;   // { id, email, mode: 'cloud' | 'local' }

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

/** Restaure la session au démarrage. */
export async function restore() {
  const sb = await client();
  if (sb) {
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      const u = data.session.user;
      session = { id: u.id, email: u.email, mode: 'cloud' };
      emit();
      sb.auth.onAuthStateChange((event, s) => {
        if (event === 'SIGNED_OUT' || !s) { if (session && session.mode === 'cloud') { session = null; emit(); } }
        else if (s.user && (!session || session.id !== s.user.id)) {
          session = { id: s.user.id, email: s.user.email, mode: 'cloud' };
          emit();
        }
      });
      return session;
    }
  }
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
