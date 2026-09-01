/* ============================================================
   MazeRun — Niveaux, génération de labyrinthe, thèmes et décors
   ============================================================ */
'use strict';

const CS = 2.0;   // taille d'une cellule (unités monde)
const WT = 0.4;   // épaisseur des murs
const WH = 1.5;   // hauteur des murs

/* 10 niveaux : taille de la grille, temps par cellule du chemin (s), thème */
const LEVELS = [
  { name: 'Prairie', sub: 'Démo · apprentissage', emoji: '🌼', size: 4, perCell: 0, theme: 'prairie', seed: 101 },
  { name: 'Jungle', sub: 'Facile', emoji: '🌴', size: 6, perCell: 3.0, theme: 'jungle', seed: 202 },
  { name: 'Plage', sub: 'Facile', emoji: '🏖️', size: 8, perCell: 2.5, theme: 'beach', seed: 303 },
  { name: 'Désert', sub: 'Moyen', emoji: '🏜️', size: 10, perCell: 2.2, theme: 'desert', seed: 404 },
  { name: 'Montagne', sub: 'Moyen', emoji: '🏔️', size: 12, perCell: 2.0, theme: 'mountain', seed: 505 },
  { name: 'Forêt d’automne', sub: 'Moyen +', emoji: '🍂', size: 14, perCell: 1.8, theme: 'autumn', seed: 606 },
  { name: 'Volcan', sub: 'Difficile', emoji: '🌋', size: 16, perCell: 1.6, theme: 'volcano', seed: 707 },
  { name: 'Grotte de glace', sub: 'Difficile', emoji: '❄️', size: 18, perCell: 1.45, theme: 'ice', seed: 808 },
  { name: 'Ville néon', sub: 'Expert', emoji: '🌃', size: 21, perCell: 1.3, theme: 'neon', seed: 909 },
  { name: 'Espace', sub: 'Légende', emoji: '🪐', size: 24, perCell: 1.15, theme: 'space', seed: 1010 },
];

/* ---------- Thèmes visuels ---------- */
const THEMES = {
  prairie: {
    sky: ['#4fa8ff', '#d6f0ff'], fog: '#c6e6ff', fogDensity: 0.010, sun: [0.45, 0.8, 0.4], sunCol: [1.0, 0.96, 0.86],
    hemiSky: '#a8d4ff', hemiGround: '#5e6e55', floor: ['#5cb548', '#6cc456'], floorOuter: '#5fb04a',
    wall: { style: 'hedge', base: '#2e7d32', top: '#43a047' }, accent: '#ffd54f',
    props: [['tree', 22], ['flower', 40], ['bush', 16], ['mushroom', 6]], particles: 'pollen', sunDisc: '#fff6c8', clouds: true,
  },
  jungle: {
    sky: ['#2f8f7a', '#c8f0d8'], fog: '#9fd6b8', fogDensity: 0.022, sun: [0.3, 0.85, 0.4], sunCol: [0.95, 1.0, 0.85],
    hemiSky: '#8fdcc0', hemiGround: '#3a4f3a', floor: ['#3f7d38', '#4a8a40'], floorOuter: '#3a6f34',
    wall: { style: 'moss', base: '#6b5a44', top: '#4e8a3c' }, accent: '#ffe066',
    props: [['palm', 18], ['tree', 16], ['bush', 24], ['flower', 14], ['rock', 8]], particles: 'fireflies', sunDisc: null, clouds: true,
  },
  beach: {
    sky: ['#2b9fe6', '#e6f7ff'], fog: '#cdeeff', fogDensity: 0.012, sun: [0.5, 0.75, 0.4], sunCol: [1.0, 0.97, 0.9],
    hemiSky: '#a8e0ff', hemiGround: '#8a7a55', floor: ['#eddc9a', '#f2e3a8'], floorOuter: '#e8d693',
    wall: { style: 'sand', base: '#d9b872', top: '#e8cc8a' }, accent: '#ff7f50',
    props: [['palm', 22], ['umbrella', 8], ['rock', 12], ['shell', 20], ['bush', 6]], particles: 'bubbles', sunDisc: '#fffbe0', clouds: true, water: '#2ec4d6',
  },
  desert: {
    sky: ['#e8913a', '#ffe0a8'], fog: '#f0c98a', fogDensity: 0.014, sun: [0.55, 0.65, 0.5], sunCol: [1.0, 0.9, 0.75],
    hemiSky: '#ffd9a0', hemiGround: '#7a4a25', floor: ['#e39b4a', '#eaa655'], floorOuter: '#dd9445',
    wall: { style: 'adobe', base: '#b8652e', top: '#cf7a3d' }, accent: '#ffcc33',
    props: [['cactus', 26], ['rock', 18], ['bones', 4], ['dune', 10]], particles: 'dust', sunDisc: '#fff1c0', clouds: false,
  },
  mountain: {
    sky: ['#4c7bd9', '#e8f2ff'], fog: '#d8e8ff', fogDensity: 0.013, sun: [0.35, 0.75, 0.55], sunCol: [1.0, 0.98, 0.95],
    hemiSky: '#b8d4ff', hemiGround: '#5a6a75', floor: ['#dfe7ef', '#eaf0f6'], floorOuter: '#d6e0ea',
    wall: { style: 'stone', base: '#6e7681', top: '#e9eef3' }, accent: '#80d8ff',
    props: [['pine', 34], ['rock', 16], ['snowman', 3], ['peak', 8]], particles: 'snow', sunDisc: '#ffffff', clouds: true,
  },
  autumn: {
    sky: ['#d9772f', '#ffe1b0'], fog: '#f2c48a', fogDensity: 0.016, sun: [0.5, 0.6, 0.55], sunCol: [1.0, 0.85, 0.65],
    hemiSky: '#ffc58a', hemiGround: '#5a3a1f', floor: ['#a8642a', '#b56f31'], floorOuter: '#9e5d27',
    wall: { style: 'log', base: '#6b4423', top: '#8a5a2e' }, accent: '#ff9f43',
    props: [['autumnTree', 34], ['mushroom', 14], ['bush', 12], ['rock', 6]], particles: 'leaves', sunDisc: '#ffe3a8', clouds: true,
  },
  volcano: {
    sky: ['#3a0f10', '#c8422a'], fog: '#5a1e16', fogDensity: 0.020, sun: [0.2, 0.7, 0.6], sunCol: [1.0, 0.55, 0.35],
    hemiSky: '#c04a30', hemiGround: '#2a0d0a', floor: ['#2b2426', '#332a2c'], floorOuter: '#241e20',
    wall: { style: 'lava', base: '#3a3033', top: '#4a3e42' }, accent: '#ff6b1a',
    props: [['volcano', 5], ['lavaPool', 14], ['rock', 30], ['deadTree', 8]], particles: 'embers', sunDisc: null, clouds: false,
  },
  ice: {
    sky: ['#1e3f8a', '#a8e0ff'], fog: '#8fcbf5', fogDensity: 0.018, sun: [0.3, 0.8, 0.5], sunCol: [0.9, 0.97, 1.0],
    hemiSky: '#a8e6ff', hemiGround: '#28507a', floor: ['#bfe6f7', '#cdeefc'], floorOuter: '#b3dff2',
    wall: { style: 'ice', base: '#7cc7ee', top: '#e4f7ff' }, accent: '#ffffff',
    props: [['crystal', 40], ['iceSpike', 24], ['rock', 8], ['snowman', 2]], particles: 'sparkle', sunDisc: '#e6f6ff', clouds: false,
  },
  neon: {
    sky: ['#0b0620', '#3a1c6e'], fog: '#1b0f3a', fogDensity: 0.020, sun: [0.3, 0.8, 0.5], sunCol: [0.75, 0.7, 1.0],
    hemiSky: '#6a3fd0', hemiGround: '#100820', floor: ['#1c1a2e', '#222038'], floorOuter: '#15132a',
    wall: { style: 'neon', base: '#2a2440', top: '#ff2fb0', rim2: '#22e6ff' }, accent: '#22e6ff',
    props: [['building', 40], ['lamp', 22], ['sign', 10]], particles: 'rain', sunDisc: null, clouds: false, moon: '#fff2c0',
  },
  space: {
    sky: ['#03020c', '#1b0d3a'], fog: '#0b0620', fogDensity: 0.012, sun: [0.4, 0.75, 0.5], sunCol: [0.9, 0.85, 1.0],
    hemiSky: '#5a3fa8', hemiGround: '#08061a', floor: ['#1a1436', '#221a44'], floorOuter: '#120e28',
    wall: { style: 'space', base: '#2a2255', top: '#22e6ff' }, accent: '#a06bff',
    props: [['planet', 12], ['asteroid', 30], ['crystal', 12], ['satellite', 4]], particles: 'stars', sunDisc: null, clouds: false,
  },
};

