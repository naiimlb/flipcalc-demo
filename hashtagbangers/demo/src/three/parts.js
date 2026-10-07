import {
  Group, Mesh, InstancedMesh, Shape, Vector2, Vector3, Quaternion, Matrix4, Color, Euler,
  LatheGeometry, ExtrudeGeometry, ShapeGeometry, CircleGeometry, SphereGeometry, PlaneGeometry,
  CapsuleGeometry, BoxGeometry, TorusGeometry, CylinderGeometry, TubeGeometry, SplineCurve, CatmullRomCurve3,
  BufferAttribute, MeshStandardMaterial, MeshPhysicalMaterial, DoubleSide,
} from 'three';

// Constructeurs procéduraux, un par ingrédient.
// Chaque constructeur renvoie une "part" : { object, params, update(dt, t, L, ctx) }.
// `object` est posé à y = 0 (bas de la couche) ; le Group de la couche gère l'empilement.
// `params` contient les valeurs que GSAP anime (fonte, éclaboussure, pluie…).

const UP = new Vector3(0, 1, 0);
const _v = new Vector3(), _v2 = new Vector3(), _q = new Quaternion(), _q2 = new Quaternion();
const _m = new Matrix4(), _s = new Vector3(), _e = new Euler();

// ---------- utilitaires ----------
function blobShape(rand, R, harmonics, n, jitter) {
  const ph = harmonics.map(() => rand() * Math.PI * 2);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    let r = R;
    harmonics.forEach(([k, amp], j) => { r += R * amp * Math.sin(k * a + ph[j]); });
    r += (rand() - 0.5) * 2 * jitter * R;
    pts.push(new Vector2(Math.cos(a) * r, Math.sin(a) * r));
  }
  return new Shape(pts);
}

// Extrusion "à plat" : la forme 2D est couchée dans le plan XZ, épaisseur vers +Y, base à y = 0.
function flatExtrude(shape, depth, bevelT, bevelS, bevelSeg = 3) {
  const g = new ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevelT > 0, bevelThickness: bevelT, bevelSize: bevelS,
    bevelSegments: bevelSeg, curveSegments: 1, steps: 1,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevelT, 0);
  return g;
}

function hex(c) { return new Color(c); }

// Couleurs de sommets selon un dégradé (fonction d'un scalaire par sommet).
function paint(geo, stops, scalar) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const cols = stops.map(([s, c]) => [s, hex(c)]);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const s = scalar(pos.getX(i), pos.getY(i), pos.getZ(i));
    let k = 0;
    while (k < cols.length - 2 && s > cols[k + 1][0]) k++;
    const [s0, c0] = cols[k], [s1, c1] = cols[k + 1];
    const f = Math.min(1, Math.max(0, (s - s0) / (s1 - s0 || 1)));
    c.copy(c0).lerp(c1, f);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  return geo;
}

function lathe(points, segments, n) {
  const pts = new SplineCurve(points.map(([x, y]) => new Vector2(x, y))).getPoints(n);
  return new LatheGeometry(pts, segments);
}

