import { gsap } from 'gsap';
import { Vector3 } from 'three';
import { LAYERS, CHIPS } from './config/layers.js';
import { createStage } from './three/stage.js';
import { buildBurger } from './three/burger.js';
import { Particles } from './three/particles.js';
import { rng, beefTextures, bunTexture, crumbTexture, baconTexture } from './three/textures.js';
import { createUI } from './ui/ui.js';
import { createSequences } from './anim/sequences.js';

const app = document.getElementById('app');
const canvas = document.getElementById('gl');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const started = performance.now();

function fail() {
  app.classList.remove('is-loading');
  app.querySelector('.nogl').hidden = false;
  app.querySelector('.panel').hidden = true;
}

let stage;
try { stage = createStage(canvas); } catch (e) { fail(); throw e; }

// ---------- scène ----------
const rand = rng(20251017);
const ctx = {
  rand,
  tex: { beef: beefTextures(rand), bun: bunTexture(rand), crumb: crumbTexture(rand), bacon: baconTexture(rand) },
};
const fx = new Particles(640);
fx.enabled = !reduced;
stage.scene.add(fx.points);

const burger = buildBurger(LAYERS, ctx);
stage.scene.add(burger.root);

// état global animé par GSAP et lu par la boucle de rendu
const S = {
  mode: 'idle',
  yaw: -0.5, spin: 0.45, yawV: 0,
  tilt: 0, float: 1, sy: 1, sxz: 1, jump: 0,
  antic: 0, tour: 0, tourY: 1, tourIdx: 0,
  shake: 0, px: 0, py: 0,
};

const ui = createUI(app, LAYERS, CHIPS, reduced);
const seq = createSequences({ S, burger, stage, fx, ui, reduced });

// ---------- caméra : cadrages mélangés (repos → anticipation → éclaté → visite) ----------
const lid = burger.layers[burger.layers.length - 1];
const openTop = lid.baseY + lid.lift + lid.height + 0.3;
const rig = { ty: 1, dist: 12, elev: 0.2, az: 0, off: 0.13, px: 0, py: 0 };
const goal = { ...rig };
const shaken = { ...rig };
let F = {};
function frames() {
  const idle = stage.fit(2.55, 2.4, 0.84, 0.36);
  F = {
    idle: { ty: 0.95, dist: idle, elev: 0.2, off: 0.135 },
    antic: { ty: 1.05, dist: idle * 0.8, elev: 0.5, off: 0.03 },
    open: { ty: openTop / 2 + 0.25, dist: stage.fit(2.6, openTop + 1.3, 0.8, 0.74), elev: 0.26, off: 0.02 },
    tour: { dist: stage.fit(2.5, 1.5, 0.72, 0.36), elev: 0.3, off: 0.17 },
  };
}
const lerp = (a, b, t) => a + (b - a) * t;

function composeCamera(dt, p) {
  const { idle, antic, open, tour } = F;
  const a = S.antic;
  const ty0 = lerp(idle.ty, antic.ty, a), d0 = lerp(idle.dist, antic.dist, a), e0 = lerp(idle.elev, antic.elev, a), o0 = lerp(idle.off, antic.off, a);
  const ty1 = lerp(ty0, open.ty, p), d1 = lerp(d0, open.dist, p), e1 = lerp(e0, open.elev, p), o1 = lerp(o0, open.off, p);
  const t = S.tour;
  goal.ty = lerp(ty1, S.tourY, t);
  goal.dist = lerp(d1, tour.dist, t);
  goal.elev = lerp(e1, tour.elev, t);
  goal.off = lerp(o1, tour.off, t);
  goal.px = S.px * 0.9;
  goal.py = S.py * 0.5;
  const k = 1 - Math.exp(-dt * 6);
  for (const key in goal) rig[key] += (goal[key] - rig[key]) * k;
  Object.assign(shaken, rig);
  shaken.px += (Math.random() - 0.5) * S.shake * 0.5;
  shaken.py += (Math.random() - 0.5) * S.shake * 0.5;
  stage.applyRig(shaken);
}

