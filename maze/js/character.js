/* ============================================================
   MazeRun — Personnage 3D stylisé (d'après les photos de référence)
   Cheveux bouclés bruns, t-shirt blanc oversize + imprimé au dos,
   short noir, chaussettes noires, baskets noires.
   ============================================================ */
'use strict';

const SKIN = [0.82, 0.60, 0.44];
const SKIN_DARK = [0.70, 0.50, 0.36];
const HAIR = [0.13, 0.085, 0.06];
const HAIR_HI = [0.20, 0.13, 0.09];
const BLACK = [0.07, 0.07, 0.08];
const BLACK_HI = [0.14, 0.14, 0.16];
const SOLE = [0.22, 0.22, 0.24];
const PRINT = [0.55, 0.56, 0.58];
const PRINT_DARK = [0.30, 0.31, 0.33];

function buildCharacter(gl, opts = {}) {
  const TEE = opts.tee ? hex(opts.tee) : [0.94, 0.94, 0.96];
  const TEE_SHADE = mulc(TEE, 0.86);
  const lum = TEE[0] * 0.3 + TEE[1] * 0.6 + TEE[2] * 0.1;
  const LOGO = lum > 0.55 ? [0.35, 0.36, 0.38] : [0.92, 0.92, 0.95];
  const rng = mulberry32(4242);
  const root = new Node();
  const body = root.add(new Node());
  const legL = root.add(new Node());
  const legR = root.add(new Node());
  legL.position = [-0.085, 0.60, 0]; legR.position = [0.085, 0.60, 0];

  /* ----- Jambes (pivot à la hanche, y=0.60) ----- */
  const legMesh = (side) => {
    const b = new MeshBuilder();
    // short (jambe)
    b.box(0.15, 0.24, 0.17, (x, y) => (y > 0.05 ? BLACK : BLACK_HI), T([0, -0.12, 0]));
    // ourlet du short légèrement plus large
    b.box(0.16, 0.03, 0.18, BLACK_HI, T([0, -0.245, 0]));
    // mollet / tibia
    b.cylinder(0.05, 0.055, 0.22, 10, (x, y) => (y < 0 ? SKIN : SKIN_DARK), T([0, -0.36, 0]));
    // chaussette
    b.cylinder(0.058, 0.056, 0.08, 10, BLACK, T([0, -0.50, 0]));
    // basket (chunky)
    b.box(0.13, 0.07, 0.25, BLACK_HI, T([0, -0.565, 0.035]));
    b.box(0.14, 0.03, 0.27, SOLE, T([0, -0.59, 0.035]));
    b.box(0.12, 0.04, 0.10, BLACK, T([0, -0.535, 0.09]));
    // petite marque claire sur la basket
    b.box(0.005, 0.02, 0.06, [0.6, 0.6, 0.62, 0.3], T([side * 0.068, -0.56, 0.02]));
    return b.build(gl);
  };
  legL.mesh = legMesh(-1); legR.mesh = legMesh(1);

  /* ----- Torse + short (hanches) ----- */
  {
    const b = new MeshBuilder();
    // hanches (short)
    b.box(0.33, 0.13, 0.19, BLACK, T([0, 0.63, 0]));
    // t-shirt oversize : légèrement évasé vers le bas
    b.box(0.40, 0.36, 0.23, (x, y, z, n) => (n[1] < 0 ? TEE_SHADE : (y < -0.14 ? TEE_SHADE : TEE)), T([0, 0.80, 0]));
    // col
    b.torus(0.075, 0.018, 16, 6, TEE_SHADE, T([0, 0.975, 0.0]));
    // petit logo poitrine (côté gauche du personnage)
    b.box(0.055, 0.035, 0.006, LOGO, T([0.10, 0.88, 0.117]));
    // imprimé au dos (photo de montagne + texte) — dos = -z
    b.box(0.17, 0.15, 0.006, PRINT, T([0, 0.82, -0.117]));
    b.box(0.15, 0.06, 0.007, PRINT_DARK, T([0, 0.855, -0.118]));
    b.box(0.15, 0.05, 0.007, [0.75, 0.76, 0.78], T([0, 0.795, -0.118]));
    b.box(0.13, 0.012, 0.008, PRINT_DARK, T([0, 0.735, -0.118]));
    b.box(0.005, 0.15, 0.008, TEE, T([0, 0.82, -0.119]));
    // cou
    b.cylinder(0.05, 0.055, 0.07, 10, SKIN_DARK, T([0, 0.99, 0]));
    body.mesh = b.build(gl);
  }

  /* ----- Bras (pivot épaule y=0.92, x=±0.22) ----- */
  const armL = body.add(new Node()); const armR = body.add(new Node());
  armL.position = [-0.225, 0.92, 0]; armR.position = [0.225, 0.92, 0];
  const armMesh = (side) => {
    const b = new MeshBuilder();
    // manche courte
    b.box(0.12, 0.17, 0.19, (x, y, z, n) => (n[1] < 0 ? TEE_SHADE : TEE), T([side * 0.005, -0.06, 0]));
    // bras
    b.cylinder(0.045, 0.04, 0.22, 10, SKIN, T([0, -0.22, 0]));
    // main
    b.sphere(0.05, 10, 8, SKIN, T([0, -0.345, 0]), [1, 1.15, 0.9]);
    return b.build(gl);
  };
  armL.mesh = armMesh(-1); armR.mesh = armMesh(1);

  /* ----- Tête (pivot cou y=1.02) ----- */
  const head = body.add(new Node());
  head.position = [0, 1.02, 0];
  {
    const b = new MeshBuilder();
    // crâne
    b.sphere(0.135, 18, 14, (x, y, z) => (z < -0.02 ? SKIN_DARK : SKIN), T([0, 0.12, 0.005]), [0.95, 1.08, 1]);
    // oreilles
    b.sphere(0.03, 8, 6, SKIN_DARK, T([-0.125, 0.10, 0.0]), [0.6, 1, 0.8]);
    b.sphere(0.03, 8, 6, SKIN_DARK, T([0.125, 0.10, 0.0]), [0.6, 1, 0.8]);
    // yeux
    for (const s of [-1, 1]) {
      b.sphere(0.03, 10, 8, [0.97, 0.97, 0.97, 0.15], T([s * 0.05, 0.13, 0.115]), [1, 1, 0.6]);
      b.sphere(0.016, 8, 6, [0.20, 0.13, 0.08, 0.2], T([s * 0.05, 0.13, 0.133]));
      b.sphere(0.008, 6, 4, [0.05, 0.04, 0.03, 0.3], T([s * 0.05, 0.132, 0.146]));
      b.sphere(0.004, 6, 4, [1, 1, 1, 1], T([s * 0.045, 0.14, 0.152]));
      // sourcils
      b.box(0.055, 0.012, 0.012, HAIR, T([s * 0.05, 0.168, 0.13], 0, 0, -s * 0.10));
    }
    // nez
    b.sphere(0.02, 8, 6, SKIN_DARK, T([0, 0.10, 0.135]), [0.8, 1.1, 1]);
    // bouche (léger sourire)
    b.box(0.05, 0.012, 0.01, [0.62, 0.32, 0.30, 0.1], T([0, 0.055, 0.128]));
    b.box(0.014, 0.014, 0.01, [0.62, 0.32, 0.30, 0.1], T([-0.028, 0.062, 0.127], 0, 0, 0.6));
    b.box(0.014, 0.014, 0.01, [0.62, 0.32, 0.30, 0.1], T([0.028, 0.062, 0.127], 0, 0, -0.6));
    // cheveux : calotte + boucles
    b.sphere(0.135, 16, 12, HAIR, T([0, 0.19, -0.045]), [1.06, 0.85, 1.0]);
    const curls = 44;
    let placed = 0, guard = 0;
    while (placed < curls && guard++ < 600) {
      const phi = rng() * Math.PI * 2;          // autour de l'axe Y (cos(phi)>0 = devant)
      const theta = rng() * 1.25;               // 0 = sommet, ~1.25 = niveau des oreilles
      const front = Math.cos(phi);
      // autorisé : calotte (haut), moitié arrière, côtés jusqu'aux oreilles — jamais le visage
      const ok = theta < 0.45 || front < -0.2 || (Math.abs(front) < 0.4 && theta < 1.05);
      if (!ok) continue;
      placed++;
      const rr = 0.15;
      const x = Math.sin(theta) * Math.sin(phi) * rr;
      const z = Math.sin(theta) * front * rr - 0.02;
      const y = Math.cos(theta) * rr + 0.15;
      const r = 0.034 + rng() * 0.026;
      const c = rng() < 0.3 ? HAIR_HI : HAIR;
      b.sphere(r, 8, 6, c, T([x, y, z]), [1, 0.9 + rng() * 0.3, 1]);
    }
    // mèches tombant sur les côtés/arrière (longueur nuque)
    for (let i = 0; i < 10; i++) {
      const phi = Math.PI * 0.62 + (i / 9) * Math.PI * 0.76; // côté gauche -> arrière -> côté droit
      const x = Math.sin(phi) * 0.14, z = Math.cos(phi) * 0.14 - 0.02;
      b.sphere(0.042, 8, 6, HAIR, T([x, 0.04 + (i % 2) * 0.02, z]), [1, 1.25, 1]);
    }
    // frange bouclée
    for (let i = 0; i < 5; i++) {
      const x = -0.09 + i * 0.045;
      b.sphere(0.038, 8, 6, i % 2 ? HAIR_HI : HAIR, T([x, 0.262 - Math.abs(x) * 0.4, 0.095]));
    }
    head.mesh = b.build(gl);
  }

  /* ----- Ombre portée (disque translucide) ----- */
  const shadow = new Node((new MeshBuilder()).disc(0.30, 20, [0, 0, 0, 1]).build(gl));
  shadow.position = [0, 0.012, 0]; shadow.alpha = 0.35;
  root.add(shadow);

  const ch = {
    root, body, head, armL, armR, legL, legR, shadow,
    phase: 0, mode: 'idle', t: 0,
    update(dt, speedRatio) {
      this.t += dt;
      const t = this.t;
      if (this.mode === 'walk' || this.mode === 'idle') {
        const s = clamp(speedRatio, 0, 1);
        this.phase += dt * (6 + 8 * s) * (s > 0.02 ? 1 : 0);
        const sw = Math.sin(this.phase);
        legL.rotation[0] = sw * 0.75 * s; legR.rotation[0] = -sw * 0.75 * s;
        armL.rotation[0] = -sw * 0.55 * s + Math.sin(t * 1.7) * 0.03;
        armR.rotation[0] = sw * 0.55 * s - Math.sin(t * 1.7) * 0.03;
        armL.rotation[2] = 0.08 + Math.sin(t * 2.1) * 0.02; armR.rotation[2] = -0.08 - Math.sin(t * 2.1) * 0.02;
        body.position[1] = Math.abs(Math.sin(this.phase * 1)) * 0.045 * s + Math.sin(t * 2) * 0.008;
        body.rotation[0] = 0.08 * s; body.rotation[2] = 0;
        head.rotation[0] = -0.06 * s + Math.sin(t * 1.3) * 0.03;
        head.rotation[1] = Math.sin(t * 0.7) * 0.12 * (1 - s);
        root.rotation[2] = 0; root.rotation[0] = 0;
        this.jump = 0;
      } else if (this.mode === 'win') {
        // saute et lève les bras
        const p = t * 7;
        this.jump = Math.abs(Math.sin(p)) * 0.35;
        body.position[1] = 0;
        body.rotation[0] = 0;
        armL.rotation[0] = -2.6 + Math.sin(p) * 0.25; armR.rotation[0] = -2.6 - Math.sin(p) * 0.25;
        armL.rotation[2] = 0.5; armR.rotation[2] = -0.5;
        legL.rotation[0] = Math.sin(p) * 0.25; legR.rotation[0] = -Math.sin(p) * 0.25;
        head.rotation[0] = -0.25; head.rotation[1] = Math.sin(t * 3) * 0.2;
        root.rotation[1] += dt * 5;
      } else if (this.mode === 'wave') {
        // salue de la main (menu)
        body.position[1] = Math.sin(t * 2) * 0.01; body.rotation[0] = 0; body.rotation[2] = 0;
        legL.rotation[0] = 0; legR.rotation[0] = 0;
        armL.rotation[0] = 0.1; armL.rotation[2] = 0.1;
        armR.rotation[0] = -0.3; armR.rotation[2] = -2.45 + Math.sin(t * 9) * 0.3;
        head.rotation[0] = -0.08; head.rotation[1] = Math.sin(t * 1.5) * 0.15; head.rotation[2] = 0.1;
        root.rotation[0] = 0; root.rotation[2] = 0; this.jump = 0;
      } else if (this.mode === 'lose') {
        body.rotation[0] = 0.35; head.rotation[0] = 0.55; head.rotation[1] = 0;
        armL.rotation[0] = 0.2; armR.rotation[0] = 0.2; armL.rotation[2] = 0.15; armR.rotation[2] = -0.15;
        legL.rotation[0] = 0; legR.rotation[0] = 0; body.position[1] = -0.02;
        this.jump = 0;
      }
    }
  };
  ch.jump = 0;
  return ch;
}
