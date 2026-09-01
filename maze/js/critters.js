/* ============================================================
   MazeRun — Créatures d'ambiance animées (vol au-dessus du labyrinthe)
   Une espèce par décor, maillages partagés, ailes articulées.
   ============================================================ */
'use strict';

const CRITTER_BY_THEME = {
  prairie: 'butterfly', jungle: 'parrot', beach: 'gull', desert: 'vulture', mountain: 'eagle',
  autumn: 'crow', volcano: 'bat', ice: 'owl', neon: 'drone', space: 'ufo',
};

/* Paramètres d'espèce : couleur, taille, altitude, vitesse de battement, trajectoire */
const SPECIES = {
  butterfly: { kind: 'butterfly', n: 7, h: [1.4, 2.6], speed: 0.9, flap: 14, size: 0.55, path: 'wander',
    palette: [[1, 0.45, 0.2], [1, 0.8, 0.2], [0.55, 0.4, 1], [0.3, 0.8, 1], [1, 0.35, 0.6]] },
  parrot: { kind: 'bird', n: 4, h: [3, 5], speed: 0.55, flap: 9, size: 1, path: 'circle',
    palette: [[0.95, 0.15, 0.15], [0.2, 0.75, 0.3], [0.2, 0.45, 1]], wing: [0.15, 0.55, 0.95] },
  gull: { kind: 'bird', n: 5, h: [3.5, 5.5], speed: 0.45, flap: 5, size: 1, path: 'circle', palette: [[0.97, 0.97, 1]], wing: [0.75, 0.78, 0.85] },
  vulture: { kind: 'bird', n: 3, h: [4.5, 6], speed: 0.25, flap: 1.6, size: 1.35, path: 'circle', palette: [[0.2, 0.15, 0.13]], wing: [0.15, 0.12, 0.1] },
  eagle: { kind: 'bird', n: 3, h: [4, 6], speed: 0.35, flap: 2.2, size: 1.3, path: 'circle', palette: [[0.35, 0.22, 0.12]], wing: [0.28, 0.18, 0.1], head: [0.95, 0.95, 0.9] },
  crow: { kind: 'bird', n: 5, h: [3, 5], speed: 0.5, flap: 7, size: 0.9, path: 'circle', palette: [[0.08, 0.08, 0.1]], wing: [0.05, 0.05, 0.07] },
  bat: { kind: 'bird', n: 7, h: [2.5, 4.5], speed: 0.9, flap: 16, size: 0.7, path: 'wander', palette: [[0.12, 0.08, 0.1]], wing: [0.18, 0.1, 0.12] },
  owl: { kind: 'bird', n: 3, h: [3, 4.5], speed: 0.3, flap: 3.5, size: 1.1, path: 'circle', palette: [[0.95, 0.95, 0.98]], wing: [0.8, 0.82, 0.88] },
  drone: { kind: 'drone', n: 5, h: [3, 5], speed: 0.6, flap: 0, size: 1, path: 'lines', palette: [[0.15, 0.15, 0.2]], light: [[1, 0.2, 0.7], [0.15, 0.95, 1]] },
  ufo: { kind: 'ufo', n: 3, h: [5, 6.5], speed: 0.2, flap: 0, size: 1, path: 'circle', palette: [[0.75, 0.78, 0.85]], light: [[0.4, 1, 0.5], [1, 0.9, 0.3]] },
};

