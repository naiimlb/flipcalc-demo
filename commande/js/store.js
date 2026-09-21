/* =====================================================================
   store.js — base locale d'abord, synchronisée avec Supabase
   ---------------------------------------------------------------------
   Toute modification est écrite immédiatement sur l'appareil (localStorage)
   et marquée « à pousser ». Dès que le réseau revient, les lignes en
   attente partent vers Postgres et les nouveautés distantes redescendent.
   Arbitrage des conflits : la dernière écriture gagne (updated_at).
   ===================================================================== */
import { client, traduireErreur } from './cloud.js';
import { uuid } from './auth.js';

export const TABLES = ['restaurants', 'suppliers', 'products', 'orders', 'order_lines'];
export const ZONES = ['Frigo', 'Congélateur', 'Sec', 'Boissons', 'Emballages'];
export const ZONE_ICONS = { 'Frigo': 'box', 'Congélateur': 'box', 'Sec': 'box', 'Boissons': 'box', 'Emballages': 'box' };
export const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
export const TYPES_RESTO = [
  { id: 'fast-food', label: 'Fast-food' },
  { id: 'snack', label: 'Snack' },
  { id: 'traiteur', label: 'Traiteur' },
];

/* Colonnes locales à ne jamais envoyer au serveur. */
const LOCAL_ONLY = ['_dirty'];

let uid = null;
let mode = 'local';
let data = blank();
let meta = { lastPull: {} };
let syncing = false;
let timer = null;

/* Émetteur minimal (plus portable que new EventTarget() sur vieux Safari). */
const bus = new Map();
export const on = (evt, fn) => {
  if (!bus.has(evt)) bus.set(evt, new Set());
  bus.get(evt).add(fn);
  return () => bus.get(evt).delete(fn);
};
const emit = (evt, detail) => {
  const abonnes = bus.get(evt);
  if (abonnes) for (const fn of [...abonnes]) { try { fn({ detail }); } catch (e) { console.warn(e); } }
};

function blank() { return Object.fromEntries(TABLES.map((t) => [t, []])); }
const nowISO = () => new Date().toISOString();
const keyData = () => `ce:data:${uid}`;
const keyMeta = () => `ce:meta:${uid}`;

/* ---------------------------------------------------------------- État */

export function open(session) {
  uid = session.id;
  mode = session.mode;
  data = blank();
  meta = { lastPull: {} };
  try {
    const raw = localStorage.getItem(keyData());
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const t of TABLES) if (Array.isArray(parsed[t])) data[t] = parsed[t];
    }
    const rawMeta = localStorage.getItem(keyMeta());
    if (rawMeta) meta = { lastPull: {}, ...JSON.parse(rawMeta) };
  } catch { /* stockage illisible : on repart d'une base vide */ }
  emit('change');
}

export function close() { uid = null; data = blank(); meta = { lastPull: {} }; }
export const isOpen = () => !!uid;
export const isCloud = () => mode === 'cloud';

function persist() {
  if (!uid) return;
  try {
    localStorage.setItem(keyData(), JSON.stringify(data));
    localStorage.setItem(keyMeta(), JSON.stringify(meta));
  } catch (e) {
    console.warn('Sauvegarde locale impossible', e);
  }
  emit('change');
}

/** Efface les données locales de ce compte (déconnexion, suppression). */
export function wipeLocal() {
  if (!uid) return;
  try { localStorage.removeItem(keyData()); localStorage.removeItem(keyMeta()); } catch { /* ignore */ }
  data = blank();
  meta = { lastPull: {} };
}

/* ------------------------------------------------------------ Écritures */

export function put(table, patch) {
  const list = data[table];
  const i = patch.id ? list.findIndex((r) => r.id === patch.id) : -1;
  let rec;
  if (i >= 0) {
    rec = { ...list[i], ...patch, updated_at: nowISO(), _dirty: true };
    list[i] = rec;
  } else {
    rec = {
      id: patch.id || uuid(),
      user_id: uid,
      created_at: nowISO(),
      deleted_at: null,
      ...patch,
      updated_at: nowISO(),
      _dirty: true,
    };
    list.push(rec);
  }
  persist();
  scheduleSync();
  return rec;
}

export function putMany(table, patches) {
  const out = patches.map((p) => {
    const list = data[table];
    const i = p.id ? list.findIndex((r) => r.id === p.id) : -1;
    const rec = i >= 0
      ? { ...list[i], ...p, updated_at: nowISO(), _dirty: true }
      : { id: p.id || uuid(), user_id: uid, created_at: nowISO(), deleted_at: null, ...p, updated_at: nowISO(), _dirty: true };
    if (i >= 0) list[i] = rec; else list.push(rec);
    return rec;
  });
  persist();
  scheduleSync();
  return out;
}

export function remove(table, id) {
  const list = data[table];
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], deleted_at: nowISO(), updated_at: nowISO(), _dirty: true };
  persist();
  scheduleSync();
}