// Graines de sésame (InstancedMesh) posées sur une surface de révolution.
function sesame(ctx, count, sample, mat) {
  const geo = new SphereGeometry(0.034, 8, 6);
  geo.scale(1, 0.4, 0.55);
  const mesh = new InstancedMesh(geo, mat, count);
  const base = [];
  const placed = [];
  let tries = 0;
  while (base.length < count && tries++ < count * 40) {
    const s = sample(ctx.rand);
    if (!s) continue;
    const [p, n] = s;
    if (placed.some((o) => o.distanceToSquared(p) < 0.0095)) continue;
    placed.push(p);
    _q.setFromUnitVectors(UP, n);
    _q2.setFromAxisAngle(UP, ctx.rand() * Math.PI);
    const q = _q.clone().multiply(_q2);
    const sc = 0.85 + ctx.rand() * 0.3;
    base.push({ p: p.clone().addScaledVector(n, 0.006), n: n.clone(), q, s: sc, ph: ctx.rand() * 100 });
  }
  mesh.count = base.length;
  const write = (amp, t) => {
    base.forEach((b, i) => {
      _v.copy(b.p);
      if (amp > 0) _v.addScaledVector(b.n, Math.sin(t * 55 + b.ph) * 0.016 * amp + 0.01 * amp);
      _s.setScalar(b.s);
      _m.compose(_v, b.q, _s);
      mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  write(0, 0);
  return { mesh, write };
}

const bunColors = (ctx) => ({
  crumb: new MeshStandardMaterial({ map: ctx.tex.crumb, roughness: 0.9 }),
  seed: new MeshStandardMaterial({ color: '#f1dcae', roughness: 0.5 }),
});

// ---------- 1. pain du bas ----------
export function bunBottom(ctx) {
  const object = new Group();
  const geo = lathe([[0, 0], [0.55, 0], [0.86, 0.012], [0.975, 0.07], [1.025, 0.17], [1.02, 0.27], [0.985, 0.345], [0.935, 0.385], [0.88, 0.4]], 64, 30);
  paint(geo, [[0, '#b8661f'], [0.08, '#dc913c'], [0.22, '#e9a650'], [0.36, '#d6873a'], [0.4, '#c5742c']], (x, y) => y);
  const mat = new MeshStandardMaterial({ vertexColors: true, map: ctx.tex.bun, roughness: 0.55 });
  const body = new Mesh(geo, mat);
  const { crumb, seed } = bunColors(ctx);
  const cut = new Mesh(new CircleGeometry(0.885, 56).rotateX(-Math.PI / 2), crumb);
  cut.position.y = 0.398;
  const { mesh: seeds } = sesame(ctx, 34, (r) => {
    const y = 0.14 + r() * 0.17, a = r() * Math.PI * 2;
    const rad = 1.02 - Math.pow((y - 0.2) / 0.25, 2) * 0.12;
    return [new Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad), new Vector3(Math.cos(a), 0.15, Math.sin(a)).normalize()];
  }, seed);
  object.add(body, cut, seeds);
  return { object, params: {}, update() {} };
}

// ---------- 10. pain du haut (charnière à l'arrière pour l'ouverture "coffre") ----------
export function bunTop(ctx) {
  const object = new Group();
  const hinge = new Group();
  hinge.position.z = -0.98;
  const body = new Group();
  body.position.z = 0.98;
  hinge.add(body);
  object.add(hinge);

  const Rr = 1.06, y0 = 0.1, H = 0.66, e = 2 / 2.7;
  const dome = (a) => [Rr * Math.pow(Math.cos(a), e), y0 + H * Math.pow(Math.sin(a), e)];
  const prof = [[0.94, 0], [1.02, 0.025], [1.055, 0.07]];
  for (let i = 0; i <= 14; i++) prof.push(dome((i / 14) * (Math.PI / 2)));
  const geo = lathe(prof, 72, 44);
  paint(geo, [[0, '#efc177'], [0.09, '#e9a24a'], [0.28, '#d9822e'], [0.55, '#c4661d'], [0.76, '#a94e14']], (x, y) => y);
  const mat = new MeshPhysicalMaterial({
    vertexColors: true, map: ctx.tex.bun, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.3,
  });
  const shell = new Mesh(geo, mat);
  const { crumb, seed } = bunColors(ctx);
  const cut = new Mesh(new CircleGeometry(0.955, 56).rotateX(Math.PI / 2), crumb);
  cut.position.y = 0.002;
  const seeds = sesame(ctx, 140, (r) => {
    const a = 0.12 + Math.acos(1 - r() * 0.985) * 0.92;
    if (a > Math.PI / 2 - 0.02) return null;
    const phi = r() * Math.PI * 2;
    const [pr, py] = dome(a);
    const [pr1, py1] = dome(Math.min(a + 0.01, Math.PI / 2));
    const [pr0, py0] = dome(Math.max(a - 0.01, 0));
    const tr = pr1 - pr0, ty = py1 - py0;
    const n = new Vector3(ty * Math.cos(phi), -tr, ty * Math.sin(phi)).normalize();
    return [new Vector3(pr * Math.cos(phi), py, pr * Math.sin(phi)), n];
  }, seed);
  body.add(shell, cut, seeds.mesh);

  const params = { hinge: 0, vibrate: 0 };
  let lastVib = 0;
  return {
    object, params,
    update(dt, t) {
      hinge.rotation.x = -params.hinge * 0.95;
      if (params.vibrate > 0.002 || lastVib > 0) {
        seeds.write(params.vibrate, t);
        lastVib = params.vibrate > 0.002 ? 1 : 0;
      }
    },
  };
}

// ---------- 2. roquette ----------
function leafGeometry(rand) {
  const L = 0.66 + rand() * 0.24, n = 22;
  const right = [], left = [];
  const lobes = 3 + Math.floor(rand() * 2);
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.8);
    const lobe = Math.max(0, Math.sin(s * Math.PI * lobes * 2 - 0.6));
    right.push(new Vector2(s * L, (0.035 + 0.075 * lobe) * env + 0.012));
    left.push(new Vector2(s * L, -((0.035 + 0.07 * Math.max(0, Math.sin(s * Math.PI * lobes * 2 + 0.9))) * env + 0.012)));
  }
  const shape = new Shape([...right, ...left.reverse()]);
  const g = new ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), s = x / L;
    p.setY(i, -0.22 * s * s + 0.5 * z * z + Math.sin(s * 9) * 0.01);
  }
  g.computeVertexNormals();
  paint(g, [[0, '#9ccc5a'], [0.012, '#5aa336'], [0.05, '#3f8a28'], [0.12, '#2f6e1f']], (x, y, z) => Math.abs(z));
  return g;
}

