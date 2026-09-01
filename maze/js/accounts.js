/* ============================================================
   MazeRun — Espace joueur : comptes locaux (pseudo + mot de passe)
   Chaque compte a sa propre sauvegarde (progression, tenue, visage),
   enregistrée automatiquement à chaque changement. Tout reste sur
   l'appareil ; le mot de passe n'est stocké que haché (SHA-256 salé,
   3000 itérations, implémentation JS pour rester identique partout).
   ============================================================ */
'use strict';

const ACCOUNTS_KEY = 'mazerun.accounts.v1';
const HASH_ROUNDS = 3000;

/* ---------- SHA-256 (Uint8Array -> Uint8Array(32)) ---------- */
const SHA_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
function sha256(bytes) {
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const l = bytes.length, padLen = ((l + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(padLen); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(padLen - 8, Math.floor(l / 536870912)); dv.setUint32(padLen - 4, (l * 8) >>> 0);
  const w = new Uint32Array(64);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
  return out;
}
const toHex = (u8) => Array.from(u8, b => b.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => new Uint8Array(h.match(/.{2}/g).map(x => parseInt(x, 16)));
function randomBytes(n) {
  const u = new Uint8Array(n);
  if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(u); else for (let i = 0; i < n; i++) u[i] = Math.floor(Math.random() * 256);
  return u;
}
/* Hachage salé et itéré du mot de passe */
function hashPassword(pwd, saltHex) {
  const salt = fromHex(saltHex), p = new TextEncoder().encode(pwd.normalize('NFKC'));
  let h = sha256(new Uint8Array([...salt, ...p]));
  const buf = new Uint8Array(32 + salt.length);
  for (let i = 0; i < HASH_ROUNDS; i++) { buf.set(h, 0); buf.set(salt, 32); h = sha256(buf); }
  return toHex(h);
}

/* ---------- Registre des comptes ---------- */
class Accounts {
  constructor() {
    let r = null; try { r = JSON.parse(localStorage.getItem(ACCOUNTS_KEY)); } catch (e) { }
    this.reg = Object.assign({ list: [], current: null }, r || {});
    if (!Array.isArray(this.reg.list)) this.reg.list = [];
  }
  save() { try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(this.reg)); } catch (e) { } }
  get list() { return this.reg.list; }
  /* Compte courant : objet, 'guest' (sans compte) ou null (jamais choisi) */
  current() {
    const c = this.reg.current;
    if (c === 'guest') return 'guest';
    return this.list.find(a => a.id === c) || null;
  }
  isGuest() { return this.reg.current === 'guest' || !this.current(); }
  /* Suffixe des clés de sauvegarde : vide pour l'invité (données d'avant les comptes) */
  suffix() { const c = this.current(); return c && c !== 'guest' ? '.' + c.id : ''; }
  displayName() { const c = this.current(); return c && c !== 'guest' ? c.name : 'Invité'; }
  find(name) { const n = name.trim().toLowerCase(); return this.list.find(a => a.name.toLowerCase() === n); }
  validate(name, pwd, creating) {
    name = name.trim();
    if (name.length < 2 || name.length > 16) return 'Le pseudo doit faire entre 2 et 16 caractères.';
    if (!/^[\p{L}\p{N} _.\-]+$/u.test(name)) return 'Le pseudo : lettres, chiffres, espaces, - _ . seulement.';
    if (pwd.length < 4) return 'Le mot de passe doit faire au moins 4 caractères.';
    if (creating && this.find(name)) return 'Ce pseudo existe déjà sur cet appareil.';
    return null;
  }
  create(name, pwd) {
    const err = this.validate(name, pwd, true); if (err) return { error: err };
    const salt = toHex(randomBytes(16));
    const acc = { id: toHex(randomBytes(6)), name: name.trim(), salt, hash: hashPassword(pwd, salt), created: Date.now(), seen: Date.now() };
    this.list.push(acc); this.reg.current = acc.id; this.save();
    return { account: acc };
  }
  login(name, pwd) {
    const acc = this.find(name);
    if (!acc) return { error: 'Aucun compte avec ce pseudo sur cet appareil.' };
    if (hashPassword(pwd, acc.salt) !== acc.hash) return { error: 'Mot de passe incorrect.' };
    acc.seen = Date.now(); this.reg.current = acc.id; this.save();
    return { account: acc };
  }
  guest() { this.reg.current = 'guest'; this.save(); }
  logout() { this.reg.current = null; this.save(); }
  /* Supprime le compte courant et ses sauvegardes */
  remove(acc) {
    this.reg.list = this.list.filter(a => a.id !== acc.id);
    if (this.reg.current === acc.id) this.reg.current = null;
    this.save();
    try { localStorage.removeItem(STORE_KEY + '.' + acc.id); localStorage.removeItem(FACE_KEY + '.' + acc.id); } catch (e) { }
  }
  /* Étoiles d'un compte (pour la liste), sans changer de compte */
  starsOf(acc) {
    try { const p = JSON.parse(localStorage.getItem(STORE_KEY + '.' + acc.id)); let n = 0; for (const k in (p && p.levels) || {}) n += p.levels[k].rating || 0; return n; } catch (e) { return 0; }
  }
}
const ACCOUNTS = new Accounts();
function progressKey() { return STORE_KEY + ACCOUNTS.suffix(); }
function faceKey() { return FACE_KEY + ACCOUNTS.suffix(); }

/* ---------- Écran « Espace joueur » ---------- */
class AccountUI {
  constructor(game) {
    this.g = game;
    const q = (s) => document.querySelector(s);
    this.el = q('#account'); this.title = q('#acTitle'); this.who = q('#acWho'); this.list = q('#acList');
    this.tabs = q('#acTabs'); this.form = q('#acForm'); this.name = q('#acName'); this.pwd = q('#acPwd'); this.err = q('#acErr');
    this.buttons = q('#acButtons'); this.mode = 'login';
    this.tabs.querySelectorAll('.seg').forEach(b => b.addEventListener('click', () => { this.g.audio.init(); this.g.audio.tap(); this.setMode(b.dataset.mode); }));
    q('#acEye').addEventListener('click', () => { this.pwd.type = this.pwd.type === 'password' ? 'text' : 'password'; });
    this.form.addEventListener('submit', (e) => { e.preventDefault(); this.submit(); });
  }
  open(first = false) {
    this.first = first;
    this.el.classList.remove('hidden'); this.g.ui.menu.classList.add('hidden'); this.g.accountOpen = true;
    this.g.character.mode = 'wave'; this.g.character.t = 0;
    this.err.textContent = ''; this.pwd.value = '';
    const cur = ACCOUNTS.current();
    const logged = cur && cur !== 'guest';
    this.setMode(logged ? 'me' : (ACCOUNTS.list.length ? 'login' : 'create'));
  }
  close() {
    this.el.classList.add('hidden'); this.g.accountOpen = false;
    if (this.g.state === 'menu') { this.g.ui.menu.classList.remove('hidden'); this.g.showMenu(); }
  }
  setMode(m) {
    this.mode = m;
    const cur = ACCOUNTS.current(), logged = cur && cur !== 'guest';
    this.tabs.classList.toggle('hidden', m === 'me');
    this.tabs.querySelectorAll('.seg').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    this.form.classList.toggle('hidden', m === 'me');
    this.err.textContent = '';
    this.title.textContent = m === 'me' ? `👤 ${cur.name}` : m === 'create' ? 'Créer un compte' : 'Se connecter';
    this.who.textContent = m === 'me'
      ? `⭐ ${this.g.totalStars()} / ${MAX_STARS} · sauvegarde automatique sur cet appareil`
      : m === 'create' ? 'Choisis un pseudo et un mot de passe : ta progression sera enregistrée toute seule, séparément des autres joueurs.'
        : 'Retrouve ta sauvegarde avec ton pseudo et ton mot de passe.';
    this.name.autocomplete = m === 'create' ? 'username' : 'username';
    this.pwd.autocomplete = m === 'create' ? 'new-password' : 'current-password';
    // comptes déjà présents sur l'appareil : un tap remplit le pseudo
    this.list.innerHTML = '';
    const others = ACCOUNTS.list.filter(a => !(logged && a.id === cur.id));
    this.list.classList.toggle('hidden', m === 'create' || !others.length);
    for (const a of others) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'acc' + (this.name.value.trim().toLowerCase() === a.name.toLowerCase() ? ' active' : '');
      b.innerHTML = `<span class="acc-av">👤</span><span class="acc-name">${a.name.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</span><span class="acc-stars">⭐ ${ACCOUNTS.starsOf(a)}</span>`;
      b.addEventListener('click', () => { this.g.audio.init(); this.g.audio.tap(); this.name.value = a.name; this.list.querySelectorAll('.acc').forEach(x => x.classList.toggle('active', x === b)); this.pwd.focus(); });
      this.list.appendChild(b);
    }
    const B = [];
    if (m === 'me') {
      B.push(['🔁 Changer de joueur', '', () => { ACCOUNTS.logout(); this.g.switchAccount(); this.setMode(ACCOUNTS.list.length ? 'login' : 'create'); }]);
      B.push(['Fermer', 'ghost', () => this.close()]);
      B.push(['🗑 Supprimer ce compte', 'danger', (btn) => {
        if (!this._armed) { this._armed = true; btn.textContent = '⚠️ Vraiment supprimer ? (tap encore)'; clearTimeout(this._armT); this._armT = setTimeout(() => { this._armed = false; btn.textContent = '🗑 Supprimer ce compte'; }, 4000); return; }
        this._armed = false; ACCOUNTS.remove(cur); this.g.switchAccount(); this.g.toast('Compte supprimé'); this.setMode(ACCOUNTS.list.length ? 'login' : 'create');
      }]);
    } else {
      B.push([m === 'create' ? '✓ Créer mon compte' : '▶ Se connecter', 'primary', () => this.submit(), true]);
      if (!logged) B.push([this.first ? 'Jouer sans compte' : 'Continuer sans compte', 'ghost', () => { ACCOUNTS.guest(); this.g.switchAccount(); this.close(); }]);
      else B.push(['Annuler', 'ghost', () => this.setMode('me')]);
    }
    this.buttons.innerHTML = '';
    for (const [label, cls, fn, isSubmit] of B) {
      const b = document.createElement('button'); b.type = isSubmit ? 'submit' : 'button'; b.className = 'btn ' + cls; b.textContent = label;
      if (isSubmit) b.setAttribute('form', 'acForm');
      else b.addEventListener('click', () => { this.g.audio.init(); this.g.audio.tap(); fn(b); });
      this.buttons.appendChild(b);
    }
    if (m !== 'me') setTimeout(() => (this.name.value ? this.pwd : this.name).focus(), 50);
  }
  submit() {
    const name = this.name.value, pwd = this.pwd.value;
    const err = ACCOUNTS.validate(name, pwd, this.mode === 'create');
    if (err) { this.err.textContent = err; return; }
    const r = this.mode === 'create' ? ACCOUNTS.create(name, pwd) : ACCOUNTS.login(name, pwd);
    if (r.error) { this.err.textContent = r.error; this.g.audio.lose(); return; }
    this.g.audio.unlock();
    this.g.switchAccount();
    this.close();
    this.g.bubbleSay(this.mode === 'create' ? `Bienvenue, ${r.account.name} ! 🎉` : `Content de te revoir, ${r.account.name} !`);
    this.g.flashSaved(this.mode === 'create' ? 'Compte créé · sauvegarde auto activée' : 'Sauvegarde chargée');
  }
}