/* ---------- Génération de labyrinthe (backtracker récursif, seedé) ---------- */
const DIRS = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]]; // dx, dz, bit, bit opposé

function generateMaze(w, h, seed) {
  const rng = mulberry32(seed);
  const walls = new Uint8Array(w * h).fill(15);
  const visited = new Uint8Array(w * h);
  const start = [0, h - 1];
  const stack = [start];
  visited[start[1] * w + start[0]] = 1;
  while (stack.length) {
    const [x, z] = stack[stack.length - 1];
    const opts = [];
    for (const d of DIRS) {
      const nx = x + d[0], nz = z + d[1];
      if (nx >= 0 && nz >= 0 && nx < w && nz < h && !visited[nz * w + nx]) opts.push([nx, nz, d]);
    }
    if (!opts.length) { stack.pop(); continue; }
    const [nx, nz, d] = opts[Math.floor(rng() * opts.length)];
    walls[z * w + x] &= ~d[2];
    walls[nz * w + nx] &= ~d[3];
    visited[nz * w + nx] = 1;
    stack.push([nx, nz]);
  }
  const maze = { w, h, walls, start, rng };
  // BFS depuis le départ → cellule la plus lointaine = sortie
  const distStart = bfs(maze, start);
  let far = 0, exit = start;
  for (let i = 0; i < w * h; i++) if (distStart[i] > far) { far = distStart[i]; exit = [i % w, Math.floor(i / w)]; }
  maze.exit = exit;
  maze.distStart = distStart;
  // BFS depuis la sortie → "next" = prochaine cellule vers la sortie
  const { dist: distExit, parent } = bfsFull(maze, exit);
  maze.distExit = distExit; maze.next = parent;
  maze.pathLen = distExit[start[1] * w + start[0]];
  // chemin solution
  const path = new Set(); let c = start[1] * w + start[0];
  while (c >= 0) { path.add(c); c = parent[c]; }
  maze.path = path;
  // étoiles : 3 impasses hors chemin, réparties
  const dead = [];
  for (let i = 0; i < w * h; i++) {
    const b = walls[i]; const cnt = (b & 1 ? 1 : 0) + (b & 2 ? 1 : 0) + (b & 4 ? 1 : 0) + (b & 8 ? 1 : 0);
    const isStart = i === start[1] * w + start[0], isExit = i === exit[1] * w + exit[0];
    if (cnt === 3 && !isStart && !isExit && !path.has(i)) dead.push(i);
  }
  let pool = dead;
  if (pool.length < 3) { pool = []; for (let i = 0; i < w * h; i++) if (!path.has(i) && i !== start[1] * w + start[0]) pool.push(i); }
  if (pool.length < 3) { pool = []; for (let i = 0; i < w * h; i++) if (i !== start[1] * w + start[0] && i !== exit[1] * w + exit[0]) pool.push(i); }
  pool.sort((a, b) => distStart[a] - distStart[b]);
  const stars = [];
  const picks = [0.2, 0.5, 0.8];
  for (const p of picks) {
    let idx = Math.min(pool.length - 1, Math.floor(p * pool.length));
    while (stars.includes(pool[idx]) && idx < pool.length - 1) idx++;
    if (!stars.includes(pool[idx])) stars.push(pool[idx]);
  }
  maze.stars = stars.map(i => [i % w, Math.floor(i / w)]);
  return maze;
}
function bfs(maze, from) { return bfsFull(maze, from).dist; }
function bfsFull(maze, from) {
  const { w, h, walls } = maze;
  const dist = new Int32Array(w * h).fill(-1), parent = new Int32Array(w * h).fill(-1);
  const q = [from[1] * w + from[0]]; dist[q[0]] = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % w, z = Math.floor(i / w);
    for (const d of DIRS) {
      if (walls[i] & d[2]) continue;
      const j = (z + d[1]) * w + (x + d[0]);
      if (dist[j] < 0) { dist[j] = dist[i] + 1; parent[j] = i; q.push(j); }
    }
  }
  return { dist, parent };
}
function timeLimit(level, maze) {
  if (!level.perCell) return Infinity;
  return Math.max(20, Math.round((maze.pathLen * level.perCell + 8) / 5) * 5);
}

