/* ============================================================
   MazeRun — Logique du jeu, caméra, entrées tactiles, HUD, menu des mondes
   ============================================================ */
'use strict';

const $ = (s) => document.querySelector(s);
const STORE_KEY = 'mazerun.progress.v2';
const CAM_H = 9.4, CAM_D = 4.3, INTRO_DUR = 3.0;
const PLAYER_R = 0.30, PLAYER_SPEED = 3.6;
const TIME_STAR = 0.3;          // part du chrono restante pour l'étoile du temps
const PREVIEW_SIZE = 6;         // labyrinthe d'arrière-plan du menu

const PARTICLE_CFG = {
  pollen: { count: 120, colors: [[1, 0.95, 0.6]], size: [2, 4], mode: 'float', alpha: 0.75, additive: true, twinkle: true },
  fireflies: { count: 150, colors: [[0.75, 1, 0.35], [1, 1, 0.5]], size: [3, 6], mode: 'float', alpha: 0.9, additive: true, twinkle: true },
  bubbles: { count: 110, colors: [[1, 1, 1]], size: [2, 5], mode: 'rise', speed: 0.7, alpha: 0.6, additive: true, twinkle: true },
  dust: { count: 180, colors: [[1, 0.85, 0.6]], size: [3, 7], mode: 'drift', alpha: 0.28, additive: false },
  snow: { count: 340, colors: [[1, 1, 1]], size: [2, 5], mode: 'fall', speed: 1.3, sway: 0.7, alpha: 0.9, additive: false },
  leaves: { count: 220, colors: [[1, 0.5, 0.1], [0.9, 0.25, 0.1], [1, 0.75, 0.2]], size: [3, 6], mode: 'fall', speed: 1.0, sway: 1.5, alpha: 0.95, additive: false },
  embers: { count: 240, colors: [[1, 0.5, 0.1], [1, 0.8, 0.25]], size: [2, 5], mode: 'rise', speed: 1.5, alpha: 0.9, additive: true, twinkle: true },
  sparkle: { count: 220, colors: [[1, 1, 1], [0.7, 0.9, 1]], size: [2, 5], mode: 'float', alpha: 0.9, additive: true, twinkle: true },
  rain: { count: 320, colors: [[0.6, 0.8, 1]], size: [1.5, 2.5], mode: 'fall', speed: 10, sway: 0, alpha: 0.45, additive: true },
  stars: { count: 450, colors: [[1, 1, 1], [0.8, 0.9, 1], [1, 0.9, 0.7]], size: [1.5, 4], mode: 'dome', alpha: 0.9, additive: true, twinkle: true },
};

const MODES = {
  detente: { label: '🐣 Détente', hint: 'Sans chrono, indices gratuits. Idéal pour les petits.', timeMul: Infinity, hintFree: true },
  normal: { label: '🙂 Normal', hint: 'Le chrono tourne, 3 étoiles à décrocher.', timeMul: 1 },
  expert: { label: '🔥 Expert', hint: '40 % de temps en moins et pas d’indice. Pour les champions !', timeMul: 0.6, noHint: true },
};
const OUTFITS = [
  { id: 'blanc', name: 'Blanc', tee: '#f0f0f5', need: 0 },
  { id: 'rouge', name: 'Rouge', tee: '#e53935', need: 5 },
  { id: 'bleu', name: 'Bleu', tee: '#1e88e5', need: 10 },
  { id: 'vert', name: 'Vert', tee: '#43a047', need: 18 },
  { id: 'jaune', name: 'Jaune', tee: '#fdd835', need: 27 },
  { id: 'violet', name: 'Violet', tee: '#8e24aa', need: 40 },
  { id: 'noir', name: 'Noir', tee: '#1c1c22', need: 55 },
  { id: 'or', name: 'Or', tee: '#ffb300', need: 75 },
  { id: 'rose', name: 'Rose', tee: '#ff4fa3', need: 100 },
];
const POPS = ['Super !', 'Génial !', 'Bravo !', 'Top !', 'Waouh !', 'Yes !'];
const MAX_STARS = 3 * LEVELS.length;
const FIREWORK_COLORS = [[1, 0.3, 0.4], [0.3, 0.9, 1], [1, 0.9, 0.2], [0.5, 1, 0.4], [1, 1, 1], [0.8, 0.5, 1]];

function loadProgress() {
  let p = null; try { p = JSON.parse(localStorage.getItem(progressKey())); } catch (e) { }
  p = p || {}; p.levels = p.levels || {};
  p.settings = Object.assign({ mode: 'normal', outfit: 'blanc', faceAsked: false, world: 0 }, p.settings || {});
  p.random = p.random || { played: 0 };
  return p;
}
/* Sauvegarde automatique : appelée à chaque changement, dans l'espace du compte courant */
function saveProgress(p) { try { localStorage.setItem(progressKey(), JSON.stringify(p)); } catch (e) { } }
function fmtTime(s) {
  if (!isFinite(s)) return '∞';
  s = Math.max(0, s);
  if (s < 10) return s.toFixed(1).replace('.', ',');
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}

class Game {
  constructor() {
    this.canvas = $('#gl');
    this.renderer = new Renderer(this.canvas);
    this.gl = this.renderer.gl;
    this.audio = new AudioFX();
    this.progress = loadProgress();
    this.state = 'menu';
    this.scene = new Node();
    this.face = null; this.faceCanvas = null; this.skin = null;
    this.character = buildCharacter(this.gl, { tee: this.outfit().tee });
    this.starMesh = buildStarMesh(this.gl);
    this.haloMesh = buildHaloMesh(this.gl);
    this.ringMesh = buildRingMesh(this.gl);
    this.rings = []; this.ringI = 0;
    for (let i = 0; i < 4; i++) { const r = new Node(this.ringMesh); r.visible = false; r.additive = true; r.alpha = 0; r.t = 0; this.rings.push(r); }
    this.arrow = new Node(buildArrowMesh(this.gl)); this.arrow.visible = false;
    this.particles = new ParticleSystem(this.gl, 500);
    this.fx = new ParticleSystem(this.gl, 600);
    this.fxVel = new Float32Array(600 * 3); this.fxLife = new Float32Array(600); this.fxMax = new Float32Array(600); this.fxGrav = new Float32Array(600);
    this.pPhase = new Float32Array(500); this.pVel = new Float32Array(500 * 3); this.pBase = new Float32Array(500);
    this.input = { joy: [0, 0], keys: {}, joyId: null, origin: [0, 0] };
    this.cam = { pos: [0, 8, 8], target: [0, 0, 0] };
    this.time = 0; this.last = 0; this.level = null; this.levelIndex = -2;
    this.menuWorld = clamp(this.progress.settings.world | 0, 0, WORLDS.length - 1);
    this.creatorOpen = false;
    this.ui = {
      hud: $('#hud'), timer: $('#hudTimer'), lvl: $('#hudLevel'), stars: $('#hudStars'), tip: $('#tip'), toast: $('#toast'),
      tbar: $('#tbar'), tfill: $('#tfill'),
      menu: $('#menu'), worlds: $('#worlds'), levels: $('#levels'), levelInfo: $('#levelInfo'),
      pause: $('#pause'), result: $('#result'), banner: $('#banner'), fade: $('#fade'),
      joy: $('#joy'), knob: $('#joyKnob'), vignette: $('#vignette'), minimap: $('#minimap'), hint: $('#btnHint'),
      hero: $('#hero'), crHero: $('#creatorHero'), acHero: $('#accountHero'), bubble: $('#heroBubble'), pop: $('#pop'), modes: $('#modes'), outfits: $('#outfits'), starsTotal: $('#starsTotal'),
    };
    this.mm = { ctx: this.ui.minimap.getContext('2d'), layer: document.createElement('canvas'), dirty: true, cell: 8 };
    this.creator = new FaceCreator(this);
    this.account = new AccountUI(this);
    this.accountOpen = false;
    this.bindUI(); this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    this.loadSavedFace();
    this.showMenu();
    requestAnimationFrame((t) => this.loop(t));
  }

