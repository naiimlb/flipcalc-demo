/* =====================================================================
   cloud.js — configuration et client Supabase (chargé à la demande)
   ---------------------------------------------------------------------
   Renseigne ci-dessous l'URL et la clé « anon » de ton projet Supabase,
   ou laisse vide : l'app propose alors de les saisir dans l'écran de
   connexion / les réglages (elles sont stockées sur l'appareil).
   La clé « anon » est publique par nature : la sécurité est assurée par
   les règles Row Level Security (voir supabase/schema.sql).
   ===================================================================== */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const BUILTIN = { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };

const LS_KEY = 'ce:cloud';
/* Deux CDN : si le premier est injoignable, on bascule sur le second. */
const CDNS = [
  'https://esm.sh/@supabase/supabase-js@2.45.4',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm',
];

export function cloudConfig() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o && o.url && o.anonKey) return o;
    }
  } catch { /* stockage indisponible */ }
  return BUILTIN.url && BUILTIN.anonKey ? { ...BUILTIN } : null;
}

export const isCloudConfigured = () => !!cloudConfig();

export function setCloudConfig(url, anonKey) {
  const clean = { url: String(url || '').trim().replace(/\/+$/, ''), anonKey: String(anonKey || '').trim() };
  if (!/^https:\/\/[^\s]+$/i.test(clean.url)) throw new Error("L'URL du projet doit commencer par https://");
  if (clean.anonKey.length < 20) throw new Error('La clé « anon » semble incomplète.');
  localStorage.setItem(LS_KEY, JSON.stringify(clean));
  _client = null;
  return clean;
}

export function clearCloudConfig() {
  localStorage.removeItem(LS_KEY);
  _client = null;
}

let _client = null;
let _lib = null;

/** Client Supabase, ou null si non configuré / librairie injoignable. */
export async function client() {
  if (_client) return _client;
  const cfg = cloudConfig();
  if (!cfg) return null;
  try {
    if (!_lib) {
      let derniere;
      for (const url of CDNS) {
        try { _lib = await import(/* @vite-ignore */ url); break; }
        catch (e) { derniere = e; }
      }
      if (!_lib) throw derniere || new Error('Librairie Supabase injoignable');
    }
    _client = _lib.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'ce:auth' },
    });
    return _client;
  } catch (e) {
    console.warn('Supabase indisponible :', e && e.message);
    return null;
  }
}

/** Messages d'erreur Supabase traduits en français. */
export function traduireErreur(e) {
  const m = String((e && (e.message || e.error_description)) || e || '').toLowerCase();
  if (!m) return 'Une erreur est survenue.';
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return "Email pas encore confirmé : ouvre le lien reçu par email.";
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet email.';
  if (m.includes('password should be at least')) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Adresse email invalide.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives : réessaie dans quelques minutes.';
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed')) return 'Pas de connexion : réessaie une fois le réseau revenu.';
  if (m.includes('row-level security') || m.includes('permission denied')) return "Accès refusé : vérifie que le schéma SQL a bien été exécuté.";
  if (m.includes('does not exist') || m.includes('schema cache')) return "Tables absentes : exécute supabase/schema.sql dans ton projet.";
  return (e && e.message) || 'Une erreur est survenue.';
}