/* ---------- Constructeur "chunké" (sécurité index 16 bits) ---------- */
class ChunkedBuilder {
  constructor() { this.list = []; this.cur = new MeshBuilder(); }
  get b() { if (this.cur.vertexCount > 48000) { this.list.push(this.cur); this.cur = new MeshBuilder(); } return this.cur; }
  build(gl) { if (this.cur.vertexCount) this.list.push(this.cur); return this.list.map(b => b.build(gl)); }
}

/* ---------- Couleur des murs selon le style ---------- */
function jitter(c, rng, k) { const j = (rng() - 0.5) * k; return [clamp(c[0] + j, 0, 1), clamp(c[1] + j, 0, 1), clamp(c[2] + j, 0, 1)]; }

function wallColorFn(style, base, top, rim2, rng) {
  const b = jitter(base, rng, 0.10), t = jitter(top, rng, 0.06);
  const dark = mulc(b, 0.55);
  return (x, y, z, n) => {
    const yy = y + WH / 2; // 0..WH (les sommets d'une boîte sont à 0 ou WH)
    if (n[1] > 0.5) {
      if (style === 'neon' || style === 'space') return [t[0], t[1], t[2], 0.9];
      if (style === 'ice') return [t[0], t[1], t[2], 0.25];
      return [t[0], t[1], t[2], 0];
    }
    if (n[1] < -0.5) return [dark[0], dark[1], dark[2], 0];
    const g = clamp(yy / WH * 0.8 + 0.35, 0, 1);
    let c = mixc(dark, b, g);
    switch (style) {
      case 'lava': if (yy < 0.22) { return [1.0, 0.55, 0.12, 0.85]; } break;
      case 'moss': if (yy > WH - 0.35) c = mixc(c, t, 0.7); break;
      case 'ice': return [c[0], c[1], c[2], 0.18];
      case 'adobe': if (yy > WH - 0.12) c = mixc(c, t, 0.5); break;
      case 'space': c = mixc(c, t, yy > 0.5 ? 0.12 : 0.0); break;
    }
    return [c[0], c[1], c[2], 0];
  };
}

/* Détails ajoutés sur chaque segment de mur selon le style (liserés néon, bandes de rondins…) */
function wallDetails(b, style, top, rim2, horizontal, center, rng) {
  const L = CS + WT + 0.02, along = (w, h, d) => (horizontal ? [w, h, d] : [d, h, w]);
  if (style === 'neon' || style === 'space') {
    const c1 = top, c2 = rim2 || top;
    let s = along(L, 0.07, WT + 0.05); b.box(s[0], s[1], s[2], [c1[0], c1[1], c1[2], 0.95], T([center[0], WH - 0.02, center[2]]));
    s = along(L, 0.06, WT + 0.05); b.box(s[0], s[1], s[2], [c2[0], c2[1], c2[2], 0.9], T([center[0], 0.05, center[2]]), { noBottom: true });
  } else if (style === 'log') {
    const dk = mulc(top, 0.45);
    for (const y of [0.5, 1.0]) { const s = along(L, 0.05, WT + 0.03); b.box(s[0], s[1], s[2], dk, T([center[0], y, center[2]]), { noBottom: true }); }
  } else if (style === 'stone') {
    const dk = mulc(top, 0.55);
    const s = along(L, 0.04, WT + 0.02); b.box(s[0], s[1], s[2], dk, T([center[0], 0.72 + (rng() - 0.5) * 0.2, center[2]]), { noBottom: true });
  } else if (style === 'hedge') {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, g = jitter(top, rng, 0.12);
      const p = horizontal ? [center[0] - CS / 2 + t * CS, WH - 0.05, center[2]] : [center[0], WH - 0.05, center[2] - CS / 2 + t * CS];
      b.sphere(0.36, 8, 6, g, T(p), [1, 0.75, 1]);
    }
  } else if (style === 'ice' && rng() < 0.25) {
    const h = 0.5 + rng() * 0.6;
    b.cylinder(0.14, 0, h, 6, [0.85, 0.96, 1.0, 0.3], T([center[0] + (rng() - 0.5) * 1.2 * (horizontal ? 1 : 0), WH + h / 2 - 0.05, center[2] + (rng() - 0.5) * 1.2 * (horizontal ? 0 : 1)]), { noBottom: true });
  }
}