export function roquette(ctx) {
  const object = new Group();
  const mat = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.6 });
  const leaves = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (ctx.rand() - 0.5) * 0.3;
    const pivot = new Group();
    const r0 = 0.4 + ctx.rand() * 0.16;
    pivot.position.set(Math.cos(a) * r0, 0.02 + ctx.rand() * 0.02, Math.sin(a) * r0);
    pivot.rotation.y = -a + (ctx.rand() - 0.5) * 0.4;
    const tilt = 0.12 + ctx.rand() * 0.1;
    pivot.rotation.z = tilt;
    pivot.add(new Mesh(leafGeometry(ctx.rand), mat));
    object.add(pivot);
    leaves.push({ pivot, tilt, ph: ctx.rand() * 10, f: 6 + ctx.rand() * 4 });
  }
  return {
    object, params: {},
    update(dt, t, L) {
      const w = 0.03 + 0.09 * L.ex;
      for (const l of leaves) {
        l.pivot.rotation.z = l.tilt + Math.sin(t * l.f + l.ph) * w * 0.6 + Math.sin(t * 2.1 + l.ph) * w * 0.4;
        l.pivot.rotation.x = Math.sin(t * l.f * 0.7 + l.ph * 2) * w;
      }
    },
  };
}

// ---------- 3/5. steak smash ----------
export function beef(ctx) {
  const object = new Group();
  const map = ctx.tex.beef.map.clone(); map.repeat.set(0.7, 0.7); map.offset.set(ctx.rand(), ctx.rand());
  const bump = ctx.tex.beef.bump.clone(); bump.repeat.copy(map.repeat); bump.offset.copy(map.offset);
  const mat = new MeshPhysicalMaterial({
    map, bumpMap: bump, bumpScale: 4, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5,
  });
  const body = new Mesh(flatExtrude(blobShape(ctx.rand, 1.06, [[3, 0.025], [5, 0.018], [8, 0.012]], 120, 0.012), 0.15, 0.045, 0.05), mat);
  // dentelle croustillante typique du smash : bord fin, irrégulier, plus foncé
  const laceMat = new MeshStandardMaterial({ map: ctx.tex.beef.map, color: '#c07a48', roughness: 0.75 });
  const lace = new Mesh(flatExtrude(blobShape(ctx.rand, 1.1, [[4, 0.02], [11, 0.02], [23, 0.015]], 160, 0.012), 0.03, 0, 0), laceMat);
  lace.position.y = 0.035;
  object.add(body, lace);
  const params = {};
  let steamT = 0, sparkT = 0;
  return {
    object, params,
    update(dt, t, L, c) {
      if (!c.fx || L.ex < 0.25) return;
      steamT += dt * 5 * L.ex * c.fx.budget;
      sparkT += dt * 4 * L.ex * c.fx.budget;
      while (steamT > 1) {
        steamT--;
        const a = Math.random() * Math.PI * 2, r = Math.random() * 0.9;
        object.localToWorld(_v.set(Math.cos(a) * r, 0.25, Math.sin(a) * r));
        c.fx.steam(_v);
      }
      while (sparkT > 1) {
        sparkT--;
        const a = Math.random() * Math.PI * 2;
        object.localToWorld(_v.set(Math.cos(a) * 1.08, 0.12, Math.sin(a) * 1.08));
        object.localToWorld(_v2.set(Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6)).sub(_v).normalize();
        c.fx.spark(_v, _v2);
      }
    },
  };
}

