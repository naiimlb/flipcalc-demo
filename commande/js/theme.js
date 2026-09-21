/* =====================================================================
   theme.js — thème sombre par défaut, clair en option
   ===================================================================== */
const KEY = 'ce:theme';
const COLORS = { dark: '#14161A', light: '#F4F5F7' };

export function currentTheme() {
  try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; }
}

export function applyTheme() {
  const pref = currentTheme();
  /* Sombre par défaut ; « auto » suit le réglage du système. */
  const clair = pref === 'light'
    || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  const mode = clair ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', COLORS[mode]);
  return mode;
}

export function setTheme(value) {
  try { localStorage.setItem(KEY, value); } catch { /* ignore */ }
  applyTheme();
}

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (currentTheme() === 'auto') applyTheme();
});