/* ---------- Props de décor ---------- */
const PROPS = {
  tree(b, m, rng) {
    const trunk = [0.42, 0.27, 0.15], leaf = jitter([0.22, 0.60, 0.25], rng, 0.15);
    b.cylinder(0.16, 0.22, 1.3, 8, trunk, M4.multiply(M4.create(), m, T([0, 0.65, 0])));
    b.sphere(0.75, 10, 8, leaf, M4.multiply(M4.create(), m, T([0, 1.7, 0])));
    b.sphere(0.55, 9, 7, jitter(leaf, rng, 0.1), M4.multiply(M4.create(), m, T([0.45, 1.45, 0.2])));
    b.sphere(0.5, 9, 7, jitter(leaf, rng, 0.1), M4.multiply(M4.create(), m, T([-0.4, 1.55, -0.25])));
    b.sphere(0.45, 9, 7, jitter(leaf, rng, 0.1), M4.multiply(M4.create(), m, T([0, 2.25, 0])));
  },
  autumnTree(b, m, rng) {
    const trunk = [0.38, 0.24, 0.13];
    const pal = [[0.95, 0.45, 0.12], [0.85, 0.25, 0.1], [0.95, 0.7, 0.15], [0.7, 0.35, 0.1]];
    const leaf = pal[Math.floor(rng() * pal.length)];
    b.cylinder(0.15, 0.22, 1.4, 8, trunk, M4.multiply(M4.create(), m, T([0, 0.7, 0])));
    b.sphere(0.8, 10, 8, leaf, M4.multiply(M4.create(), m, T([0, 1.85, 0])));
    b.sphere(0.55, 9, 7, jitter(leaf, rng, 0.15), M4.multiply(M4.create(), m, T([0.5, 1.5, 0.25])));
    b.sphere(0.5, 9, 7, jitter(leaf, rng, 0.15), M4.multiply(M4.create(), m, T([-0.45, 1.6, -0.2])));
  },
  deadTree(b, m, rng) {
    const c = [0.12, 0.1, 0.1];
    b.cylinder(0.08, 0.16, 1.8, 6, c, M4.multiply(M4.create(), m, T([0, 0.9, 0])));
    b.cylinder(0.03, 0.07, 0.9, 5, c, M4.multiply(M4.create(), m, T([0.3, 1.5, 0], 0, 0, -0.8)));
    b.cylinder(0.03, 0.06, 0.7, 5, c, M4.multiply(M4.create(), m, T([-0.25, 1.2, 0.1], 0, 0.3, 0.9)));
  },
  pine(b, m, rng) {
    const trunk = [0.35, 0.22, 0.12], g = jitter([0.13, 0.42, 0.25], rng, 0.1), snow = [0.95, 0.97, 1.0];
    b.cylinder(0.12, 0.16, 0.8, 7, trunk, M4.multiply(M4.create(), m, T([0, 0.4, 0])));
    for (let i = 0; i < 3; i++) {
      const y = 0.9 + i * 0.6, r = 0.95 - i * 0.22;
      b.cylinder(r, 0.02, 0.9, 9, (x, yy, z, n) => (n[1] > 0.3 && yy > 0.1 ? snow : g), M4.multiply(M4.create(), m, T([0, y + 0.45, 0])), { noTop: true });
    }
    b.sphere(0.12, 6, 5, snow, M4.multiply(M4.create(), m, T([0, 3.05, 0])));
  },
  palm(b, m, rng) {
    const trunk = [0.5, 0.36, 0.2], leaf = [0.2, 0.62, 0.28];
    const lean = (rng() - 0.5) * 0.5;
    let x = 0, y = 0;
    for (let i = 0; i < 5; i++) {
      b.cylinder(0.13 - i * 0.012, 0.16 - i * 0.012, 0.6, 7, i % 2 ? trunk : mulc(trunk, 0.85), M4.multiply(M4.create(), m, T([x, y + 0.3, 0], 0, 0, lean)));
      x += Math.sin(lean) * 0.6; y += Math.cos(lean) * 0.6;
    }
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      b.box(0.28, 0.05, 1.7, (px, py, pz) => (pz > 0.4 ? mulc(leaf, 0.85) : leaf), M4.multiply(M4.create(), m, T([x + Math.sin(a) * 0.7, y + 0.1 - 0.25, Math.cos(a) * 0.7], a, 0.55, 0)));
    }
    b.sphere(0.15, 6, 5, [0.5, 0.35, 0.15], M4.multiply(M4.create(), m, T([x, y - 0.05, 0])));
    b.sphere(0.13, 6, 5, [0.45, 0.3, 0.12], M4.multiply(M4.create(), m, T([x + 0.2, y - 0.1, 0.1])));
  },
  bush(b, m, rng) {
    const g = jitter([0.25, 0.55, 0.25], rng, 0.15);
    b.sphere(0.5, 9, 7, g, M4.multiply(M4.create(), m, T([0, 0.4, 0])), [1, 0.8, 1]);
    b.sphere(0.35, 8, 6, jitter(g, rng, 0.1), M4.multiply(M4.create(), m, T([0.4, 0.3, 0.2])));
    b.sphere(0.3, 8, 6, jitter(g, rng, 0.1), M4.multiply(M4.create(), m, T([-0.35, 0.3, -0.15])));
  },
  flower(b, m, rng) {
    const pal = [[1, 0.3, 0.4], [1, 0.8, 0.2], [0.9, 0.4, 0.9], [0.4, 0.6, 1], [1, 1, 1]];
    const c = pal[Math.floor(rng() * pal.length)];
    b.cylinder(0.025, 0.03, 0.5, 5, [0.25, 0.6, 0.25], M4.multiply(M4.create(), m, T([0, 0.25, 0])));
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; b.sphere(0.07, 6, 5, [c[0], c[1], c[2], 0.2], M4.multiply(M4.create(), m, T([Math.cos(a) * 0.09, 0.52, Math.sin(a) * 0.09])), [1, 0.5, 1]); }
    b.sphere(0.05, 6, 5, [1, 0.85, 0.2, 0.3], M4.multiply(M4.create(), m, T([0, 0.55, 0])));
  },
  mushroom(b, m, rng) {
    const s = 0.7 + rng() * 0.6;
    b.cylinder(0.12 * s, 0.15 * s, 0.5 * s, 7, [0.95, 0.9, 0.8], M4.multiply(M4.create(), m, T([0, 0.25 * s, 0])));
    b.sphere(0.35 * s, 10, 6, (x, y) => (y < 0 ? [0.9, 0.85, 0.75] : ((Math.sin(x * 40) * Math.cos(y * 33) > 0.6) ? [1, 1, 1] : [0.85, 0.15, 0.15])), M4.multiply(M4.create(), m, T([0, 0.5 * s, 0])), [1, 0.6, 1]);
  },
  rock(b, m, rng) {
    const g = jitter([0.45, 0.45, 0.48], rng, 0.2), s = 0.4 + rng() * 0.8;
    b.sphere(s, 7, 5, g, M4.multiply(M4.create(), m, T([0, s * 0.35, 0], rng() * 6, 0, 0)), [1 + rng() * 0.5, 0.6 + rng() * 0.3, 1]);
  },
  asteroid(b, m, rng) {
    const g = jitter([0.35, 0.3, 0.45], rng, 0.15), s = 0.3 + rng() * 0.7;
    b.sphere(s, 6, 5, g, M4.multiply(M4.create(), m, T([0, 1 + rng() * 6, 0], rng() * 6, rng(), 0)), [1 + rng() * 0.6, 0.7 + rng() * 0.5, 1]);
  },
  cactus(b, m, rng) {
    const g = jitter([0.2, 0.55, 0.3], rng, 0.1), h = 1.2 + rng() * 1.2;
    b.cylinder(0.2, 0.22, h, 8, g, M4.multiply(M4.create(), m, T([0, h / 2, 0])));
    b.sphere(0.2, 8, 6, g, M4.multiply(M4.create(), m, T([0, h, 0])));
    if (rng() < 0.8) {
      const side = rng() < 0.5 ? 1 : -1, y = h * 0.45;
      b.cylinder(0.11, 0.11, 0.45, 7, g, M4.multiply(M4.create(), m, T([side * 0.28, y, 0], 0, 0, Math.PI / 2)));
      b.cylinder(0.11, 0.11, 0.6, 7, g, M4.multiply(M4.create(), m, T([side * 0.48, y + 0.3, 0])));
      b.sphere(0.11, 6, 5, g, M4.multiply(M4.create(), m, T([side * 0.48, y + 0.6, 0])));
    }
  },
  dune(b, m, rng) {
    const s = 3 + rng() * 5;
    b.sphere(s, 10, 6, [0.93, 0.66, 0.34], M4.multiply(M4.create(), m, T([0, -s * 0.72, 0], rng() * 6)), [1.6, 1, 1]);
  },
  bones(b, m, rng) {
    const c = [0.92, 0.9, 0.8];
    b.cylinder(0.05, 0.05, 0.9, 5, c, M4.multiply(M4.create(), m, T([0, 0.06, 0], rng() * 3, 0, Math.PI / 2)));
    b.sphere(0.09, 6, 5, c, M4.multiply(M4.create(), m, T([0.45, 0.08, 0])));
    b.sphere(0.09, 6, 5, c, M4.multiply(M4.create(), m, T([-0.45, 0.08, 0])));
    b.sphere(0.25, 8, 6, c, M4.multiply(M4.create(), m, T([0.9, 0.22, 0.4])), [1.2, 0.9, 1]);
  },
  snowman(b, m, rng) {
    const w = [0.97, 0.98, 1.0];
    b.sphere(0.55, 10, 8, w, M4.multiply(M4.create(), m, T([0, 0.5, 0])));
    b.sphere(0.4, 10, 8, w, M4.multiply(M4.create(), m, T([0, 1.25, 0])));
    b.sphere(0.3, 10, 8, w, M4.multiply(M4.create(), m, T([0, 1.8, 0])));
    b.cylinder(0.02, 0.06, 0.3, 5, [1, 0.5, 0.1], M4.multiply(M4.create(), m, T([0, 1.8, 0.4], 0, Math.PI / 2, 0)));
    b.sphere(0.04, 5, 4, [0.05, 0.05, 0.05], M4.multiply(M4.create(), m, T([-0.1, 1.9, 0.27])));
    b.sphere(0.04, 5, 4, [0.05, 0.05, 0.05], M4.multiply(M4.create(), m, T([0.1, 1.9, 0.27])));
    b.cylinder(0.25, 0.25, 0.3, 8, [0.1, 0.1, 0.12], M4.multiply(M4.create(), m, T([0, 2.15, 0])));
    b.cylinder(0.4, 0.4, 0.04, 8, [0.1, 0.1, 0.12], M4.multiply(M4.create(), m, T([0, 2.02, 0])));
  },
  peak(b, m, rng) {
    const s = 6 + rng() * 8;
    b.cylinder(s * 0.9, 0, s * 1.6, 7, (x, y, z, n) => (y > s * 0.45 ? [0.95, 0.97, 1] : [0.45, 0.48, 0.55]), M4.multiply(M4.create(), m, T([0, s * 0.8, 0], rng() * 6)), { noBottom: true });
  },
  umbrella(b, m, rng) {
    const pal = [[1, 0.3, 0.3], [0.2, 0.5, 1], [1, 0.8, 0.2]];
    const c = pal[Math.floor(rng() * 3)];
    b.cylinder(0.03, 0.03, 2, 5, [0.9, 0.9, 0.9], M4.multiply(M4.create(), m, T([0, 1, 0])));
    b.cylinder(1.1, 0.05, 0.5, 12, (x, y, z) => ((Math.atan2(z, x) * 6 / Math.PI | 0) % 2 ? c : [1, 1, 1]), M4.multiply(M4.create(), m, T([0, 2.05, 0])), { noBottom: true });
    b.box(1.6, 0.06, 0.9, [0.95, 0.95, 0.9], M4.multiply(M4.create(), m, T([1.0, 0.1, 0.2], 0.3)));
  },
  shell(b, m, rng) {
    b.sphere(0.13, 6, 4, [1, 0.85, 0.75], M4.multiply(M4.create(), m, T([0, 0.05, 0], rng() * 6)), [1, 0.5, 1.2]);
  },
  volcano(b, m, rng) {
    const s = 7 + rng() * 6;
    b.cylinder(s, s * 0.3, s * 0.9, 12, [0.22, 0.17, 0.18], M4.multiply(M4.create(), m, T([0, s * 0.45, 0])), { noBottom: true, noTop: true });
    b.cylinder(s * 0.3, s * 0.3, 0.1, 12, [1, 0.45, 0.1, 0.95], M4.multiply(M4.create(), m, T([0, s * 0.9 - 0.2, 0])));
    for (let i = 0; i < 3; i++) { const a = rng() * 6.28; b.box(0.35, 0.08, s * 0.7, [1, 0.35, 0.05, 0.9], M4.multiply(M4.create(), m, T([Math.cos(a) * s * 0.6, s * 0.5, Math.sin(a) * s * 0.6], -a + Math.PI / 2, -0.75, 0))); }
  },
  lavaPool(b, m, rng) {
    const r = 0.8 + rng() * 1.5;
    b.disc(r, 12, [1, 0.5, 0.1, 0.95], M4.multiply(M4.create(), m, T([0, 0.03, 0])));
    b.torus(r, 0.12, 12, 5, [0.2, 0.15, 0.15], M4.multiply(M4.create(), m, T([0, 0.05, 0])));
  },
  crystal(b, m, rng) {
    const pal = [[0.55, 0.85, 1.0], [0.75, 0.6, 1.0], [0.6, 1.0, 0.9]];
    const c = pal[Math.floor(rng() * 3)], n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const h = 0.8 + rng() * 1.8, r = 0.12 + rng() * 0.18;
      const mm = M4.multiply(M4.create(), m, T([(rng() - 0.5) * 0.8, h / 2 - 0.1, (rng() - 0.5) * 0.8], rng() * 6, (rng() - 0.5) * 0.6, (rng() - 0.5) * 0.6));
      b.cylinder(r, r * 0.6, h * 0.7, 6, [c[0], c[1], c[2], 0.35], M4.multiply(M4.create(), mm, T([0, -h * 0.15, 0])), { noTop: true });
      b.cylinder(r * 0.6, 0, h * 0.3, 6, [c[0], c[1], c[2], 0.5], M4.multiply(M4.create(), mm, T([0, h * 0.35, 0])), { noBottom: true });
    }
  },
  iceSpike(b, m, rng) {
    const h = 1 + rng() * 2.5;
    b.cylinder(0.35, 0, h, 7, [0.85, 0.95, 1.0, 0.15], M4.multiply(M4.create(), m, T([0, h / 2, 0])), { noBottom: true });
  },
  building(b, m, rng) {
    const h = 4 + rng() * 14, w = 2 + rng() * 3, d = 2 + rng() * 3;
    const base = jitter([0.12, 0.1, 0.2], rng, 0.06);
    const win = rng() < 0.5 ? [1, 0.85, 0.5] : [0.4, 0.9, 1.0];
    const rim = rng() < 0.5 ? [1, 0.18, 0.7] : [0.13, 0.9, 1.0];
    b.box(w, h, d, (x, y, z, n) => {
      if (n[1] > 0.5) return [rim[0], rim[1], rim[2], 0.9];
      if (n[1] < -0.5) return base;
      const fy = Math.floor((y + h / 2) / 0.7), fx = Math.floor((n[0] !== 0 ? z : x) * 1.6 + 10);
      const lit = ((fy * 7 + fx * 13 + (fy * fx) % 5) % 3) === 0 && fy % 2 === 0;
      return lit ? [win[0], win[1], win[2], 0.85] : base;
    }, M4.multiply(M4.create(), m, T([0, h / 2, 0])));
  },
  lamp(b, m, rng) {
    b.cylinder(0.05, 0.07, 3, 6, [0.2, 0.2, 0.25], M4.multiply(M4.create(), m, T([0, 1.5, 0])));
    b.sphere(0.2, 8, 6, [0.4, 0.95, 1.0, 1], M4.multiply(M4.create(), m, T([0, 3.1, 0])));
  },
  sign(b, m, rng) {
    const c = rng() < 0.5 ? [1, 0.2, 0.7] : [0.2, 1, 0.9];
    b.box(0.1, 3.5, 0.1, [0.25, 0.25, 0.3], M4.multiply(M4.create(), m, T([0, 1.75, 0])));
    b.box(2.2, 0.9, 0.12, (x, y, z, n) => (Math.abs(x) > 1.0 || Math.abs(y) > 0.38 ? [c[0], c[1], c[2], 0.95] : [0.1, 0.08, 0.15]), M4.multiply(M4.create(), m, T([0, 3.0, 0], rng() * 6)));
    for (let i = 0; i < 3; i++) b.box(0.35, 0.4, 0.14, [c[0], c[1], c[2], 0.95], M4.multiply(M4.create(), m, T([-0.6 + i * 0.6, 3.0, 0], 0)));
  },
  planet(b, m, rng) {
    const pal = [[1, 0.6, 0.3], [0.4, 0.7, 1], [0.8, 0.4, 0.9], [0.5, 0.9, 0.7], [1, 0.85, 0.4]];
    const c = pal[Math.floor(rng() * pal.length)], r = 1.5 + rng() * 3.5, y = 6 + rng() * 14;
    b.sphere(r, 14, 10, (x, yy, z) => (Math.sin(yy / r * 9 + x * 0.3) > 0.55 ? [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8, 0.35] : [c[0], c[1], c[2], 0.35]), M4.multiply(M4.create(), m, T([0, y, 0])));
    if (rng() < 0.6) b.torus(r * 1.7, r * 0.12, 24, 6, [c[0], c[1], c[2], 0.5], M4.multiply(M4.create(), m, T([0, y, 0], 0, 0.3 + rng() * 0.5, rng() * 0.6)));
  },
  satellite(b, m, rng) {
    const y = 5 + rng() * 8;
    b.box(0.6, 0.6, 0.9, [0.8, 0.8, 0.85], M4.multiply(M4.create(), m, T([0, y, 0], rng() * 6, 0.3)));
    b.box(3, 0.04, 0.8, [0.2, 0.3, 0.8, 0.4], M4.multiply(M4.create(), m, T([0, y, 0], rng() * 6, 0.3)));
  },
};