// ---------- 4/6. cheddar US qui fond ----------
export function cheddar(ctx) {
  const object = new Group();
  const size = 1.94, seg = 30;
  const geo = new PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(ctx.rand() * Math.PI * 0.5);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), d = Math.hypot(x, z);
    const cap = 1.24; // coins arrondis
    if (d > cap) pos.setXYZ(i, (x * cap) / d, 0, (z * cap) / d);
  }
  const base = pos.array.slice();
  const mat = new MeshStandardMaterial({
    color: '#f79a00', emissive: '#ff5a00', emissiveIntensity: 0.16, roughness: 0.4, side: DoubleSide,
  });
  const mesh = new Mesh(geo, mat);
  object.add(mesh);

  // au-delà du bord du steak, le cheddar est ramené contre le flanc et pend (plus il fond, plus il coule)
  const droop = (x, z, melt) => {
    const d = Math.hypot(x, z) || 1e-6, d0 = 0.9;
    const over = Math.max(0, d - d0);
    if (over === 0) return { k: 1, y: 0.014 };
    const a = Math.atan2(z, x);
    const wave = 1 + 0.3 * Math.sin(a * 5 + 1.3) + 0.15 * Math.sin(a * 9);
    const hang = Math.min(0.17 + 0.26 * melt, over * (0.8 + 0.9 * melt)) * wave;
    const rr = d0 + over * (0.42 - 0.12 * melt) + 0.11 * Math.min(1, over * 6);
    return { k: rr / d, y: 0.014 - hang * Math.min(1, over * 5 + 0.25) };
  };

  // coulures
  const dripGeo = new CapsuleGeometry(0.034, 0.16, 4, 8);
  dripGeo.translate(0, -0.115, 0);
  const drips = [];
  const corners = [];
  for (let i = 0; i < 4; i++) {
    const idx = [0, seg, (seg + 1) * seg, (seg + 1) * (seg + 1) - 1][i];
    corners.push([base[idx * 3], base[idx * 3 + 2]]);
  }
  for (let i = 0; i < 3; i++) {
    const a = ctx.rand() * Math.PI * 2;
    corners.push([Math.cos(a) * 1.0, Math.sin(a) * 1.0]);
  }
  for (const [x, z] of corners) {
    const m = new Mesh(dripGeo, mat);
    object.add(m);
    drips.push({ m, x, z, len: 0.5 + ctx.rand() * 0.8, ph: ctx.rand() * 6 });
  }

  const params = { melt: 0.12 };
  let last = -1;
  const deform = (melt, t) => {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      const { k, y } = droop(x, z, melt);
      pos.setXYZ(i, x * k, y + Math.sin(x * 7 + t * 2.2) * Math.sin(z * 6 - t * 1.7) * 0.007 * melt, z * k);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    for (const d of drips) {
      const { k, y } = droop(d.x, d.z, melt);
      d.m.position.set(d.x * k, y + 0.03, d.z * k);
      const s = (0.35 + melt * 1.3) * d.len * (1 + Math.sin(t * 1.3 + d.ph) * 0.12 * melt);
      d.m.scale.set(1, s, 1);
    }
  };
  deform(params.melt, 0);
  let dropT = 0;
  return {
    object, params, mat, droop,
    update(dt, t, L, c) {
      const melt = params.melt;
      if (melt > 0.15 || Math.abs(melt - last) > 0.002) { deform(melt, t); last = melt; }
      if (!c.fx || L.ex < 0.3 || !L.below) return;
      dropT += dt * 1.6 * L.ex * c.fx.budget;
      while (dropT > 1) {
        dropT--;
        const d = drips[(Math.random() * drips.length) | 0];
        d.m.localToWorld(_v.set(0, -0.23, 0));
        c.fx.drop(_v, c.floorOf(L.below), '#ffb000', 0.07);
      }
    },
  };
}

