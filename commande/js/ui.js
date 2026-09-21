/* =====================================================================
   ui.js — fabrique d'éléments, icônes, feuilles modales, toasts, formats
   ===================================================================== */

/* ---------- Icônes (tracés type Lucide, 24×24, trait 2) ---------- */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5',
  clipboard: 'M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 4a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 12h6M9 16h4',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.58.63 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.88 0-1.37.42-1.51 1z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevronRight: 'm9 18 6-6-6-6',
  chevronLeft: 'm15 18-6-6 6-6',
  chevronDown: 'm6 9 6 6 6-6',
  arrowLeft: 'M19 12H5M12 19l-7-7 7-7',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  box: 'm21 8-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v10',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  message: 'M21 11.5a8.4 8.4 0 0 1-9 8.5 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5a8.4 8.4 0 0 1-.9-3.9 8.4 8.4 0 0 1 8.5-9 8.5 8.5 0 0 1 8.5 8.4z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 6L2 7',
  copy: 'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  check: 'M20 6 9 17l-5-5',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-3.5-9 2.5 2.5L16 9.5',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-4M12 8h.01',
  x: 'M18 6 6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  pencil: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  cloudOff: 'M3 3l18 18M17.5 19H9a7 7 0 0 1-1.2-13.9M10.6 4.2A7 7 0 0 1 21 10.5c0 1.6-.5 3-1.5 4.1',
  cloud: 'M17.5 19H9a7 7 0 1 1 1.6-13.8A7 7 0 0 1 21 10.5a4.5 4.5 0 0 1-3.5 8.5z',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  rotate: 'M3 12a9 9 0 1 0 2.6-6.4M3 3v6h6',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  store: 'M3 9.5 4.5 4h15L21 9.5M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  wifiOff: 'M3 3l18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.8a10 10 0 0 1 4-2.4M2 8.8A15 15 0 0 1 6.5 6M22 8.8a15 15 0 0 0-8-3.7M18.7 12.7A10 10 0 0 0 16 11M12 20h.01',
  truck: 'M10 17V5a1 1 0 0 0-1-1H2v12a1 1 0 0 0 1 1h1M10 8h5l4 4v5h-2M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10 17h5',
  flame: 'M12 22a7 7 0 0 0 7-7c0-4-3-6-4-9-2 2-3 3-4 3-1.5 0-2-1.5-2-3-2 1.5-4 4.5-4 9a7 7 0 0 0 7 7z',
  sandwich: 'M3 11h18l-2.5-4.5a2 2 0 0 0-1.7-1H7.2a2 2 0 0 0-1.7 1L3 11zM3 14h18M4 17h16a1 1 0 0 1 0 4H4a1 1 0 0 1 0-4z',
  key: 'M14.5 10.5a4.5 4.5 0 1 0-4.2 4.5L9 16.3V19h3l3.3-3.3a4.5 4.5 0 0 0-.8-5.2zM16 8h.01',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
};

export function icon(name, size = 20, cls = '') {
  const d = ICONS[name] || ICONS.info;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
  return svg;
}

/* ---------- Fabrique d'éléments ---------- */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && k !== 'list' && k !== 'type' && k !== 'form') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export const frag = (children = []) => {
  const f = document.createDocumentFragment();
  for (const c of [].concat(children)) if (c) f.appendChild(c);
  return f;
};

/* ---------- Toast ---------- */
export function toast(message, kind = '') {
  let host = document.getElementById('toasts');
  if (!host) { host = el('div', { id: 'toasts' }); document.body.appendChild(host); }
  const ic = kind === 'ok' ? 'checkCircle' : kind === 'err' ? 'alert' : 'info';
  const t = el('div', { class: `toast ${kind}`, role: 'status' }, [icon(ic, 18), el('span', { text: message })]);
  host.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 220);
  }, 2600);
}

/* ---------- Feuille modale ---------- */
export function sheet(title, build, { onClose } = {}) {
  const box = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const scrim = el('div', { class: 'scrim' }, [box]);
  const close = () => { scrim.remove(); document.body.style.overflow = ''; onClose && onClose(); };
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  box.appendChild(el('div', { class: 'grip' }));
  if (title) box.appendChild(el('h2', { text: title }));
  const body = build(close);
  if (body) box.appendChild(body);
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';
  const first = box.querySelector('input, select, textarea');
  if (first && window.matchMedia('(min-width: 720px)').matches) first.focus();
  return close;
}

export function confirmSheet(title, message, { danger = false, okLabel = 'Confirmer' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v, close) => { done = true; resolve(v); close(); };
    sheet(title, (close) => frag([
      el('p', { text: message, style: 'color:var(--text-dim);font-size:.92rem' }),
      el('div', { class: 'sheet-actions' }, [
        el('button', { class: 'btn ghost', type: 'button', onClick: () => finish(false, close) }, ['Annuler']),
        el('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onClick: () => finish(true, close) }, [okLabel]),
      ]),
    ]), { onClose: () => { if (!done) resolve(false); } });
  });
}

/* ---------- États vides / champs ---------- */
export function empty(iconName, title, text, action) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'ic' }, [icon(iconName, 26)]),
    el('h3', { text: title }),
    text ? el('p', { text }) : null,
    action || null,
  ]);
}

export function field(label, input, hint) {
  return el('div', { class: 'field' }, [
    el('label', { text: label, for: input.id || null }),
    input,
    hint ? el('div', { class: 'hint', text: hint }) : null,
  ]);
}

/* ---------- Formats ---------- */
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function fmtDate(iso, { court = false } = {}) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y) return String(iso);
  return court ? `${d}/${String(m).padStart(2, '0')}/${String(y).slice(2)}` : `${d} ${MOIS[m - 1]} ${y}`;
}

export function fmtRelative(iso) {
  if (!iso) return '';
  const day = 86400000;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const diff = Math.round((target - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / day);
  if (diff === 0) return "aujourd'hui";
  if (diff === -1) return 'hier';
  if (diff === 1) return 'demain';
  if (diff < 0 && diff > -7) return `il y a ${-diff} jours`;
  return fmtDate(iso, { court: true });
}

export const fmtNum = (n) => {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
};

export const plural = (n, one, many) => `${fmtNum(n)} ${Math.abs(Number(n)) > 1 ? many : one}`;

export const debounce = (fn, ms = 400) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