/* ---------- Construction du monde ---------- */
function buildWorld(gl, level, maze) {
  const th = THEMES[level.theme];
  const rng = mulberry32(level.seed * 31 + 7);
  const W = maze.w * CS, H = maze.h * CS;
  const cb = new ChunkedBuilder();

  /* Sol extérieur */
  const outer = hex(th.floorOuter);
  cb.b.plane(W + 160, H + 160, 8, 8, (x, z) => jitter(outer, rng, 0.03), T([W / 2, -0.01, H / 2]));
  if (th.water) { // plage : une "mer" au loin
    const wc = hex(th.water);
    cb.b.plane(W + 400, 60, 2, 2, [wc[0], wc[1], wc[2], 0.15], T([W / 2, 0.02, -H * 0.2 - 40]));
  }
  /* Sol intérieur (damier subtil) */
  const f0 = hex(th.floor[0]), f1 = hex(th.floor[1]);
  cb.b.plane(W, H, maze.w, maze.h, (x, z) => {
    const cx = Math.floor((x + W / 2) / CS), cz = Math.floor((z + H / 2) / CS);
    return jitter((cx + cz) % 2 ? f1 : f0, rng, 0.04);
  }, T([W / 2, 0, H / 2]));

  /* Murs */
  const ws = th.wall; const base = hex(ws.base), top = hex(ws.top), rim2 = ws.rim2 ? hex(ws.rim2) : null;
  const addWall = (cx, cz, horizontal) => {
    const b = cb.b;
    const cf = wallColorFn(ws.style, base, top, rim2, rng);
    const center = horizontal ? [cx * CS + CS / 2, WH / 2, cz * CS] : [cx * CS, WH / 2, cz * CS + CS / 2];
    if (horizontal) b.box(CS + WT, WH, WT, cf, T(center), { noBottom: true });
    else b.box(WT, WH, CS + WT, cf, T(center), { noBottom: true });
    wallDetails(b, ws.style, top, rim2, horizontal, center, rng);
  };
  for (let z = 0; z < maze.h; z++) for (let x = 0; x < maze.w; x++) {
    const w = maze.walls[z * maze.w + x];
    if (w & 1) addWall(x, z, true);
    if (w & 8) addWall(x, z, false);
    if (z === maze.h - 1 && (w & 4)) addWall(x, z + 1, true);
    if (x === maze.w - 1 && (w & 2)) addWall(x + 1, z, false);
  }

  /* Tapis de départ */
  const acc = hex(th.accent);
  cb.b.disc(0.62, 20, [0.3, 0.9, 0.4, 0.6], T([maze.start[0] * CS + CS / 2, 0.012, maze.start[1] * CS + CS / 2]));

  /* Décors autour du labyrinthe */
  const margin = 1.6;
  const placeAround = (fn, count, minD, maxD) => {
    for (let i = 0; i < count; i++) {
      let x, z, tries = 0;
      do {
        const side = Math.floor(rng() * 4), d = minD + rng() * (maxD - minD);
        if (side === 0) { x = -d; z = -maxD + rng() * (H + 2 * maxD); }
        else if (side === 1) { x = W + d; z = -maxD + rng() * (H + 2 * maxD); }
        else if (side === 2) { z = -d; x = -maxD + rng() * (W + 2 * maxD); }
        else { z = H + d; x = -maxD + rng() * (W + 2 * maxD); }
        tries++;
      } while (tries < 5 && x > -margin && x < W + margin && z > -margin && z < H + margin);
      fn(cb.b, T([x, 0, z], rng() * Math.PI * 2), rng);
    }
  };
  const bigProps = { peak: [22, 60], volcano: [18, 50], dune: [8, 40], building: [4, 40], planet: [8, 50], asteroid: [3, 30], satellite: [6, 30] };
  const sizeScale = Math.min(1.8, 0.7 + maze.w / 12);
  for (const [name, count] of th.props) {
    const rng2 = bigProps[name] || [margin, 14 + maze.w * 0.4];
    placeAround(PROPS[name], Math.round(count * sizeScale), rng2[0], rng2[1]);
  }

  const meshes = cb.build(gl);
  const world = new Node();
  for (const m of meshes) world.add(new Node(m));

  /* Ciel */
  const s0 = hex(th.sky[0]), s1 = hex(th.sky[1]);
  const skyB = new MeshBuilder();
  skyB.sphere(300, 16, 12, (x, y, z) => { const t = clamp(y / 300, -0.1, 1); const c = mixc(s1, s0, Math.pow(Math.max(t, 0), 0.6)); return [c[0], c[1], c[2], 1]; }, null);
  const sky = new Node(skyB.build(gl)); sky.noFog = true; sky.doubleSided = true;
  /* Soleil / lune */
  if (th.sunDisc || th.moon) {
    const c = hex(th.sunDisc || th.moon);
    const sb = new MeshBuilder();
    const d = th.sun; const l = Math.hypot(d[0], d[1], d[2]);
    const p = [d[0] / l * 240, d[1] / l * 240, d[2] / l * 240];
    sb.sphere(th.moon ? 10 : 14, 14, 10, [c[0], c[1], c[2], 1], T(p));
    sb.sphere(th.moon ? 14 : 22, 14, 10, [c[0], c[1], c[2], 1], T(p));
    const sun = new Node(sb.build(gl)); sun.noFog = true;
    if (th.moon) sun.alpha = 0.95; else sun.alpha = 0.55; sun.additive = true;
    sky.add(sun);
  }
  /* Nuages */
  let clouds = null;
  if (th.clouds) {
    const cbld = new MeshBuilder();
    for (let i = 0; i < 14; i++) {
      const x = -60 + rng() * (W + 120), z = -60 + rng() * (H + 120), y = 16 + rng() * 8, s = 2 + rng() * 3;
      for (let k = 0; k < 4; k++) cbld.sphere(s * (0.6 + rng() * 0.5), 8, 6, [1, 1, 1, 0.75], T([x + (k - 1.5) * s * 0.9, y + rng() * s * 0.3, z + (rng() - 0.5) * s]), [1, 0.55, 1]);
    }
    clouds = new Node(cbld.build(gl)); clouds.alpha = 0.9;
  }

  return { world, sky, clouds, theme: th, vertexCount: meshes.reduce((a, m) => a + m.vertexCount, 0), drawMeshes: meshes.length };
}