// ---------- 7. œuf au plat ----------
export function egg(ctx) {
  const object = new Group();
  const shape = blobShape(ctx.rand, 1.0, [[2, 0.05], [3, 0.06], [5, 0.025]], 80, 0.01);
  const geo = flatExtrude(shape, 0.03, 0.03, 0.07, 4);
  paint(geo, [[0, '#fffdf6'], [0.86, '#fffaf0'], [0.97, '#f2d6a0'], [1.1, '#d9964a']], (x, y, z) => Math.hypot(x, z));
  const whiteMat = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const white = new Mesh(geo, whiteMat);
  object.add(white);

  const yolkMat = new MeshPhysicalMaterial({
    color: '#ffa300', emissive: '#ff6200', emissiveIntensity: 0.28, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const yolkPivot = new Group();
  yolkPivot.position.set(0.12, 0.07, -0.05);
  const yolk = new Mesh(new SphereGeometry(0.33, 40, 24), yolkMat);
  yolkPivot.add(yolk);
  const spillGeo = new ShapeGeometry(blobShape(ctx.rand, 0.62, [[3, 0.12], [5, 0.08]], 48, 0.02));
  spillGeo.rotateX(-Math.PI / 2);
  const spill = new Mesh(spillGeo, yolkMat);
  spill.position.set(0.12, 0.096, -0.05);
  spill.scale.setScalar(0.001);
  object.add(yolkPivot, spill);

  // ressort amorti pour l'effet gelée
  const spring = { x: 0, v: 0 };
  const params = { splat: 1, splatY: 1, burst: 0, kick: (a) => { spring.v += a; } };
  return {
    object, params,
    update(dt, t, L) {
      const drive = Math.sin(t * 10) * 0.9 * L.ex + Math.sin(t * 2.3) * 0.15;
      const a = -260 * spring.x - 7 * spring.v + drive;
      spring.v += a * dt; spring.x += spring.v * dt;
      const j = Math.max(-0.4, Math.min(0.4, spring.x));
      const sq = 1 - params.burst * 0.35;
      yolk.scale.set((1 - j * 0.5) * (1 + params.burst * 0.25), 0.56 * (1 + j) * sq, (1 - j * 0.5) * (1 + params.burst * 0.25));
      white.scale.set(params.splat, params.splatY, params.splat);
      yolkPivot.position.y = 0.07 * params.splatY;
      const s = Math.max(0.001, params.burst);
      spill.scale.set(s, 1, s);
    },
  };
}

// ---------- 8. lardons fumés + oignons crispy ----------
export function crunch(ctx) {
  const object = new Group();
  const yolk = new Vector2(0.12, -0.05);
  const spot = (minYolk) => {
    for (let k = 0; k < 50; k++) {
      const a = ctx.rand() * Math.PI * 2, r = Math.sqrt(ctx.rand()) * 0.92;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - yolk.x, z - yolk.y) > minYolk) return [x, z];
    }
    return [0.8, 0];
  };
  const pieces = [];
  const bacon = new InstancedMesh(new BoxGeometry(0.21, 0.075, 0.1, 2, 1, 1), new MeshStandardMaterial({ map: ctx.tex.bacon, roughness: 0.45 }), 28);
  for (let i = 0; i < bacon.count; i++) {
    const [x, z] = spot(0.4);
    pieces.push({
      mesh: bacon, i, p: new Vector3(x, 0.04 + ctx.rand() * 0.03, z),
      q: new Quaternion().setFromEuler(_e.set((ctx.rand() - 0.5) * 0.5, ctx.rand() * Math.PI, (ctx.rand() - 0.5) * 0.5)),
      s: new Vector3(0.8 + ctx.rand() * 0.5, 0.9 + ctx.rand() * 0.3, 0.8 + ctx.rand() * 0.4),
      d: ctx.rand() * 0.6, spin: (ctx.rand() - 0.5) * 12,
    });
  }
  const onionGeo = new TorusGeometry(0.075, 0.022, 5, 12, 2.6);
  const onions = new InstancedMesh(onionGeo, new MeshStandardMaterial({ roughness: 0.62 }), 64);
  const oc = new Color();
  for (let i = 0; i < onions.count; i++) {
    const [x, z] = spot(0.3);
    pieces.push({
      mesh: onions, i, p: new Vector3(x, 0.05 + ctx.rand() * 0.05, z),
      q: new Quaternion().setFromEuler(_e.set(ctx.rand() * Math.PI, ctx.rand() * Math.PI, ctx.rand() * Math.PI)),
      s: new Vector3().setScalar(0.8 + ctx.rand() * 0.5),
      d: ctx.rand() * 0.6, spin: (ctx.rand() - 0.5) * 16,
    });
    onions.setColorAt(i, oc.set(['#e0962f', '#c97a22', '#f0b24c', '#b8651a'][i % 4]));
  }
  object.add(bacon, onions);
  const params = { rain: 1 };
  let last = -1;
  const bounce = (u) => {
    const n1 = 7.5625, d1 = 2.75;
    if (u < 1 / d1) return n1 * u * u;
    if (u < 2 / d1) return n1 * (u -= 1.5 / d1) * u + 0.75;
    if (u < 2.5 / d1) return n1 * (u -= 2.25 / d1) * u + 0.9375;
    return n1 * (u -= 2.625 / d1) * u + 0.984375;
  };
  const write = (rain) => {
    for (const pc of pieces) {
      const u = Math.min(1, Math.max(0, (rain * 1.0 - pc.d) / 0.4));
      const off = (1 - bounce(u)) * 3.4;
      _v.copy(pc.p); _v.y += off;
      _q2.setFromAxisAngle(UP, (1 - u) * pc.spin);
      _q.copy(pc.q).premultiply(_q2);
      _m.compose(_v, _q, pc.s);
      pc.mesh.setMatrixAt(pc.i, _m);
    }
    bacon.instanceMatrix.needsUpdate = true;
    onions.instanceMatrix.needsUpdate = true;
  };
  write(1);
  let crumbT = 0;
  return {
    object, params,
    update(dt, t, L, c) {
      if (params.rain !== last) { write(params.rain); last = params.rain; }
      if (!c.fx || L.ex < 0.3 || !L.below) return;
      crumbT += dt * 7 * L.ex * c.fx.budget;
      while (crumbT > 1) {
        crumbT--;
        const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.8;
        object.localToWorld(_v.set(Math.cos(a) * r, 0.0, Math.sin(a) * r));
        c.fx.crumb(_v, c.floorOf(L.below));
      }
    },
  };
}