/* ------------------------------------------------------------- Lectures */

const alive = (t) => data[t].filter((r) => !r.deleted_at);
const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' });

export const restaurant = () => alive('restaurants')[0] || null;
export const suppliers = () => alive('suppliers').sort(byName);
export const supplier = (id) => data.suppliers.find((r) => r.id === id && !r.deleted_at) || null;

export function products() {
  return alive('products').sort((a, b) => {
    const z = ZONES.indexOf(a.zone) - ZONES.indexOf(b.zone);
    if (z !== 0) return z;
    const s = (a.sort_index || 0) - (b.sort_index || 0);
    return s !== 0 ? s : byName(a, b);
  });
}
export const product = (id) => data.products.find((r) => r.id === id && !r.deleted_at) || null;

export const orders = () => alive('orders').sort((a, b) =>
  String(b.ordered_at).localeCompare(String(a.ordered_at)) || String(b.created_at).localeCompare(String(a.created_at)));
export const order = (id) => data.orders.find((r) => r.id === id && !r.deleted_at) || null;
export const orderLines = (orderId) => alive('order_lines').filter((l) => l.order_id === orderId);

/** Quantité proposée : besoin arrondi au multiple de conditionnement supérieur. */
export function suggestedQty(p) {
  const need = Math.max(0, Number(p.target_stock || 0) - Number(p.current_stock || 0));
  if (need <= 0) return 0;
  const pack = Number(p.pack_size) > 0 ? Number(p.pack_size) : 1;
  return Math.ceil(Math.round((need / pack) * 1e6) / 1e6) * pack;
}

/** 'rupture' | 'bas' | 'ok' */
export function stockState(p) {
  const cur = Number(p.current_stock || 0);
  const target = Number(p.target_stock || 0);
  if (cur <= 0) return 'rupture';
  if (target > 0 && cur < target) return 'bas';
  return 'ok';
}

export const toOrder = () => products().filter((p) => suggestedQty(p) > 0);
export const pendingCount = () =>
  (mode === 'cloud' ? TABLES.reduce((n, t) => n + data[t].filter((r) => r._dirty).length, 0) : 0);
export const lastPullAt = () => meta.lastPull.products || null;

/* ------------------------------------------------------------- Synchro */

export function scheduleSync(delay = 900) {
  if (mode !== 'cloud') return;
  clearTimeout(timer);
  timer = setTimeout(() => { sync().catch(() => {}); }, delay);
}

export async function sync({ silent = true } = {}) {
  if (mode !== 'cloud' || !uid || syncing) return { skipped: true };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    emit('sync', { state: 'offline' });
    return { skipped: true };
  }
  const sb = await client();
  if (!sb) { emit('sync', { state: 'offline' }); return { skipped: true }; }

  syncing = true;
  emit('sync', { state: 'running' });
  try {
    /* 1. Pousser les modifications locales (par table, ordre des dépendances) */
    for (const t of TABLES) {
      const dirty = data[t].filter((r) => r._dirty);
      if (!dirty.length) continue;
      const rows = dirty.map((r) => {
        const copy = { ...r, user_id: uid };
        for (const k of LOCAL_ONLY) delete copy[k];
        return copy;
      });
      const { error } = await sb.from(t).upsert(rows, { onConflict: 'id' });
      if (error) throw error;
      for (const r of dirty) delete r._dirty;
    }

    /* 2. Récupérer les nouveautés distantes */
    for (const t of TABLES) {
      let q = sb.from(t).select('*').eq('user_id', uid);
      const since = meta.lastPull[t];
      if (since) q = q.gt('updated_at', since);
      const { data: rows, error } = await q;
      if (error) throw error;
      if (rows && rows.length) {
        for (const remote of rows) {
          const list = data[t];
          const i = list.findIndex((r) => r.id === remote.id);
          if (i < 0) list.push(remote);
          else if (!list[i]._dirty && String(remote.updated_at) > String(list[i].updated_at || '')) list[i] = remote;
        }
        const max = rows.reduce((m, r) => (String(r.updated_at) > m ? String(r.updated_at) : m), since || '');
        if (max) meta.lastPull[t] = max;
      }
    }

    meta.syncedAt = nowISO();
    persist();
    emit('sync', { state: 'done', at: meta.syncedAt });
    return { ok: true };
  } catch (e) {
    console.warn('Synchro impossible :', e);
    emit('sync', { state: 'error', message: traduireErreur(e) });
    if (!silent) throw new Error(traduireErreur(e));
    return { ok: false };
  } finally {
    syncing = false;
  }
}

export const syncedAt = () => meta.syncedAt || null;

/** Première synchro d'un appareil : on vide le cache local avant de tout tirer. */
export async function pullAll() {
  meta.lastPull = {};
  return sync({ silent: false });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { emit('net', { online: true }); scheduleSync(300); });
  window.addEventListener('offline', () => emit('net', { online: false }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(600); });
}