// ---------- boucle ----------
const camLeft = new Vector3();
const camDir = new Vector3();
const anchor = new Vector3();
let t = 0, lost = false, lastP = -1;
const fxCtx = {
  fx, tour: 0,
  floorOf: (L) => L.group.localToWorld(anchor.set(0, L.height, 0)).y,
};

function loop(time, deltaMs) {
  if (lost || document.hidden) return;
  const dt = Math.min(deltaMs / 1000, 1 / 20);
  t += dt;
  stage.monitor(dt);

  const root = burger.root;
  S.yaw += (S.spin + S.yawV) * dt;
  S.yawV *= Math.exp(-dt * 2.5);
  root.rotation.set(S.tilt, S.yaw, 0, 'YXZ');
  root.position.y = Math.sin(t * 1.5) * 0.07 * S.float + S.jump;
  root.scale.set(S.sxz, S.sy, S.sxz);
  S.shake *= Math.exp(-dt * 5.5);
  app.style.transform = S.shake > 0.02 ? `translate(${((Math.random() - 0.5) * S.shake * 14).toFixed(1)}px,${((Math.random() - 0.5) * S.shake * 14).toFixed(1)}px)` : '';

  const p = seq.progress;
  fxCtx.tour = S.tour;
  root.updateMatrixWorld();
  burger.update(dt, t, fxCtx);
  fx.update(dt, t);

  // glow et ombre
  camDir.set(stage.camera.position.x, 0, stage.camera.position.z).normalize();
  stage.glow.position.set(-camDir.x * 2.2, rig.ty, -camDir.z * 2.2);
  const pulse = 1 + Math.sin(t * 2) * 0.04;
  stage.glow.scale.set(6.5 * pulse + p * 2, (6.5 + p * 5) * pulse, 1);
  const lift = root.position.y;
  stage.shadow.scale.setScalar(3.3 - lift * 0.8);
  stage.shadow.material.opacity = 1 - Math.min(0.6, Math.max(0, lift) * 0.9);

  composeCamera(dt, p);
  if (p !== lastP) { ui.zip(p); lastP = p; }

  // ligne de rappel vers la couche active
  if (S.tour > 0.01) {
    const L = burger.layers[S.tourIdx];
    camLeft.setFromMatrixColumn(stage.camera.matrixWorld, 0).multiplyScalar(-1);
    L.group.localToWorld(anchor.set(0, L.height * 0.5, 0)).addScaledVector(camLeft, 0.82 * S.sxz);
    anchor.project(stage.camera);
    ui.leader((anchor.x + 1) * 0.5 * stage.size.w, (1 - anchor.y) * 0.5 * stage.size.h);
  }

  stage.renderer.render(stage.scene, stage.camera);
}

// ---------- entrées ----------
const ptr = { id: null, x: 0, y: 0, lx: 0, ly: 0, t: 0, axis: null };
canvas.addEventListener('pointerdown', (e) => {
  if (ptr.id !== null) return;
  ptr.id = e.pointerId;
  ptr.x = ptr.lx = e.clientX; ptr.y = ptr.ly = e.clientY; ptr.t = performance.now(); ptr.axis = null;
  canvas.setPointerCapture(e.pointerId);
  S.yawV = 0;
});
canvas.addEventListener('pointermove', (e) => {
  // léger parallaxe, au doigt comme à la souris
  S.px = (e.clientX / stage.size.w - 0.5);
  S.py = (e.clientY / stage.size.h - 0.5);
  if (e.pointerId !== ptr.id) return;
  const dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly;
  ptr.lx = e.clientX; ptr.ly = e.clientY;
  if (!ptr.axis) {
    const ax = Math.abs(e.clientX - ptr.x), ay = Math.abs(e.clientY - ptr.y);
    if (Math.max(ax, ay) < 8) return;
    ptr.axis = ax > ay ? 'x' : (seq.scrubStart() ? 'y' : 'x');
  }
  if (ptr.axis === 'x') {
    S.yaw += dx * 0.012;
    S.yawV = S.yawV * 0.5 + dx * 0.012 * 30;
  } else {
    seq.scrubBy(-dy / (stage.size.h * 0.45));
  }
});
const release = (e) => {
  if (e.pointerId !== ptr.id) return;
  ptr.id = null;
  if (!ptr.axis && performance.now() - ptr.t < 320) seq.tap(e.clientX / stage.size.w);
  if (ptr.axis === 'y') seq.scrubEnd();
  S.yawV = Math.max(-6, Math.min(6, S.yawV));
  if (e.pointerType !== 'mouse') { S.px = 0; S.py = 0; }
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { S.px = 0; S.py = 0; } });