// ---------- 9. sauce Bangers (orange) & BBQ ----------
export function sauce(ctx) {
  const object = new Group();
  const cover = new Group();
  object.add(cover);
  const mat = new MeshPhysicalMaterial({
    color: '#ff7a1a', emissive: '#c43c00', emissiveIntensity: 0.16, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08,
  });
  cover.add(new Mesh(flatExtrude(blobShape(ctx.rand, 0.92, [[3, 0.04], [6, 0.03], [9, 0.02]], 90, 0.008), 0.01, 0.02, 0.05), mat));
  const bbqMat = new MeshPhysicalMaterial({ color: '#5a1d0b', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
  const zig = [];
  for (let i = 0; i <= 9; i++) {
    const x = -0.7 + i * 0.155;
    const half = Math.sqrt(Math.max(0.02, 0.62 - x * x));
    zig.push(new Vector3(x, 0.06, (i % 2 ? 1 : -1) * half));
  }
  cover.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(zig), 120, 0.019, 6), bbqMat));
  const dripGeo = new CapsuleGeometry(0.05, 0.07, 4, 10);
  dripGeo.translate(0, -0.075, 0);
  const drips = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + ctx.rand() * 0.4;
    const m = new Mesh(dripGeo, mat);
    m.position.set(Math.cos(a) * 0.92, 0.03, Math.sin(a) * 0.92);
    cover.add(m);
    drips.push({ m, len: 0.6 + ctx.rand() * 1.1, ph: ctx.rand() * 6 });
  }
  const params = { cover: 1, drip: 1 };
  let dropT = 0;
  return {
    object, params,
    update(dt, t, L, c) {
      const s = Math.max(0.001, params.cover);
      cover.scale.set(s, Math.min(1, s * 1.5), s);
      for (const d of drips) {
        d.m.scale.set(1, Math.max(0.01, d.len * params.drip * (0.45 + 0.9 * L.ex + Math.sin(t * 1.7 + d.ph) * 0.08)), 1);
      }
      if (!c.fx || L.ex < 0.3 || !L.below) return;
      dropT += dt * 3.2 * L.ex * c.fx.budget;
      while (dropT > 1) {
        dropT--;
        const d = drips[(Math.random() * drips.length) | 0];
        d.m.localToWorld(_v.set(0, -0.15, 0));
        c.fx.drop(_v, c.floorOf(L.below), '#f5651b', 0.075);
      }
    },
  };
}

export const PARTS = { bunBottom, roquette, beef, cheddar, egg, crunch, sauce, bunTop };

// Filaments de fromage (tirés entre une tranche et le steak du dessous).
export function cheeseStrings(mat, count) {
  const geo = new CylinderGeometry(1, 1, 1, 6, 1, true);
  geo.translate(0, -0.5, 0);
  const list = [];
  for (let i = 0; i < count; i++) {
    const m = new Mesh(geo, mat);
    m.visible = false;
    list.push(m);
  }
  return list;
}
