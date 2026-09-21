/* =====================================================================
   app.js — démarrage, routeur, coquille (barre d'onglets, état réseau)
   ===================================================================== */
import { el, icon, toast, plural } from './ui.js';
import { applyTheme } from './theme.js';
import * as auth from './auth.js';
import * as store from './store.js';

import * as ScreenAuth from './screens/auth.js';
import * as ScreenOnboarding from './screens/onboarding.js';
import * as ScreenHome from './screens/home.js';
import * as ScreenInventory from './screens/inventory.js';
import * as ScreenOrder from './screens/order.js';
import * as ScreenHistory from './screens/history.js';
import * as ScreenProducts from './screens/products.js';
import * as ScreenSuppliers from './screens/suppliers.js';
import * as ScreenSettings from './screens/settings.js';

const root = document.getElementById('app');
const view = el('main', { id: 'view' });
const state = {};                     /* mémoire d'écran (filtres, quantités) */

const TABS = [
  { id: 'accueil', hash: '#/', label: 'Accueil', icon: 'home' },
  { id: 'inventaire', hash: '#/inventaire', label: 'Inventaire', icon: 'clipboard' },
  { id: 'commandes', hash: '#/commandes', label: 'Commandes', icon: 'send' },
  { id: 'reglages', hash: '#/reglages', label: 'Réglages', icon: 'settings' },
];

const ctx = {
  state,
  navigate(hash) { if (location.hash === hash) mount(); else location.hash = hash; },
  refresh() { mount(); },
};

/* ------------------------------------------------------------- Routage */

function parseHash() {
  const raw = (location.hash || '#/').slice(1);
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = {};
  if (qs) for (const [k, v] of new URLSearchParams(qs)) params[k] = v;
  return { name: parts[0] || '', arg: parts[1] || null, params };
}

function tabFor(name) {
  if (name === 'inventaire' || name === 'produits' || name === 'fournisseurs') return 'inventaire';
  if (name === 'commandes' || name === 'historique' || name === 'commande') return 'commandes';
  if (name === 'reglages') return 'reglages';
  return 'accueil';
}

function screenFor(route) {
  switch (route.name) {
    case 'inventaire': return ScreenInventory.render(ctx);
    case 'commandes': return ScreenOrder.render(ctx);
    case 'historique': return ScreenHistory.render(ctx);
    case 'commande': return ScreenHistory.renderDetail(ctx, route.arg);
    case 'produits': return ScreenProducts.render(ctx);
    case 'fournisseurs': return ScreenSuppliers.render(ctx, route.params);
    case 'reglages': return ScreenSettings.render(ctx);
    default: return ScreenHome.render(ctx);
  }
}

/* ------------------------------------------------- Barre d'onglets */

let tabbar = null;

function buildTabbar() {
  tabbar = el('nav', { class: 'tabbar', role: 'tablist' }, TABS.map((t) =>
    el('button', {
      type: 'button', role: 'tab', dataset: { tab: t.id },
      onClick: () => ctx.navigate(t.hash),
    }, [icon(t.icon, 22), el('span', { text: t.label })])));
  return tabbar;
}

function paintTabbar(active) {
  if (!tabbar) return;
  const n = store.toOrder().length;
  for (const b of tabbar.children) {
    b.classList.toggle('on', b.dataset.tab === active);
    const old = b.querySelector('.pip');
    if (old) old.remove();
    if (b.dataset.tab === 'commandes' && n > 0) {
      b.appendChild(el('span', { class: 'pip', text: n > 99 ? '99+' : String(n) }));
    }
  }
}

/* ------------------------------------------------ Bandeau de synchro */

const syncbar = el('div', { class: 'syncbar hidden' });

function paintSyncbar() {
  const session = auth.current();
  const offline = !navigator.onLine;
  const attente = store.isOpen() ? store.pendingCount() : 0;
  syncbar.textContent = '';
  if (offline) {
    syncbar.className = 'syncbar off';
    syncbar.appendChild(icon('wifiOff', 16));
    syncbar.appendChild(el('span', { text: attente ? `Hors ligne · ${plural(attente, 'modification gardée', 'modifications gardées')}` : 'Hors ligne · tout est gardé sur l’appareil' }));
  } else if (session && session.mode === 'cloud' && attente) {
    syncbar.className = 'syncbar';
    syncbar.appendChild(el('span', { class: 'spinner' }));
    syncbar.appendChild(el('span', { text: `Synchronisation de ${plural(attente, 'modification', 'modifications')}…` }));
  } else {
    syncbar.className = 'syncbar hidden';
  }
}

/* -------------------------------------------------------- Montage */

function mount() {
  const session = auth.current();

  if (!session) {
    view.textContent = '';
    if (tabbar) tabbar.remove();
    tabbar = null;
    syncbar.remove();
    view.appendChild(ScreenAuth.render(ctx));
    return;
  }

  if (!store.isOpen()) store.open(session);

  if (!store.restaurant()) {
    view.textContent = '';
    if (tabbar) { tabbar.remove(); tabbar = null; }
    view.appendChild(ScreenOnboarding.render(ctx));
    return;
  }

  const route = parseHash();
  view.textContent = '';
  if (!tabbar) root.appendChild(buildTabbar());
  const screen = screenFor(route);
  screen.insertBefore(syncbar, screen.firstChild);
  view.appendChild(screen);
  paintSyncbar();
  paintTabbar(tabFor(route.name));
  window.scrollTo({ top: 0 });
}

/* -------------------------------------------------------- Démarrage */

function retirerSplash() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('out');
  setTimeout(() => boot.remove(), 220);
}

async function boot() {
  applyTheme();
  root.appendChild(view);

  const session = await auth.restore();
  if (session) {
    store.open(session);
    mount();
    if (session.mode === 'cloud') {
      store.sync().then(() => { paintSyncbar(); if (!store.restaurant()) mount(); });
    }
  } else {
    mount();
  }
  retirerSplash();

  auth.onAuthChange((s) => {
    if (!s) { store.close(); mount(); return; }
    if (!store.isOpen()) store.open(s);
    mount();
  });

  window.addEventListener('hashchange', mount);
  window.addEventListener('online', () => { paintSyncbar(); toast('Connexion revenue — synchronisation'); });
  window.addEventListener('offline', paintSyncbar);
  store.on('sync', paintSyncbar);
  store.on('change', paintSyncbar);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* hors ligne : pas grave */ });
    });
  }
}

boot();