// zip vertical
const zip = ui.el.zip;
let zipId = null;
const zipAt = (e) => {
  const r = ui.zipRect();
  seq.scrubTo(1 - (e.clientY - r.top) / r.height);
};
zip.addEventListener('pointerdown', (e) => {
  if (!seq.scrubStart()) return;
  zipId = e.pointerId;
  zip.setPointerCapture(e.pointerId);
  zipAt(e);
});
zip.addEventListener('pointermove', (e) => { if (e.pointerId === zipId) zipAt(e); });
const zipUp = (e) => { if (e.pointerId !== zipId) return; zipId = null; seq.scrubEnd(); };
zip.addEventListener('pointerup', zipUp);
zip.addEventListener('pointercancel', zipUp);
zip.addEventListener('keydown', (e) => {
  const d = { ArrowUp: 0.1, ArrowDown: -0.1 }[e.key];
  if (d === undefined || !seq.scrubStart()) return;
  e.preventDefault();
  seq.scrubTo(seq.progress + d);
  clearTimeout(zip._t);
  zip._t = setTimeout(() => seq.scrubEnd(), 500);
});

document.getElementById('open').addEventListener('click', seq.open);
document.getElementById('bang').addEventListener('click', seq.bang);
document.getElementById('close').addEventListener('click', seq.close);
document.getElementById('next').addEventListener('click', seq.next);
document.getElementById('prev').addEventListener('click', seq.prev);
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') seq.next();
  else if (e.key === 'ArrowLeft') seq.prev();
  else if (e.key === 'Escape') seq.close();
});
document.addEventListener('gesturestart', (e) => e.preventDefault()); // pas de pinch-zoom iOS

// ---------- cycle de vie ----------
const resize = () => {
  stage.resize();
  frames();
  fx.setScale(stage.size.h * stage.renderer.getPixelRatio(), stage.camera.fov);
};
stage.onQuality((q) => { fx.budget = q.budget; });
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
resize();
Object.assign(rig, F.idle);
Object.assign(goal, F.idle);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) gsap.globalTimeline.pause();
  else gsap.globalTimeline.resume();
});
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  lost = true;
  gsap.globalTimeline.pause();
});
canvas.addEventListener('webglcontextrestored', () => {
  lost = false;
  gsap.globalTimeline.resume();
});

// pré-compile les shaders avant de montrer quoi que ce soit (évite l'à-coup de la 1re frame)
stage.renderer.compile(stage.scene, stage.camera);
gsap.ticker.add(loop);
gsap.ticker.lagSmoothing(200, 33);

// preloader : 1 s max, le logo "pop" puis le burger tombe en place
const wait = Math.max(0, Math.min(1000, 750 - (performance.now() - started)));
setTimeout(() => {
  app.classList.remove('is-loading');
  if (reduced) return;
  gsap.from(S, { jump: 4, duration: 0.9, ease: 'bounce.out', delay: 0.05 });
  gsap.from(S, { yaw: S.yaw - 2.5, duration: 1.4, ease: 'power3.out', delay: 0.05 });
  gsap.from('.panel > *', { y: 40, opacity: 0, duration: 0.6, stagger: 0.07, ease: 'back.out(1.6)', delay: 0.2 });
}, wait);

// debug / tests : window.__bangers
window.__bangers = { S, seq, burger, stage, fx, gsap };