  /* ---------- UI ---------- */
  bindUI() {
    const tap = (fn) => () => { this.audio.init(); this.audio.tap(); fn(); };
    $('#btnPlay').addEventListener('click', tap(() => this.startLevel(this.firstUnfinished())));
    $('#btnPause').addEventListener('click', tap(() => this.pause()));
    $('#btnResume').addEventListener('click', tap(() => this.resume()));
    $('#btnRestart').addEventListener('click', tap(() => this.replay()));
    $('#btnMenu').addEventListener('click', tap(() => this.showMenu()));
    $('#btnHint').addEventListener('click', () => this.useHint());
    $('#btnRetry').addEventListener('click', tap(() => this.replay()));
    $('#btnNext').addEventListener('click', tap(() => { if (this.levelIndex < 0) this.startRandom(); else this.startLevel(Math.min(LEVELS.length - 1, this.levelIndex + 1)); }));
    $('#btnResultMenu').addEventListener('click', tap(() => this.showMenu()));
    $('#btnRandom').addEventListener('click', tap(() => this.startRandom()));
    $('#btnDetente').addEventListener('click', tap(() => { this.setMode('detente'); this.replay(); }));
    $('#btnFace').addEventListener('click', tap(() => this.creator.open(false)));
    $('#accountBar').addEventListener('click', tap(() => this.account.open(false)));
    this.ui.modes.innerHTML = Object.entries(MODES).map(([k, m]) => `<button class="seg" data-mode="${k}">${m.label}</button>`).join('');
    this.ui.modes.querySelectorAll('.seg').forEach(b => b.addEventListener('click', tap(() => this.setMode(b.dataset.mode))));
    this.ui.modeHint = $('#modeHint');
    const muteBtns = [$('#btnMute'), $('#btnMute2')];
    const refreshMute = () => muteBtns.forEach(b => b.textContent = this.audio.muted ? '🔇 Son coupé' : '🔊 Son');
    muteBtns.forEach(b => b.addEventListener('click', () => { this.audio.init(); this.audio.setMuted(!this.audio.muted); refreshMute(); if (!this.audio.muted) this.audio.tap(); }));
    refreshMute();
    // remise à zéro en deux temps (les fenêtres modales sont bloquées dans une iframe)
    const reset = $('#btnReset');
    reset.addEventListener('click', () => {
      this.audio.init(); this.audio.tap();
      if (!this._resetArmed) {
        this._resetArmed = true;
        reset.textContent = '⚠️ Confirmer ?'; reset.classList.add('warn');
        clearTimeout(this._resetT);
        this._resetT = setTimeout(() => { this._resetArmed = false; reset.textContent = '↺ Progression'; reset.classList.remove('warn'); }, 4000);
        return;
      }
      clearTimeout(this._resetT); this._resetArmed = false;
      reset.textContent = '↺ Progression'; reset.classList.remove('warn');
      const st = this.progress.settings;
      this.progress = { levels: {}, settings: Object.assign(st, { outfit: 'blanc', world: 0 }), random: { played: 0 } };
      saveProgress(this.progress); this.menuWorld = 0; this.rebuildCharacter(); this.renderMenu(); this.ensurePreview(0, true);
      this.toast('Progression remise à zéro');
    });
    this.ui.banner.addEventListener('pointerdown', () => this.skipIntro());
  }
  firstUnfinished() { for (let i = 0; i < LEVELS.length; i++) if (!this.progress.levels[i]) return i; return 0; }
  mode() { return MODES[this.progress.settings.mode] || MODES.normal; }
  setMode(k) {
    if (!MODES[k]) return;
    this.progress.settings.mode = k; saveProgress(this.progress); this.renderModes(); this.renderLevels();
  }
  renderModes() {
    const k = this.progress.settings.mode;
    this.ui.modes.querySelectorAll('.seg').forEach(b => b.classList.toggle('active', b.dataset.mode === k));
    this.ui.modeHint.textContent = MODES[k].hint;
  }
  totalStars() { let n = 0; for (const k in this.progress.levels) n += this.progress.levels[k].rating || 0; return n; }
  outfit() { return OUTFITS.find(o => o.id === this.progress.settings.outfit) || OUTFITS[0]; }
  setOutfit(id) {
    const o = OUTFITS.find(x => x.id === id); if (!o) return;
    this.progress.settings.outfit = id; saveProgress(this.progress);
    this.rebuildCharacter(); this.renderOutfits();
  }
  /* Reconstruit le personnage (tenue, visage, peau) en conservant sa pose */
  rebuildCharacter() {
    const old = this.character;
    const pos = old.root.position.slice(), rot = old.root.rotation.slice(), mode = old.mode, t = old.t;
    const kill = (n) => { if (n.mesh) n.mesh.dispose(); n.children.forEach(kill); };
    this.scene.remove(old.root); kill(old.root);
    this.character = buildCharacter(this.gl, { tee: this.outfit().tee, face: this.face, skin: this.skin });
    this.character.root.position = pos; this.character.root.rotation = rot; this.character.mode = mode; this.character.t = t;
    this.scene.add(this.character.root);
  }
  /* Photo du visage : texture + teinte de peau ; save = mémoriser sur l'appareil */
  setFace(canvas, save) {
    const had = !!this.face, oldSkin = this.skin;
    if (canvas) {
      if (!this.faceCanvas) { this.faceCanvas = document.createElement('canvas'); this.faceCanvas.width = this.faceCanvas.height = FACE_SIZE; }
      const x = this.faceCanvas.getContext('2d'); x.clearRect(0, 0, FACE_SIZE, FACE_SIZE); x.drawImage(canvas, 0, 0, FACE_SIZE, FACE_SIZE);
      this.face = makeTexture(this.gl, this.faceCanvas, this.face);
      this.skin = skinFromCanvas(this.faceCanvas);
    } else {
      if (this.face) this.gl.deleteTexture(this.face);
      this.face = null; this.faceCanvas = null; this.skin = null;
    }
    // la texture est mise à jour en place : ne reconstruit que si la présence ou la peau change
    const skinMoved = !oldSkin !== !this.skin || (oldSkin && this.skin && oldSkin.some((c, i) => Math.abs(c - this.skin[i]) > 0.035));
    if (had !== !!this.face || skinMoved) this.rebuildCharacter();
    if (save) { try { canvas ? localStorage.setItem(faceKey(), this.faceCanvas.toDataURL('image/jpeg', 0.85)) : localStorage.removeItem(faceKey()); } catch (e) { } if (!ACCOUNTS.isGuest()) this.flashSaved(); }
  }
  /* Recharge tout l'état propre au compte courant (progression, tenue, visage) */
  switchAccount() {
    this.progress = loadProgress();
    this.menuWorld = clamp(this.progress.settings.world | 0, 0, WORLDS.length - 1);
    if (this.face) { this.gl.deleteTexture(this.face); this.face = null; this.faceCanvas = null; this.skin = null; }
    this.rebuildCharacter();
    this.loadSavedFace();
    if (this.state === 'menu') { this.renderMenu(); this.ensurePreview(this.menuWorld, true); this.placeOnStage(); }
  }
  flashSaved(txt) {
    const e = $('#saved'); e.textContent = '💾 ' + (txt || 'Sauvegardé'); e.classList.remove('hidden');
    e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
    clearTimeout(this._savedT); this._savedT = setTimeout(() => e.classList.add('hidden'), 2200);
  }
  loadSavedFace() {
    let d = null; try { d = localStorage.getItem(faceKey()); } catch (e) { }
    if (!d) return;
    this._faceLoading = true;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = FACE_SIZE;
      c.getContext('2d').drawImage(img, 0, 0, FACE_SIZE, FACE_SIZE);
      this.setFace(c, false); this._faceLoading = false;
      if (this.state === 'menu') this.renderMenu();
    };
    img.onerror = () => { this._faceLoading = false; };
    img.src = d;
  }
  renderOutfits() {
    const el = this.ui.outfits; el.innerHTML = '';
    const stars = this.totalStars(), cur = this.progress.settings.outfit;
    for (const o of OUTFITS) {
      const b = document.createElement('button');
      const locked = stars < o.need;
      b.className = 'outfit' + (o.id === cur ? ' active' : '') + (locked ? ' locked' : '');
      b.style.background = o.tee; b.title = o.name;
      b.innerHTML = (o.id === cur ? '✓' : '') + (locked ? `<span class="lk">⭐ ${o.need}</span>` : '');
      b.addEventListener('click', () => {
        this.audio.init();
        if (locked) { this.toast(`Gagne ${o.need - stars} étoile${o.need - stars > 1 ? 's' : ''} de plus pour ${o.name.toLowerCase()} 🔒`); return; }
        this.audio.tap(); this.setOutfit(o.id); this.bubbleSay(`Trop beau, le t-shirt ${o.name.toLowerCase()} !`);
      });
      el.appendChild(b);
    }
  }
  bubbleSay(txt) { const b = this.ui.bubble; b.textContent = txt; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; }
  isUnlocked(i) { return i === 0 || !!this.progress.levels[i - 1] || !!this.progress.levels[i]; }
  worldStats(wi) {
    let done = 0, stars = 0;
    for (let k = 0; k < 5; k++) { const p = this.progress.levels[wi * 5 + k]; if (p) { done++; stars += p.rating || 0; } }
    return { done, stars, unlocked: this.isUnlocked(wi * 5) };
  }

  renderMenu() {
    const fu = this.firstUnfinished(), all = Object.keys(this.progress.levels).length >= LEVELS.length;
    $('#btnPlay').textContent = fu === 0 && !this.progress.levels[0] ? '▶ Commencer la démo' : (all ? '▶ Rejouer' : `▶ Jouer · niveau ${fu}`);
    const total = this.totalStars();
    this.ui.starsTotal.textContent = `⭐ ${total} / ${MAX_STARS}`;
    this.renderModes(); this.renderOutfits(); this.renderWorlds(); this.renderLevels();
    $('#btnFace').textContent = this.faceCanvas ? '📸 Changer mon visage' : '📸 Mettre mon visage';
    const bar = $('#accountBar'), guest = ACCOUNTS.isGuest();
    bar.classList.toggle('guest', guest);
    bar.innerHTML = guest ? '<span class="ab-av">👤</span><span>Invité</span><span class="ab-cta">Créer un compte ›</span>'
      : `<span class="ab-av">${this.faceCanvas ? '<img alt="">' : '👤'}</span><span class="ab-name"></span><span class="ab-cta">💾 auto</span>`;
    if (!guest) { bar.querySelector('.ab-name').textContent = ACCOUNTS.displayName(); const im = bar.querySelector('img'); if (im) im.src = this.faceCanvas.toDataURL('image/jpeg', 0.7); }
    const done = Object.keys(this.progress.levels).length;
    if (done === 0) this.bubbleSay('Salut ! Prêt à sortir du labyrinthe ?');
    else if (all) this.bubbleSay(total >= MAX_STARS ? 'Tu as TOUT réussi ! Légende 👑' : 'Tous les niveaux finis ! Vise les 3 étoiles ⭐');
    else this.bubbleSay(['On continue l’aventure ?', 'Encore un labyrinthe ?', 'Prêt pour la suite ?', 'Allez, on y va !'][done % 4]);
  }
  renderWorlds() {
    const el = this.ui.worlds; el.innerHTML = '';
    WORLDS.forEach((W, wi) => {
      const st = this.worldStats(wi), th = THEMES[W.theme];
      const b = document.createElement('button');
      b.className = 'wcard' + (wi === this.menuWorld ? ' active' : '') + (st.unlocked ? '' : ' locked') + (st.done === 5 ? ' done' : '');
      b.style.setProperty('--c1', th.sky[0]); b.style.setProperty('--c2', th.sky[1]);
      b.innerHTML = `<div class="w-emoji">${W.emoji}</div>
        <div class="w-name">${W.name}</div>
        <div class="w-meta">Monde ${wi + 1}${st.unlocked ? ` · ${st.done}/5` : ''}</div>
        <div class="w-bar">${[0, 1, 2, 3, 4].map(k => `<i class="${this.progress.levels[wi * 5 + k] ? 'on' : ''}"></i>`).join('')}</div>
        <div class="w-stars">${st.unlocked ? `⭐ ${st.stars}/15` : '🔒'}</div>`;
      b.addEventListener('click', () => {
        this.audio.init();
        if (!st.unlocked) { this.toast(`Termine le monde ${wi} pour débloquer ${W.name} 🔒`); return; }
        this.selectWorld(wi);
      });
      el.appendChild(b);
    });
    requestAnimationFrame(() => this.centerWorldCard(false));
  }
  /* Centre la carte du monde actif dans le carrousel sans faire défiler le menu */
  centerWorldCard(smooth) {
    const el = this.ui.worlds, c = el.children[this.menuWorld]; if (!c) return;
    el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  }
  selectWorld(wi) {
    if (wi === this.menuWorld) return;
    this.menuWorld = wi; this.progress.settings.world = wi; saveProgress(this.progress);
    this.ui.worlds.querySelectorAll('.wcard').forEach((c, i) => c.classList.toggle('active', i === wi));
    this.centerWorldCard(true);
    this.renderLevels();
    this.audio.swoosh();
    this.ensurePreview(wi, true);
    const lines = ['Direction la prairie !', 'Bienvenue dans la jungle !', 'Sable chaud et cocotiers !', 'Attention à la chaleur…', 'Ça grimpe, ici !', 'Les feuilles tombent…', 'Ça chauffe, ça chauffe !', 'Brrr, on se couvre !', 'Lumières de la ville !', 'Cap sur les étoiles ! 🚀'];
    this.bubbleSay(lines[wi] || 'C’est parti !');
  }
  renderLevels() {
    const el = this.ui.levels; el.innerHTML = '';
    const wi = this.menuWorld, W = WORLDS[wi];
    let focus = -1;
    for (let k = 0; k < 5; k++) {
      const i = wi * 5 + k, L = LEVELS[i], done = this.progress.levels[i], unlocked = this.isUnlocked(i);
      if (focus < 0 && unlocked && !done) focus = i;
      const b = document.createElement('button');
      b.className = 'lv' + (unlocked ? '' : ' locked') + (done ? ' done' : '') + (done && done.rating === 3 ? ' perfect' : '');
      b.innerHTML = `<div class="lv-num">${i === 0 ? 'Démo' : i}</div><div class="lv-var">${unlocked ? L.vEmoji : '🔒'}</div>
        <div class="lv-stars">${[1, 2, 3].map(s => `<span class="${done && s <= done.rating ? 'on' : ''}">★</span>`).join('')}</div>`;
      b.addEventListener('click', () => {
        this.audio.init();
        if (!unlocked) { this.toast('Termine le niveau précédent pour débloquer 🔒'); return; }
        this.audio.tap(); this.startLevel(i);
      });
      el.appendChild(b);
    }
    if (focus < 0) focus = this.isUnlocked(wi * 5) ? wi * 5 : -1;
    // fiche du prochain niveau du monde
    const info = this.ui.levelInfo;
    if (focus < 0) { info.classList.add('hidden'); return; }
    const L = LEVELS[focus], done = this.progress.levels[focus];
    const maze = generateMaze(L.size, L.size, L.seed);
    const limit = L.demo ? Infinity : timeLimit(L, maze) * this.mode().timeMul;
    const th = THEMES[L.theme];
    info.style.setProperty('--c1', th.sky[0]); info.style.setProperty('--c2', th.sky[1]);
    info.innerHTML = `<div class="li-emoji">${L.emoji}<span>${L.vEmoji}</span></div>
      <div class="li-body">
        <div class="li-name">${L.demo ? 'Démo' : 'Niveau ' + focus} · ${L.name}</div>
        <div class="li-meta">${levelTier(L)} · ${L.size}×${L.size} · ⏱ ${fmtTime(limit)}${done && isFinite(done.best) ? ` · meilleur <b>${fmtTime(done.best)}</b>` : ''}</div>
      </div><div class="li-go">›</div>`;
    info.classList.remove('hidden');
    info.onclick = () => { this.audio.init(); this.audio.tap(); this.startLevel(focus); };
  }

  /* Labyrinthe surprise : décor, ambiance et taille aléatoires */
  startRandom() {
    const themes = Object.keys(THEMES).filter(t => t !== 'prairie');
    const theme = themes[Math.floor(Math.random() * themes.length)];
    const vk = Object.keys(VARIANTS), variant = vk[Math.floor(Math.random() * vk.length)];
    const size = 7 + Math.floor(Math.random() * 10);
    const W = WORLDS.find(w => w.theme === theme) || WORLDS[1];
    this.play({
      index: -1, random: true, world: WORLDS.indexOf(W), name: W.name + ' surprise', emoji: '🎲', vEmoji: VARIANTS[variant].emoji,
      theme, variant, size, seed: Math.floor(Math.random() * 1e9), tight: lerp(0.15, 0.9, (size - 7) / 9), demo: false,
    });
  }
  startLevel(i) { this.play(LEVELS[clamp(i, 0, LEVELS.length - 1)]); }
  replay() { if (this.levelIndex === -1) this.play(this.level); else this.startLevel(this.levelIndex); }

  /* ---------- Menu ---------- */
  previewSpec(wi) {
    const W = WORLDS[wi];
    let k = 0; for (; k < 5; k++) if (!this.progress.levels[wi * 5 + k]) break;
    if (k >= 5) k = 0;
    const variant = W.variants[k];
    return { index: -2, preview: true, key: `p/${wi}/${variant}`, name: W.name, emoji: W.emoji, theme: W.theme, variant, size: PREVIEW_SIZE, seed: 7000 + wi * 13 + k, demo: false, tight: 0 };
  }
  ensurePreview(wi, fade) {
    const spec = this.previewSpec(wi);
    if (this.level && this.level.key === spec.key) return;
    const load = () => { this.loadLevel(spec); this.placeOnStage(); };
    if (fade) this.fadeTo(load); else load();
  }
  fadeTo(fn) {
    const f = this.ui.fade; f.classList.add('on');
    setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove('on')); }, 190);
  }
  /* Le personnage vient saluer sur la "scène" devant le labyrinthe */
  placeOnStage() {
    const P = this.player; P.x = this.maze.w * CS / 2; P.z = this.maze.h * CS + 2.8;
    this.character.root.position = [P.x, 0, P.z];
    this.menuAngle = 0.35;
    this.character.mode = 'wave'; this.character.t = 0;
    this.character.root.rotation[1] = 0.35;
    this.cam.pos = [P.x + 1, 1.5, P.z + 3]; this.cam.target = [P.x, 0.6, P.z];
  }
  showMenu() {
    this.state = 'menu';
    this.audio.stopAmbient();
    this.ui.hud.classList.add('hidden'); this.ui.pause.classList.add('hidden'); this.ui.result.classList.add('hidden'); this.ui.banner.classList.add('hidden');
    this.ui.menu.classList.remove('hidden');
    // revient sur le monde du dernier niveau joué (ou le suivant s'il vient d'être débloqué)
    if (this.level && this.levelIndex >= 0) {
      const L = this.level, next = L.world + 1;
      this.menuWorld = (L.step === 4 && next < WORLDS.length && this.isUnlocked(next * 5)) ? next : L.world;
      this.progress.settings.world = this.menuWorld; saveProgress(this.progress);
    }
    this.renderMenu();
    this.ensurePreview(this.menuWorld, false);
    this.placeOnStage();
    this.hideJoy();
    if (this.accountOpen) return;
    if (ACCOUNTS.current() === null) { setTimeout(() => { if (this.state === 'menu' && !this.accountOpen) this.account.open(true); }, 500); return; }
    if (!this.faceCanvas && !this.progress.settings.faceAsked && !this._faceLoading && !this.creatorOpen) setTimeout(() => { if (this.state === 'menu' && !this.accountOpen) this.creator.open(true); }, 700);
  }
  toast(msg, ms = 1800) {
    const t = this.ui.toast; t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(this._toastT); this._toastT = setTimeout(() => t.classList.add('hidden'), ms);
  }
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.ui.pause.classList.remove('hidden'); this.hideJoy(); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.ui.pause.classList.add('hidden'); this.last = 0; }

  /* ---------- Chargement d'un niveau ---------- */
  disposeWorld() {
    const kill = (n) => { if (!n) return; if (n.mesh) n.mesh.dispose(); n.children.forEach(kill); };
    if (this.worldNodes) this.worldNodes.forEach(kill);
    if (this.flock) { this.flock.dispose(); this.flock = null; }
    this.worldNodes = [];
    this.scene.children.length = 0;
  }
  loadLevel(spec) {
    this.disposeWorld();
    this.level = spec; this.levelIndex = spec.index;
    this.maze = generateMaze(spec.size, spec.size, spec.seed);
    this.limit = (spec.demo || spec.preview) ? Infinity : timeLimit(spec, this.maze) * this.mode().timeMul;
    const built = buildWorld(this.gl, spec, this.maze);
    this.theme = built.theme;
    this.worldNodes = [built.world, built.sky, built.clouds].filter(Boolean);
    this.sky = built.sky; this.clouds = built.clouds;
    this.scene.add(built.sky); this.scene.add(built.world); if (built.clouds) this.scene.add(built.clouds);
    // lumière
    const th = this.theme, R = this.renderer.light, sd = th.sun, l = Math.hypot(sd[0], sd[1], sd[2]);
    R.sunDir = [sd[0] / l, sd[1] / l, sd[2] / l]; R.sunCol = th.sunCol; R.sky = hex(th.hemiSky); R.ground = hex(th.hemiGround);
    R.fog = hex(th.fog); R.fogDensity = th.fogDensity; this.baseFog = th.fogDensity; R.flash = 0;
    this.lightningT = th.lightning ? 1.5 + Math.random() * 3 : 0; this.flashPow = 0; this.flashN = 0;
    // portail
    this.portal = buildPortal(this.gl, th.accent);
    this.portal.node.position = [this.maze.exit[0] * CS + CS / 2, 0, this.maze.exit[1] * CS + CS / 2];
    this.scene.add(this.portal.node); this.worldNodes.push(this.portal.node);
    this.portalT = 0; this.portalCol = hex(th.accent);
    // étoiles + halos au sol
    this.stars = this.maze.stars.map(([cx, cz]) => {
      const n = new Node(this.starMesh); n.position = [cx * CS + CS / 2, 0.8, cz * CS + CS / 2]; n.cell = cz * this.maze.w + cx; n.collected = false;
      const h = new Node(this.haloMesh); h.position = [n.position[0], 0.02, n.position[2]]; h.alpha = 0.25; h.additive = true; n.halo = h;
      this.scene.add(h); this.scene.add(n); return n;
    });
    this.collected = 0;
    for (const r of this.rings) { r.visible = false; this.scene.add(r); }
    // créatures
    const W = this.maze.w * CS, H = this.maze.h * CS;
    this.flock = new Flock(this.gl, spec.theme, W, H, mulberry32(spec.seed + 99));
    this.scene.add(this.flock.root);
    // joueur
    const s = this.maze.start;
    this.player = { x: s[0] * CS + CS / 2, z: s[1] * CS + CS / 2, vx: 0, vz: 0, facing: 0, cell: s[1] * this.maze.w + s[0], moved: 0 };
    this.character.root.position = [this.player.x, 0, this.player.z];
    this.character.root.rotation = [0, 0, 0];
    this.character.mode = 'idle';
    this.scene.add(this.arrow); this.scene.add(this.character.root);
    this.arrow.visible = false; this.hintUntil = 0;
    this.visited = new Uint8Array(this.maze.w * this.maze.h); this.reveal(this.player.cell);
    if (spec.demo) this.visited.fill(1);
    this.elapsed = 0; this.lastTick = -1;
    this.initParticles(th.particles);
    this.fx.count = 0;
    this.setupMinimap();
  }
  play(spec) {
    if (this.creatorOpen) this.creator.close();
    this.loadLevel(spec);
    const i = spec.index;
    this.audio.init();
    this.audio.startAmbient(spec.theme);
    this.ui.menu.classList.add('hidden'); this.ui.pause.classList.add('hidden'); this.ui.result.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.ui.lvl.textContent = `${spec.emoji} ${i === 0 ? 'Démo' : i < 0 ? 'Surprise' : 'Niv. ' + i}`;
    this.ui.hint.style.display = (spec.demo || this.mode().noHint) ? 'none' : '';
    this.ui.tbar.classList.toggle('hidden', !isFinite(this.limit));
    this.dustT = 0;
    this.updateHud();
    // intro (survol du labyrinthe)
    this.state = 'intro'; this.introT = 0;
    const W = this.maze.w * CS, H = this.maze.h * CS;
    const tanV = Math.tan(this.renderer.fov / 2), tanH = tanV * this.renderer.aspect;
    const dist = clamp(Math.max(W / (2 * tanH), H / (2 * tanV)) * 1.05 + 4, 12, 95);
    this.introFrom = [W / 2, dist * 0.92, H / 2 + dist * 0.42];
    this.introLook = [W / 2, 0, H / 2];
    this.cam.pos = this.introFrom.slice(); this.cam.target = this.introLook.slice();
    const b = this.ui.banner, mode = this.mode();
    b.querySelector('.b-eyebrow').textContent = spec.demo ? 'Démo · apprentissage' : i < 0 ? 'Labyrinthe surprise' : `Monde ${spec.world + 1} · ${WORLDS[spec.world].name}`;
    b.querySelector('.b-emoji').textContent = spec.emoji;
    b.querySelector('.b-title').textContent = spec.demo ? spec.name : i < 0 ? spec.name : `Niveau ${i}`;
    b.querySelector('.b-sub').textContent = spec.demo ? 'Apprends à jouer, sans limite de temps.' : (i < 0 ? '' : spec.name + ' · ') + (spec.demo ? '' : levelTier(spec));
    b.querySelector('.b-chips').innerHTML = [
      `<span>${isFinite(this.limit) ? '⏱ ' + fmtTime(this.limit) : '⏱ sans chrono'}</span>`,
      `<span>🧩 ${spec.size}×${spec.size}</span>`,
      `<span>⭐ ×3</span>`,
      spec.demo ? '' : `<span>${mode.label}</span>`,
    ].join('');
    b.classList.remove('hidden');
    this.tutorialStep = spec.demo ? 0 : -1;
    this.ui.tip.classList.add('hidden');
    this.audio.portal();
  }
  skipIntro() { if (this.state === 'intro') this.introT = INTRO_DUR - 0.35; }
  beginPlay() {
    this.state = 'playing'; this.ui.banner.classList.add('hidden'); this.last = 0;
    this.renderer.light.fogDensity = this.baseFog;
    if (this.tutorialStep === 0) this.showTutorial();
    else this.toast('C’est parti ! 🏁', 1200);
  }
  showTutorial() {
    const tips = [
      '👆 Glisse ton pouce n’importe où sur l’écran pour te déplacer.',
      '➡️ Suis la flèche dorée : elle indique le chemin vers la sortie.',
      '⭐ Ramasse les étoiles sur ton chemin pour gagner des bonus !',
      '🌀 Entre dans le portail lumineux pour sortir du labyrinthe !',
    ];
    if (this.tutorialStep >= 0 && this.tutorialStep < tips.length) { this.ui.tip.textContent = tips[this.tutorialStep]; this.ui.tip.classList.remove('hidden'); }
    else this.ui.tip.classList.add('hidden');
  }
  useHint() {
    if (this.state !== 'playing' || this.level.demo || this.mode().noHint) return;
    if (this.time < this.hintUntil) return;
    this.audio.init(); this.audio.hint();
    this.hintUntil = this.time + 4.5;
    if (isFinite(this.limit) && !this.mode().hintFree) { this.elapsed += 5; this.toast('💡 Indice : −5 s', 1400); }
    else this.toast('💡 Suis la flèche !', 1200);
  }

  /* ---------- Entrées ---------- */
  bindInput() {
    const layer = $('#touch'), I = this.input;
    layer.addEventListener('pointerdown', (e) => {
      e.preventDefault(); this.audio.init();
      if (this.state === 'intro') { this.skipIntro(); return; }
      if (this.state !== 'playing') return;
      if (I.joyId !== null) return;
      I.joyId = e.pointerId; I.origin = [e.clientX, e.clientY];
      try { layer.setPointerCapture(e.pointerId); } catch (err) { }
      this.ui.joy.style.left = e.clientX + 'px'; this.ui.joy.style.top = e.clientY + 'px';
      this.ui.joy.classList.add('on'); this.ui.knob.style.transform = 'translate(-50%,-50%)';
    });
    const move = (e) => {
      if (e.pointerId !== I.joyId) return;
      e.preventDefault();
      let dx = e.clientX - I.origin[0], dy = e.clientY - I.origin[1];
      const d = Math.hypot(dx, dy), max = 56;
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      this.ui.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m = Math.min(1, d / max);
      const dz = m < 0.12 ? 0 : (m - 0.12) / 0.88;
      I.joy = d > 0 ? [dx / max * (dz / (m || 1)), dy / max * (dz / (m || 1))] : [0, 0];
    };
    const end = (e) => { if (e.pointerId !== I.joyId) return; I.joyId = null; I.joy = [0, 0]; this.hideJoy(); };
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', end); layer.addEventListener('pointercancel', end); layer.addEventListener('lostpointercapture', end);
    window.addEventListener('keydown', (e) => {
      I.keys[e.key] = true;
      if (e.key === 'Escape' || e.key === 'p') { if (this.state === 'playing') this.pause(); else if (this.state === 'paused') this.resume(); }
      if (e.key === 'h') this.useHint();
      if (this.state === 'intro' && (e.key === ' ' || e.key === 'Enter')) this.skipIntro();
    });
    window.addEventListener('keyup', (e) => { I.keys[e.key] = false; });
    document.addEventListener('touchmove', (e) => { if (e.target.closest && !e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }
  hideJoy() { this.ui.joy.classList.remove('on'); this.input.joyId = null; this.input.joy = [0, 0]; }
  inputVector() {
    const I = this.input; let x = I.joy[0], z = I.joy[1];
    const k = I.keys;
    if (k.ArrowLeft || k.a || k.q) x -= 1; if (k.ArrowRight || k.d) x += 1;
    if (k.ArrowUp || k.w || k.z) z -= 1; if (k.ArrowDown || k.s) z += 1;
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return [x, z];
  }

  /* Révèle une cellule et ses voisines accessibles sur la mini-carte */
  reveal(cell) {
    const { w, h, walls } = this.maze;
    const mark = (c) => { if (!this.visited[c]) { this.visited[c] = 1; this.mm.dirty = true; } };
    mark(cell);
    const x = cell % w, z = Math.floor(cell / w), b = walls[cell];
    if (!(b & 1) && z > 0) mark(cell - w);
    if (!(b & 4) && z < h - 1) mark(cell + w);
    if (!(b & 8) && x > 0) mark(cell - 1);
    if (!(b & 2) && x < w - 1) mark(cell + 1);
  }

  /* ---------- Collisions ---------- */
  collides(x, z, r) {
    const { w, h, walls } = this.maze;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const hit = (x0, x1, z0, z1) => {
      const qx = clamp(x, x0, x1), qz = clamp(z, z0, z1);
      return (qx - x) * (qx - x) + (qz - z) * (qz - z) < r * r;
    };
    for (let j = cz - 1; j <= cz + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) {
      if (i < 0 || j < 0 || i >= w || j >= h) continue;
      const b = walls[j * w + i];
      const X = i * CS, Z = j * CS, t = WT / 2;
      if ((b & 1) && hit(X - t, X + CS + t, Z - t, Z + t)) return true;
      if ((b & 4) && hit(X - t, X + CS + t, Z + CS - t, Z + CS + t)) return true;
      if ((b & 8) && hit(X - t, X + t, Z - t, Z + CS + t)) return true;
      if ((b & 2) && hit(X + CS - t, X + CS + t, Z - t, Z + CS + t)) return true;
    }
    return false;
  }

  /* ---------- Boucle ---------- */
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    if (!this.last) { this.last = t; return; }
    let dt = (t - this.last) / 1000; this.last = t;
    if (dt > 0.05) dt = 0.05;
    this.time += dt;
    this.update(dt);
    this.render();
  }
  update(dt) {
    const P = this.player, ch = this.character, t = this.time;
    // animations décor
    this.portal.ring1.rotation[1] += dt * 1.2; this.portal.ring2.rotation[1] -= dt * 2.0;
    this.portal.ring2.position[1] = 0.3 + Math.sin(t * 2) * 0.08;
    this.portal.star.rotation[1] += dt * 1.5; this.portal.star.position[1] = 1.6 + Math.sin(t * 2.5) * 0.15;
    this.portal.beam.alpha = 0.18 + Math.sin(t * 3) * 0.06;
    for (const s of this.stars) {
      if (s.collected) continue;
      s.rotation[1] += dt * 2.5; s.position[1] = 0.8 + Math.sin(t * 3 + s.cell) * 0.1;
      const k = 1 + Math.sin(t * 3 + s.cell) * 0.18; s.halo.scale = [k, 1, k]; s.halo.alpha = 0.2 + Math.sin(t * 3 + s.cell) * 0.08;
    }
    if (this.clouds) { this.clouds.position[0] += dt * (this.theme.lightning ? 1.2 : 0.35); if (this.clouds.position[0] > 40) this.clouds.position[0] = -40; }
    this.renderer.glow = 1 + Math.sin(t * 2.6) * 0.08 + Math.sin(t * 7.3) * 0.03;
    if (this.theme.lightning) this.updateLightning(dt); else this.renderer.light.flash = 0;
    if (this.flock) this.flock.update(dt, t);
    this.updateRings(dt);
    this.emitPortal(dt);
    this.updateParticles(dt); this.updateFx(dt);

    if (this.state === 'menu') {
      // menu : la caméra tourne doucement ; atelier : elle reste face au visage, plus près
      const cr = this.creatorOpen || this.accountOpen;
      this.menuAngle = cr ? Math.sin(t * 0.5) * 0.12 : 0.35 + Math.sin(t * 0.35) * 0.35;
      const r = cr ? 3.2 : 4.4;
      this.cam.pos = [P.x + Math.sin(this.menuAngle) * r, (cr ? 1.15 : 1.3) + Math.sin(t * 0.5) * 0.08, P.z + Math.cos(this.menuAngle) * r];
      // décale la visée pour que le personnage apparaisse dans la zone "hero" du menu (ou de l'atelier)
      const rect = (this.accountOpen ? this.ui.acHero : cr ? this.ui.crHero : this.ui.hero).getBoundingClientRect();
      const cy = (rect.top + rect.height * (cr ? 0.5 : 0.58)) / window.innerHeight;
      const ndc = (0.5 - cy) * 2;
      const ty = (cr ? 0.95 : 0.62) - ndc * r * Math.tan(this.renderer.fov / 2) * 0.95;
      this.cam.target = [P.x, ty, P.z];
      ch.root.rotation[1] = this.menuAngle;
      ch.update(dt, 0);
    } else if (this.state === 'intro') {
      this.introT += dt;
      const p = smoothstep(this.introT / INTRO_DUR);
      const fp = this.followPos(), ft = this.followTarget();
      this.cam.pos = [lerp(this.introFrom[0], fp[0], p), lerp(this.introFrom[1], fp[1], p), lerp(this.introFrom[2], fp[2], p)];
      this.cam.target = [lerp(this.introLook[0], ft[0], p), lerp(this.introLook[1], ft[1], p), lerp(this.introLook[2], ft[2], p)];
      this.renderer.light.fogDensity = this.baseFog * lerp(0.22, 1, p);
      ch.root.rotation[1] = 0;
      ch.update(dt, 0);
      if (this.introT >= INTRO_DUR) this.beginPlay();
    } else if (this.state === 'playing') {
      this.updatePlayer(dt);
      this.updateCamera(dt);
      if (isFinite(this.limit)) {
        const rem = this.limit - this.elapsed;
        if (rem <= 10) {
          const s = Math.ceil(rem);
          if (s !== this.lastTick && rem > 0) { this.lastTick = s; this.audio.tick(); }
        }
        if (rem <= 0) this.lose();
      }
    } else if (this.state === 'won') {
      ch.update(dt, 0);
      ch.root.position[1] = ch.jump;
      this.winT += dt;
      this.updateWinCamera(dt);
      // feu d'artifice
      this.fwT -= dt;
      if (this.fwT <= 0 && this.winT < 3.2) {
        this.fwT = 0.3;
        const p = this.portal.node.position;
        const c = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
        this.burst([p[0] + (Math.random() - 0.5) * 6, 2.5 + Math.random() * 2.5, p[2] + (Math.random() - 0.5) * 6], [c, [1, 1, 1]], 46, 3.8, 1.3, -2.2);
      }
      if (this.winT > 1.9 && this.ui.result.classList.contains('hidden')) this.showResult(true);
    } else if (this.state === 'lost') {
      ch.update(dt, 0);
      this.updateCamera(dt);
      this.winT += dt;
      if (this.winT > 1.0 && this.ui.result.classList.contains('hidden')) this.showResult(false);
    }
    // flèche d'aide
    const showArrow = this.state === 'playing' && (this.level.demo || t < this.hintUntil);
    this.arrow.visible = showArrow;
    if (showArrow) {
      const nx = this.maze.next[P.cell];
      let tx, tz;
      if (nx >= 0) { tx = (nx % this.maze.w) * CS + CS / 2; tz = Math.floor(nx / this.maze.w) * CS + CS / 2; }
      else { tx = this.portal.node.position[0]; tz = this.portal.node.position[2]; }
      this.arrow.position = [P.x, 1.75 + Math.sin(t * 4) * 0.08, P.z];
      this.arrow.rotation[1] = Math.atan2(tx - P.x, tz - P.z);
    }
    this.sky.position = this.cam.pos.slice();
    this.updateHud();
  }
  /* Éclairs d'orage : flash principal puis 1 à 2 répliques, tonnerre différé */
  updateLightning(dt) {
    const L = this.renderer.light;
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.lightningT = 3.5 + Math.random() * 6;
      this.flashPow = 0.9; this.flashN = 1 + Math.floor(Math.random() * 2);
      if (this.state !== 'menu') this.audio.thunder(0.3 + Math.random() * 0.7);
    }
    if (this.flashPow > 0) {
      L.flash = this.flashPow * (0.55 + 0.45 * Math.random());
      this.flashPow -= dt * 4.5;
      if (this.flashPow <= 0 && this.flashN > 0) { this.flashN--; this.flashPow = 0.35 + Math.random() * 0.4; }
    } else L.flash = 0;
  }
  spawnRing(x, z) {
    const r = this.rings[this.ringI++ % this.rings.length];
    r.visible = true; r.t = 0; r.position = [x, 0.06, z]; r.scale = [0.3, 1, 0.3]; r.alpha = 0.9;
  }
  updateRings(dt) {
    for (const r of this.rings) {
      if (!r.visible) continue;
      r.t += dt; const p = r.t / 0.55;
      if (p >= 1) { r.visible = false; continue; }
      const s = 0.3 + p * 2.4; r.scale = [s, 1, s]; r.alpha = (1 - p) * 0.9;
    }
  }
  /* Le portail souffle des étincelles qui montent en spirale */
  emitPortal(dt) {
    this.portalT -= dt;
    if (this.portalT > 0) return;
    this.portalT = 0.055;
    const p = this.portal.node.position, c = this.portalCol;
    for (let k = 0; k < 2; k++) {
      const a = Math.random() * Math.PI * 2, r = 0.72;
      this.spawn(p[0] + Math.cos(a) * r, 0.1 + Math.random() * 0.2, p[2] + Math.sin(a) * r,
        k ? c : [1, 1, 1], -Math.sin(a) * 0.9, 1.4 + Math.random() * 0.8, Math.cos(a) * 0.9, 1.3, 2 + Math.random() * 2, 0.6);
    }
  }
  followPos() { const P = this.player; return [P.x + P.vx * 0.10, CAM_H, P.z + CAM_D + P.vz * 0.06]; }
  followTarget() { const P = this.player; return [P.x + P.vx * 0.22, 0.4, P.z - 0.9 + P.vz * 0.14]; }
  updateCamera(dt) {
    const k = 1 - Math.exp(-dt * 7);
    const fp = this.followPos(), ft = this.followTarget();
    for (let i = 0; i < 3; i++) { this.cam.pos[i] = lerp(this.cam.pos[i], fp[i], k); this.cam.target[i] = lerp(this.cam.target[i], ft[i], k); }
  }
  /* Victoire : la caméra descend et tourne autour du héros */
  updateWinCamera(dt) {
    const P = this.player, a = this.winT * 0.75 + 0.5, r = 4.0;
    const fp = [P.x + Math.sin(a) * r, 2.6, P.z + Math.cos(a) * r], ft = [P.x, 0.9, P.z];
    const k = 1 - Math.exp(-dt * 3.2);
    for (let i = 0; i < 3; i++) { this.cam.pos[i] = lerp(this.cam.pos[i], fp[i], k); this.cam.target[i] = lerp(this.cam.target[i], ft[i], k); }
  }
  updatePlayer(dt) {
    const P = this.player, ch = this.character;
    const [ix, iz] = this.inputVector();
    const tvx = ix * PLAYER_SPEED, tvz = iz * PLAYER_SPEED;
    const k = 1 - Math.exp(-dt * 14);
    P.vx = lerp(P.vx, tvx, k); P.vz = lerp(P.vz, tvz, k);
    const sp = Math.hypot(P.vx, P.vz);
    let dx = P.vx * dt, dz = P.vz * dt;
    // déplacement avec glissement le long des murs
    let nx = P.x + dx;
    if (this.collides(nx, P.z, PLAYER_R)) { nx = P.x; P.vx *= 0.2; }
    let nz = P.z + dz;
    if (this.collides(nx, nz, PLAYER_R)) { nz = P.z; P.vz *= 0.2; }
    P.moved += Math.hypot(nx - P.x, nz - P.z);
    P.x = nx; P.z = nz;
    if (sp > 0.3) {
      const target = Math.atan2(P.vx, P.vz);
      let d = target - P.facing; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      P.facing += d * (1 - Math.exp(-dt * 14));
      if (sp > 1.2) this.audio.step();
      this.dustT -= dt;
      if (sp > 2.2 && this.dustT <= 0) {
        this.dustT = 0.11;
        const f = hex(this.theme.floor[1]); const c = [Math.min(1, f[0] + 0.25), Math.min(1, f[1] + 0.25), Math.min(1, f[2] + 0.25)];
        this.burst([P.x - Math.sin(P.facing) * 0.25, 0.12, P.z - Math.cos(P.facing) * 0.25], [c], 2, 0.7, 0.45);
      }
    }
    ch.root.position[0] = P.x; ch.root.position[2] = P.z; ch.root.position[1] = 0; ch.root.rotation[1] = P.facing;
    ch.mode = 'walk'; ch.update(dt, sp / PLAYER_SPEED);
    // cellule
    const cx = clamp(Math.floor(P.x / CS), 0, this.maze.w - 1), cz = clamp(Math.floor(P.z / CS), 0, this.maze.h - 1);
    const cell = cz * this.maze.w + cx;
    if (cell !== P.cell) { P.cell = cell; this.reveal(cell); }
    // temps
    this.elapsed += dt;
    // étoiles
    for (const s of this.stars) {
      if (s.collected) continue;
      const d = Math.hypot(s.position[0] - P.x, s.position[2] - P.z);
      if (d < 0.6) {
        s.collected = true; s.visible = false; s.halo.visible = false; this.collected++; this.audio.star();
        this.burst(s.position, [[1, 0.85, 0.2], [1, 1, 0.6]], 40, 3.5);
        this.spawnRing(s.position[0], s.position[2]);
        this.pop(this.collected === 3 ? 'Toutes les étoiles !' : POPS[Math.floor(Math.random() * POPS.length)]);
        if (this.tutorialStep === 2) { this.tutorialStep = 3; this.showTutorial(); }
      }
    }
    // tutoriel
    if (this.tutorialStep === 0 && P.moved > 1.5) { this.tutorialStep = 1; this.showTutorial(); }
    else if (this.tutorialStep === 1 && this.maze.distExit[cell] <= Math.max(1, this.maze.pathLen - 3)) { this.tutorialStep = 2; this.showTutorial(); }
    else if (this.tutorialStep === 2 && this.maze.distExit[cell] <= 1) { this.tutorialStep = 3; this.showTutorial(); }
    // sortie
    const ex = this.portal.node.position;
    if (Math.hypot(ex[0] - P.x, ex[2] - P.z) < 0.6) this.win();
  }
  win() {
    this.state = 'won'; this.winT = 0; this.fwT = 0.15;
    this.character.mode = 'win'; this.character.t = 0;
    this.audio.win(); this.hideJoy();
    this.arrow.visible = false; this.ui.tip.classList.add('hidden');
    const p = this.portal.node.position;
    this.burst([p[0], 1.2, p[2]], FIREWORK_COLORS, 220, 6);
    this.spawnRing(p[0], p[2]);
    const rem = this.limit - this.elapsed;
    let rating = 1;
    const timeStar = this.level.demo ? true : (isFinite(this.limit) && rem / this.limit >= TIME_STAR);
    if (timeStar) rating++;
    if (this.collected === 3) rating++;
    this.lastRating = rating; this.lastTimeStar = timeStar; this.newRecord = false; this.newWorld = null;
    if (this.levelIndex >= 0) {
      const i = this.levelIndex, prev = this.progress.levels[i];
      const best = prev && isFinite(prev.best) ? Math.min(prev.best, this.elapsed) : this.elapsed;
      if (prev && isFinite(prev.best) && this.elapsed < prev.best - 0.05) this.newRecord = true;
      const beforeStars = this.totalStars();
      this.progress.levels[i] = { rating: Math.max(rating, prev ? prev.rating : 0), best, stars: Math.max(this.collected, prev ? prev.stars : 0) };
      const after = this.totalStars();
      this.unlockedOutfits = OUTFITS.filter(o => o.need > beforeStars && o.need <= after);
      if (!prev && this.level.step === 4 && this.level.world < WORLDS.length - 1) this.newWorld = WORLDS[this.level.world + 1];
    } else {
      this.progress.random.played++;
      this.progress.random.best = Math.min(this.progress.random.best || Infinity, this.elapsed);
      this.unlockedOutfits = [];
    }
    saveProgress(this.progress);
    if (!ACCOUNTS.isGuest()) setTimeout(() => this.flashSaved(`Sauvegardé · ${ACCOUNTS.displayName()}`), 2200);
  }
  lose() {
    this.state = 'lost'; this.winT = 0; this.character.mode = 'lose';
    this.audio.lose(); this.hideJoy(); this.arrow.visible = false;
  }
  showResult(won) {
    const r = this.ui.result;
    r.querySelector('.r-title').textContent = won ? (this.lastRating === 3 ? 'Parfait ! 🏆' : 'Bravo ! 🎉') : 'Temps écoulé ! ⏰';
    r.querySelector('.r-stars').innerHTML = won ? [1, 2, 3].map(k => `<span class="${k <= this.lastRating ? 'on' : ''}" style="animation-delay:${k * 0.18}s">★</span>`).join('') : '';
    const lines = [];
    if (won) {
      lines.push(`⏱ Temps : <b>${fmtTime(this.elapsed)}</b>${isFinite(this.limit) ? ` / ${fmtTime(this.limit)}` : ''}${this.newRecord ? ' 🏅 <b>Nouveau record !</b>' : ''}`);
      lines.push(`⭐ Étoiles : <b>${this.collected} / 3</b>`);
      if (!this.lastTimeStar && !isFinite(this.limit)) lines.push('Joue en mode 🙂 Normal pour gagner l’étoile du chrono.');
      else if (!this.lastTimeStar) lines.push(`Finis avec ${Math.round(TIME_STAR * 100)} % du temps restant pour l’étoile du chrono.`);
      if (this.unlockedOutfits && this.unlockedOutfits.length) { lines.push(`👕 Nouvelle tenue débloquée : <b>${this.unlockedOutfits.map(o => o.name).join(', ')}</b> !`); this.audio.unlock(); }
      if (this.newWorld) lines.push(`🌍 Nouveau monde débloqué : <b>${this.newWorld.emoji} ${this.newWorld.name}</b> !`);
      if (this.level.demo) lines.push('Tu es prêt pour le niveau 1 ! 💪');
      else if (this.levelIndex === LEVELS.length - 1) lines.push('Tu as terminé les 50 niveaux ! 👑');
    } else {
      const left = this.maze.distExit[this.player.cell];
      lines.push(left <= 3 ? `Argh, tu étais à <b>${left} case${left > 1 ? 's' : ''}</b> de la sortie !` : `Il te restait <b>${left} cases</b> à parcourir. Pas grave, on réessaie !`);
      lines.push(this.mode().noHint ? 'En mode Expert, pas d’indice… Courage !' : 'Astuce : utilise 💡 pour voir le chemin quelques secondes.');
    }
    r.querySelector('.r-lines').innerHTML = lines.map(l => `<div>${l}</div>`).join('');
    const hasNext = won && (this.levelIndex < 0 || this.levelIndex < LEVELS.length - 1);
    $('#btnNext').style.display = hasNext ? '' : 'none';
    $('#btnNext').textContent = this.levelIndex < 0 ? '🎲 Un autre surprise' : '➡ Niveau suivant';
    $('#btnDetente').style.display = (!won && this.progress.settings.mode !== 'detente') ? '' : 'none';
    $('#btnRetry').textContent = won ? '↺ Rejouer' : '↺ Réessayer';
    r.classList.remove('hidden');
  }
  updateHud() {
    if (this.state === 'menu') return;
    const rem = this.limit - this.elapsed;
    const tm = this.ui.timer;
    tm.textContent = fmtTime(isFinite(this.limit) ? rem : Infinity);
    const low = isFinite(this.limit) && rem <= 10 && this.state === 'playing';
    tm.classList.toggle('low', low);
    this.ui.vignette.classList.toggle('on', low);
    if (isFinite(this.limit)) {
      const p = clamp(rem / this.limit, 0, 1);
      this.ui.tfill.style.width = (p * 100).toFixed(1) + '%';
      this.ui.tbar.classList.toggle('low', p < 0.25);
      this.ui.tbar.classList.toggle('star', p >= TIME_STAR);
    }
    this.ui.stars.textContent = `⭐ ${this.collected}/3`;
    this.ui.hint.classList.toggle('cool', this.time < this.hintUntil);
  }

  /* ---------- Particules d'ambiance ---------- */
  initParticles(type) {
    const cfg = PARTICLE_CFG[type] || PARTICLE_CFG.pollen; this.pCfg = cfg; const S = this.particles; S.count = cfg.count; S.additive = cfg.additive !== false;
    const d = S.data, P = this.player;
    for (let i = 0; i < cfg.count; i++) {
      const c = cfg.colors[i % cfg.colors.length];
      const o = i * 8;
      if (cfg.mode === 'dome') {
        const a = Math.random() * Math.PI * 2, e = Math.random() * 1.3 + 0.15, r = 200;
        this.pVel[i * 3] = Math.cos(a) * Math.cos(e) * r; this.pVel[i * 3 + 1] = Math.sin(e) * r; this.pVel[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
      } else {
        d[o] = P.x + (Math.random() - 0.5) * 28; d[o + 1] = Math.random() * 9; d[o + 2] = P.z + (Math.random() - 0.5) * 28;
        this.pVel[i * 3] = (Math.random() - 0.5) * 0.6; this.pVel[i * 3 + 1] = (Math.random() - 0.5) * 0.3; this.pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      }
      d[o + 3] = c[0]; d[o + 4] = c[1]; d[o + 5] = c[2]; d[o + 6] = cfg.alpha;
      this.pBase[i] = cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]);
      d[o + 7] = this.pBase[i];
      this.pPhase[i] = Math.random() * Math.PI * 2;
    }
  }
  updateParticles(dt) {
    const cfg = this.pCfg, S = this.particles, d = S.data, t = this.time, R = 14;
    const px = this.cam.target[0], pz = this.cam.target[2];
    for (let i = 0; i < S.count; i++) {
      const o = i * 8, ph = this.pPhase[i];
      if (cfg.mode === 'dome') {
        d[o] = px + this.pVel[i * 3]; d[o + 1] = this.pVel[i * 3 + 1]; d[o + 2] = pz + this.pVel[i * 3 + 2];
      } else if (cfg.mode === 'fall') {
        d[o + 1] -= cfg.speed * dt;
        d[o] += Math.sin(t * 1.5 + ph) * cfg.sway * dt;
        if (d[o + 1] < 0) { d[o + 1] = 9; d[o] = px + (Math.random() - 0.5) * 2 * R; d[o + 2] = pz + (Math.random() - 0.5) * 2 * R; }
      } else if (cfg.mode === 'rise') {
        d[o + 1] += cfg.speed * dt * (0.6 + 0.4 * Math.sin(ph));
        d[o] += Math.sin(t * 2 + ph) * 0.4 * dt;
        if (d[o + 1] > 9) { d[o + 1] = 0; d[o] = px + (Math.random() - 0.5) * 2 * R; d[o + 2] = pz + (Math.random() - 0.5) * 2 * R; }
      } else if (cfg.mode === 'float') {
        d[o] += this.pVel[i * 3] * dt; d[o + 1] += this.pVel[i * 3 + 1] * dt + Math.sin(t + ph) * 0.2 * dt; d[o + 2] += this.pVel[i * 3 + 2] * dt;
        if (d[o + 1] < 0.2) d[o + 1] = 0.2; if (d[o + 1] > 8) d[o + 1] = 8;
      } else if (cfg.mode === 'drift') {
        d[o] += 1.8 * dt; d[o + 1] += Math.sin(t * 0.8 + ph) * 0.3 * dt;
        if (d[o + 1] < 0.1) d[o + 1] = 0.1; if (d[o + 1] > 6) d[o + 1] = 6;
      }
      if (cfg.mode !== 'dome') {
        if (d[o] < px - R) d[o] += 2 * R; else if (d[o] > px + R) d[o] -= 2 * R;
        if (d[o + 2] < pz - R) d[o + 2] += 2 * R; else if (d[o + 2] > pz + R) d[o + 2] -= 2 * R;
      }
      if (cfg.twinkle) d[o + 6] = cfg.alpha * (0.45 + 0.55 * Math.abs(Math.sin(t * 2.2 + ph * 3)));
    }
  }
  pop(txt) {
    const e = this.ui.pop; e.textContent = txt; e.classList.remove('hidden');
    e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
    clearTimeout(this._popT); this._popT = setTimeout(() => e.classList.add('hidden'), 1100);
  }
  /* Une particule d'effet : position, couleur, vitesse, durée, taille, gravité */
  spawn(x, y, z, c, vx, vy, vz, life, size, grav) {
    const S = this.fx, d = S.data;
    const i = S.count < S.max ? S.count++ : Math.floor(Math.random() * S.max);
    const o = i * 8;
    d[o] = x; d[o + 1] = y; d[o + 2] = z;
    d[o + 3] = c[0]; d[o + 4] = c[1]; d[o + 5] = c[2]; d[o + 6] = 1; d[o + 7] = size;
    this.fxVel[i * 3] = vx; this.fxVel[i * 3 + 1] = vy; this.fxVel[i * 3 + 2] = vz;
    this.fxMax[i] = life; this.fxLife[i] = life; this.fxGrav[i] = grav;
  }
  burst(pos, colors, n, speed, life, grav = -7) {
    for (let k = 0; k < n; k++) {
      const c = colors[k % colors.length];
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2, s = speed * (0.4 + Math.random() * 0.8);
      const vy = (Math.abs(Math.sin(e)) * s + 1.5) * (life ? 0.4 : 1);
      this.spawn(pos[0], pos[1], pos[2], c, Math.cos(a) * Math.cos(e) * s, vy, Math.sin(a) * Math.cos(e) * s,
        (life || 1) * (0.9 + Math.random() * 1.2), life ? 2 + Math.random() * 2 : 3 + Math.random() * 4, grav);
    }
    this.fx.additive = false;
  }
  updateFx(dt) {
    const S = this.fx, d = S.data;
    for (let i = 0; i < S.count; i++) {
      this.fxLife[i] -= dt;
      if (this.fxLife[i] <= 0) {
        const j = --S.count;
        if (i !== j) {
          d.copyWithin(i * 8, j * 8, j * 8 + 8);
          this.fxVel.copyWithin(i * 3, j * 3, j * 3 + 3); this.fxLife[i] = this.fxLife[j]; this.fxMax[i] = this.fxMax[j]; this.fxGrav[i] = this.fxGrav[j];
        }
        i--; continue;
      }
      const o = i * 8;
      this.fxVel[i * 3 + 1] += this.fxGrav[i] * dt;
      d[o] += this.fxVel[i * 3] * dt; d[o + 1] += this.fxVel[i * 3 + 1] * dt; d[o + 2] += this.fxVel[i * 3 + 2] * dt;
      if (d[o + 1] < 0.05 && this.fxGrav[i] < 0) { d[o + 1] = 0.05; this.fxVel[i * 3 + 1] *= -0.4; this.fxVel[i * 3] *= 0.8; this.fxVel[i * 3 + 2] *= 0.8; }
      d[o + 6] = clamp(this.fxLife[i] / this.fxMax[i] * 1.5, 0, 1);
    }
  }

  /* ---------- Mini-carte ---------- */
  setupMinimap() {
    const m = this.mm, mz = this.maze, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxDim = Math.max(mz.w, mz.h);
    m.cell = clamp(Math.floor(128 / maxDim), 4, 16);
    const pad = 6;
    const w = mz.w * m.cell + pad * 2, h = mz.h * m.cell + pad * 2;
    m.pad = pad; m.w = w; m.h = h; m.dpr = dpr;
    this.ui.minimap.width = w * dpr; this.ui.minimap.height = h * dpr;
    this.ui.minimap.style.width = w + 'px'; this.ui.minimap.style.height = h + 'px';
    m.layer.width = w * dpr; m.layer.height = h * dpr;
    m.dirty = true;
  }
  drawMinimapLayer() {
    const m = this.mm, mz = this.maze, c = m.layer.getContext('2d'), s = m.cell, p = m.pad;
    c.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    c.clearRect(0, 0, m.w, m.h);
    c.fillStyle = 'rgba(8,10,20,0.42)';
    c.beginPath(); c.roundRect(0, 0, m.w, m.h, 10); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
    c.strokeRect(p, p, mz.w * s, mz.h * s);
    c.fillStyle = 'rgba(255,255,255,0.16)';
    for (let z = 0; z < mz.h; z++) for (let x = 0; x < mz.w; x++) if (this.visited[z * mz.w + x]) c.fillRect(p + x * s, p + z * s, s, s);
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = Math.max(1.2, s * 0.14); c.lineCap = 'round';
    c.beginPath();
    for (let z = 0; z < mz.h; z++) for (let x = 0; x < mz.w; x++) {
      if (!this.visited[z * mz.w + x]) continue;
      const b = mz.walls[z * mz.w + x], X = p + x * s, Z = p + z * s;
      if (b & 1) { c.moveTo(X, Z); c.lineTo(X + s, Z); }
      if (b & 4) { c.moveTo(X, Z + s); c.lineTo(X + s, Z + s); }
      if (b & 8) { c.moveTo(X, Z); c.lineTo(X, Z + s); }
      if (b & 2) { c.moveTo(X + s, Z); c.lineTo(X + s, Z + s); }
    }
    c.stroke();
    m.dirty = false;
  }
  drawMinimap() {
    if (this.state === 'menu') return;
    const m = this.mm; if (m.dirty) this.drawMinimapLayer();
    const c = m.ctx, s = m.cell, p = m.pad, mz = this.maze, t = this.time;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, m.layer.width, m.layer.height);
    c.drawImage(m.layer, 0, 0);
    c.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    // étoiles
    for (const st of this.stars) {
      if (st.collected || !this.visited[st.cell]) continue;
      const x = p + (st.cell % mz.w + 0.5) * s, z = p + (Math.floor(st.cell / mz.w) + 0.5) * s;
      c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(x, z, Math.max(1.5, s * 0.18), 0, 7); c.fill();
    }
    // sortie
    const ex = p + (mz.exit[0] + 0.5) * s, ez = p + (mz.exit[1] + 0.5) * s;
    c.fillStyle = this.theme.accent; c.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 3));
    c.beginPath(); c.arc(ex, ez, Math.max(3, s * 0.42), 0, 7); c.fill(); c.globalAlpha = 1;
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ez, Math.max(1.5, s * 0.18), 0, 7); c.fill();
    // joueur
    const px = p + this.player.x / CS * s, pz = p + this.player.z / CS * s;
    c.fillStyle = '#00e5ff'; c.beginPath(); c.arc(px, pz, Math.max(2.5, s * 0.3), 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
  }

  /* ---------- Rendu ---------- */
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.resize(w, h, pr);
  }
  render() {
    this.renderer.setCamera(this.cam.pos, this.cam.target);
    this.renderer.render(this.scene, [this.particles, this.fx]);
    this.drawMinimap();
  }
}

window.addEventListener('load', () => {
  try { window.game = new Game(); }
  catch (e) { console.error(e); $('#nogl').classList.remove('hidden'); $('#nogl .err').textContent = String(e.message || e); }
});