/* ---------- Objets dynamiques : portail, étoiles, flèche ---------- */
function buildPortal(gl, accent) {
  const c = hex(accent);
  const g = new Node();
  const ring1 = new Node((new MeshBuilder()).torus(0.7, 0.07, 28, 8, [c[0], c[1], c[2], 0.9]).build(gl)); ring1.position = [0, 0.08, 0];
  const ring2 = new Node((new MeshBuilder()).torus(0.45, 0.05, 24, 8, [1, 1, 1, 0.9]).build(gl)); ring2.position = [0, 0.3, 0];
  const beamB = new MeshBuilder();
  beamB.cylinder(0.55, 0.35, 7, 16, [c[0], c[1], c[2], 1], T([0, 3.5, 0]), { noTop: true, noBottom: true });
  const beam = new Node(beamB.build(gl)); beam.alpha = 0.22; beam.additive = true; beam.doubleSided = true;
  const pad = new Node((new MeshBuilder()).disc(0.75, 24, [c[0], c[1], c[2], 1]).build(gl)); pad.position = [0, 0.02, 0]; pad.alpha = 0.5; pad.additive = true;
  const star = new Node((new MeshBuilder()).star(0.35, 0.16, 0.1, [1, 0.9, 0.3, 0.9]).build(gl)); star.position = [0, 1.6, 0];
  g.add(ring1); g.add(ring2); g.add(beam); g.add(pad); g.add(star);
  return { node: g, ring1, ring2, star, beam };
}
function buildStarMesh(gl) { return (new MeshBuilder()).star(0.24, 0.11, 0.08, [1, 0.85, 0.2, 0.85]).build(gl); }
function buildArrowMesh(gl) {
  const b = new MeshBuilder();
  const c = [1, 0.82, 0.2, 0.85];
  b.cylinder(0.06, 0.06, 0.4, 8, c, T([0, 0, 0.0], 0, Math.PI / 2, 0));
  b.cylinder(0.16, 0, 0.3, 10, c, T([0, 0, 0.35], 0, Math.PI / 2, 0));
  return b.build(gl);
}
function buildFlagMesh(gl) { /* petit drapeau au-dessus de la sortie pour la mini-vue */ return null; }