/* Construit les maillages partagés d'une espèce : corps + aile gauche + aile droite */
function buildCritterMeshes(gl, sp, rng) {
  const body = new MeshBuilder(), wl = new MeshBuilder(), wr = new MeshBuilder();
  const S = sp.size;
  const col = sp.palette[Math.floor(rng() * sp.palette.length)];
  if (sp.kind === 'butterfly') {
    body.cylinder(0.025 * S, 0.02 * S, 0.3 * S, 6, [0.15, 0.1, 0.08], T([0, 0, 0], 0, Math.PI / 2, 0));
    body.sphere(0.035 * S, 6, 5, [0.15, 0.1, 0.08], T([0, 0, 0.16 * S]));
    const c2 = mulc(col, 0.7);
    for (const [b, side] of [[wl, -1], [wr, 1]]) {
      // grande aile avant + petite aile arrière, motif plus sombre au bord
      b.box(0.3 * S, 0.01, 0.26 * S, (x, y, z) => (Math.abs(x) > 0.11 * S ? [c2[0], c2[1], c2[2], 0.25] : [col[0], col[1], col[2], 0.35]), T([side * 0.16 * S, 0, 0.06 * S]));
      b.box(0.22 * S, 0.01, 0.18 * S, [c2[0], c2[1], c2[2], 0.3], T([side * 0.12 * S, -0.002, -0.12 * S]));
    }
  } else if (sp.kind === 'bird') {
    const wing = sp.wing || mulc(col, 0.8), head = sp.head || col;
    body.sphere(0.13 * S, 10, 8, col, T([0, 0, 0]), [0.9, 0.8, 1.9]);
    body.sphere(0.085 * S, 8, 6, head, T([0, 0.06 * S, 0.24 * S]));
    body.cylinder(0.03 * S, 0, 0.1 * S, 5, [0.95, 0.7, 0.2], T([0, 0.05 * S, 0.34 * S], 0, Math.PI / 2, 0));
    body.box(0.12 * S, 0.02 * S, 0.2 * S, wing, T([0, 0.02 * S, -0.3 * S]));
    body.sphere(0.018 * S, 5, 4, [0.05, 0.05, 0.05, 0.3], T([-0.05 * S, 0.09 * S, 0.29 * S]));
    body.sphere(0.018 * S, 5, 4, [0.05, 0.05, 0.05, 0.3], T([0.05 * S, 0.09 * S, 0.29 * S]));
    for (const [b, side] of [[wl, -1], [wr, 1]]) {
      b.box(0.5 * S, 0.02 * S, 0.24 * S, wing, T([side * 0.3 * S, 0, -0.02 * S]));
      b.box(0.24 * S, 0.018 * S, 0.16 * S, mulc(wing, 0.85), T([side * 0.64 * S, 0, -0.06 * S], 0, 0, side * 0.15));
    }
  } else if (sp.kind === 'drone') {
    const L = sp.light[Math.floor(rng() * sp.light.length)];
    body.box(0.34 * S, 0.1 * S, 0.34 * S, col, T([0, 0, 0]));
    body.sphere(0.06 * S, 8, 6, [L[0], L[1], L[2], 1], T([0, -0.07 * S, 0]));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) body.cylinder(0.025 * S, 0.025 * S, 0.18 * S, 5, [0.3, 0.3, 0.35], T([x * 0.26 * S, 0.04 * S, z * 0.26 * S]));
    // hélices : les deux "ailes" tournent sur l'axe Y
    for (const [b, side] of [[wl, -1], [wr, 1]]) {
      b.box(0.02 * S, 0.006, 0.3 * S, [0.5, 0.5, 0.55, 0.4], T([side * 0.26 * S, 0.14 * S, -0.26 * S]));
      b.box(0.02 * S, 0.006, 0.3 * S, [0.5, 0.5, 0.55, 0.4], T([side * 0.26 * S, 0.14 * S, 0.26 * S], 0.7));
    }
  } else if (sp.kind === 'ufo') {
    const L = sp.light[Math.floor(rng() * sp.light.length)];
    body.cylinder(0.75 * S, 0.45 * S, 0.14 * S, 18, col, T([0, 0, 0]));
    body.cylinder(0.45 * S, 0.65 * S, 0.14 * S, 18, mulc(col, 0.85), T([0, -0.14 * S, 0]));
    body.sphere(0.3 * S, 12, 8, [0.6, 0.9, 1, 0.5], T([0, 0.12 * S, 0]), [1, 0.7, 1]);
    body.disc(0.3 * S, 16, [L[0], L[1], L[2], 1], T([0, -0.22 * S, 0], 0, Math.PI, 0));
    // les "ailes" servent d'anneau de feux tournants
    for (const [b, k] of [[wl, 0], [wr, 1]]) for (let i = 0; i < 6; i++) {
      const a = (i + k * 0.5) / 6 * Math.PI * 2;
      b.sphere(0.06 * S, 6, 5, k ? [L[0], L[1], L[2], 1] : [1, 1, 1, 1], T([Math.cos(a) * 0.6 * S, 0.02 * S, Math.sin(a) * 0.6 * S]));
    }
  }
  return { body: body.build(gl), wl: wl.build(gl), wr: wr.build(gl) };
}

class Flock {
  constructor(gl, theme, W, H, rng) {
    const name = CRITTER_BY_THEME[theme] || 'butterfly';
    const sp = this.sp = SPECIES[name];
    this.root = new Node();
    this.meshes = [];
    this.items = [];
    const variants = sp.palette.length > 1 ? Math.min(3, sp.n) : 1;
    for (let v = 0; v < variants; v++) this.meshes.push(buildCritterMeshes(gl, sp, rng));
    for (let i = 0; i < sp.n; i++) {
      const m = this.meshes[i % this.meshes.length];
      const root = this.root.add(new Node());
      const body = root.add(new Node(m.body));
      const wl = body.add(new Node(m.wl)), wr = body.add(new Node(m.wr));
      const item = {
        root, body, wl, wr,
        cx: -3 + rng() * (W + 6), cz: -3 + rng() * (H + 6),
        r: 3 + rng() * (Math.max(W, H) * 0.35 + 2), w: (0.25 + rng() * 0.35) * sp.speed * (rng() < 0.5 ? 1 : -1),
        h: sp.h[0] + rng() * (sp.h[1] - sp.h[0]), ph: rng() * Math.PI * 2, flap: sp.flap * (0.85 + rng() * 0.3),
        // trajets en ligne (drones) : d'un point à un autre
        ax: rng() * W, az: rng() * H, bx: rng() * W, bz: rng() * H, seg: 0,
      };
      this.items.push(item);
    }
    this.W = W; this.H = H; this.rng = rng;
  }
  update(dt, t) {
    const sp = this.sp;
    for (const it of this.items) {
      let x, z, y, face;
      if (sp.path === 'circle') {
        const a = it.ph + t * it.w;
        x = it.cx + Math.cos(a) * it.r; z = it.cz + Math.sin(a) * it.r;
        y = it.h + Math.sin(t * 0.9 + it.ph) * 0.35;
        face = -a + (it.w > 0 ? -Math.PI / 2 : Math.PI / 2);
        it.root.rotation[2] = (it.w > 0 ? -1 : 1) * 0.35; // incline dans le virage
      } else if (sp.path === 'wander') {
        x = it.cx + Math.sin(t * 0.55 * sp.speed + it.ph) * it.r * 0.6 + Math.sin(t * 2.1 + it.ph * 3) * 0.6;
        z = it.cz + Math.cos(t * 0.42 * sp.speed + it.ph * 1.7) * it.r * 0.6 + Math.cos(t * 1.7 + it.ph) * 0.6;
        y = it.h + Math.sin(t * 3.1 + it.ph) * 0.25 + Math.sin(t * 0.7) * 0.2;
        const px = it.lx == null ? x : it.lx, pz = it.lz == null ? z : it.lz;
        face = Math.atan2(x - px, z - pz); if (Math.hypot(x - px, z - pz) < 1e-4) face = it.root.rotation[1];
        it.lx = x; it.lz = z;
      } else { // lines
        it.seg += dt * 0.12 * sp.speed * 2;
        if (it.seg >= 1) { it.seg = 0; it.ax = it.bx; it.az = it.bz; it.bx = -2 + this.rng() * (this.W + 4); it.bz = -2 + this.rng() * (this.H + 4); }
        const e = smoothstep(it.seg);
        x = lerp(it.ax, it.bx, e); z = lerp(it.az, it.bz, e);
        y = it.h + Math.sin(t * 2 + it.ph) * 0.15;
        face = Math.atan2(it.bx - it.ax, it.bz - it.az);
        it.root.rotation[0] = 0.25 * Math.sin(e * Math.PI); // pique vers l'avant
      }
      it.root.position[0] = x; it.root.position[1] = y; it.root.position[2] = z;
      it.root.rotation[1] = face;
      if (sp.kind === 'drone') { it.wl.rotation[1] += dt * 40; it.wr.rotation[1] -= dt * 40; }
      else if (sp.kind === 'ufo') { it.wl.rotation[1] += dt * 1.5; it.wr.rotation[1] -= dt * 0.9; it.body.rotation[1] += dt * 0.6; }
      else {
        const f = Math.sin(t * it.flap + it.ph) * (sp.kind === 'butterfly' ? 1.1 : 0.6);
        it.wl.rotation[2] = -f; it.wr.rotation[2] = f;
        if (sp.kind === 'bird') it.body.rotation[0] = 0.08 + Math.sin(t * it.flap + it.ph) * 0.04;
      }
    }
  }
  dispose() { for (const m of this.meshes) { m.body.dispose(); m.wl.dispose(); m.wr.dispose(); } }
}
