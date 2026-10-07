import { gsap } from 'gsap';
import { Vector3 } from 'three';

// Toutes les timelines GSAP, construites à partir de la liste de couches (burger.layers).
//   open()  : anticipation → ouverture "coffre" → éclatement → visite guidée
//   scrub*  : contrôle manuel (zip / glisser vertical)
//   close() : retombée en ordre inverse, chapeau qui claque, onde de choc + confettis
//   bang()  : moment signature

const TAU = Math.PI * 2;
const STOP = 5.5; // durée d'un arrêt de la visite (s)
const _v = new Vector3();

export function createSequences({ S, burger, stage, fx, ui, reduced }) {
  const { layers, byId } = burger;
  const lid = layers[layers.length - 1];
  const N = layers.length;
  const ease = (fancy, plain = 'power2.out') => (reduced ? plain : fancy);

  // --- timeline d'éclatement, scrubbable (progress 0 → 1) ---
  const explode = gsap.timeline({ paused: true });
  explode.fromTo(lid.part.params, { hinge: 0 }, { hinge: 1, duration: 0.95, ease: ease('elastic.out(1, 0.5)') }, 0);
  [...layers].reverse().forEach((L, k) => {
    if (L.index === 0) return; // le pain du bas reste au sol
    explode.fromTo(L, { ex: 0 }, { ex: 1, duration: 0.85, ease: ease('back.out(1.6)') }, 0.22 + k * 0.12);
  });

  let seq = null;      // séquence en cours (open/close/bang)
  let story = null;    // minuteur de la visite
  let scrubT = 0;      // cible du scrub
  const storyP = { p: 0 };

  const nearestYaw = (from, to) => from + ((((to - from) % TAU) + TAU + Math.PI) % TAU) - Math.PI;
  const worldOf = (L, y = 0) => L.group.localToWorld(_v.set(0, y, 0));

  function shock(delay = 0) {
    const pairs = [[stage.shock, 0], [stage.shock2, 0.07]];
    for (const [m, d] of pairs) {
      gsap.fromTo(m.scale, { x: 0.9, z: 0.9 }, { x: 4.6, z: 4.6, duration: 0.75, ease: 'power3.out', delay: delay + d });
      gsap.fromTo(m.material, { opacity: 0.95 }, { opacity: 0, duration: 0.75, ease: 'power2.in', delay: delay + d });
    }
  }

  function clap(power = 1) {
    S.shake = reduced ? 0 : 0.55 * power;
    fx.confetti(worldOf(lid, 0.6), 110 * power);
    shock();
    ui.flash(0.35 * power);
    if (reduced) return;
    gsap.timeline()
      .to(S, { sy: 0.78, sxz: 1.14, duration: 0.08, ease: 'power2.out' })
      .to(S, { sy: 1, sxz: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.3)' });
    gsap.timeline()
      .to(S, { jump: 0.55 * power, duration: 0.24, ease: 'power2.out', delay: 0.06 })
      .to(S, { jump: 0, duration: 0.65, ease: 'bounce.out' });
  }

  // ---------------- 1→3 : ouverture ----------------
  function open() {
    if (S.mode !== 'idle') return;
    S.mode = 'opening';
    ui.lock(true);
    ui.fold(true);
    seq = gsap.timeline({ onComplete: () => { seq = null; startTour(0); } });
    // 1. anticipation : vue 3/4, squash & stretch, dolly-in, vignette
    seq.to(S, { antic: 1, duration: 0.5, ease: 'power2.inOut' }, 0)
      .to(S, { yaw: nearestYaw(S.yaw, 0.65), spin: 0.06, duration: 0.5, ease: 'power2.inOut' }, 0)
      .to(S, { tilt: 0.1, float: 0.35, duration: 0.45, ease: 'power2.out' }, 0)
      .to(ui.el.vignette, { opacity: 1, duration: 0.45 }, 0);
    if (!reduced) {
      seq.to(S, { sy: 0.84, sxz: 1.1, duration: 0.22, ease: 'power2.out' }, 0)
        .to(S, { sy: 1.13, sxz: 0.94, duration: 0.14, ease: 'power3.in' }, 0.22)
        .to(S, { sy: 1, sxz: 1, duration: 0.7, ease: 'elastic.out(1, 0.4)' }, 0.36);
    }
    // 2. le chapeau bascule (charnière), vapeur, sésame qui vibre
    seq.call(() => {
      ui.setOpen(true);
      fx.steamBurst(worldOf(lid, 0.05), 46);
    }, null, 0.42)
      .fromTo(lid.part.params, { vibrate: reduced ? 0 : 1 }, { vibrate: 0, duration: 1.2, ease: 'power2.out' }, 0.4)
      // 3. éclatement en couches (stagger piloté par la timeline `explode`)
      .to(explode, { progress: 1, duration: explode.duration(), ease: 'none' }, 0.4);
  }

  // ---------------- 4 : visite guidée ----------------
  function startTour(i) {
    S.mode = 'open';
    ui.lock(false);
    ui.setTouring(true);
    gsap.to(S, { tour: 1, duration: 0.6, ease: 'power2.out' });
    goTo(i);
  }

  function goTo(i) {
    i = (i + N) % N;
    S.tourIdx = i;
    const L = layers[i];
    layers.forEach((o) => gsap.to(o, { hl: o === L ? 1 : 0, duration: 0.45, overwrite: 'auto' }));
    gsap.to(S, { tourY: L.baseY + L.lift + L.height / 2, duration: reduced ? 0.4 : 0.95, ease: 'power3.inOut', overwrite: 'auto' });
    if (L.def.fx === 'egg') L.part.params.kick(-4);
    ui.showLabel(L, i, N);
    story?.kill();
    storyP.p = 0;
    ui.story(i, 0);
    story = gsap.to(storyP, {
      p: 1, duration: STOP, ease: 'none',
      onUpdate: () => ui.story(i, storyP.p),
      onComplete: () => goTo(i + 1),
    });
  }

  function stopTour() {
    story?.kill();
    story = null;
    ui.setTouring(false);
    ui.hideLabel();
    gsap.to(S, { tour: 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
    layers.forEach((o) => gsap.to(o, { hl: 0, duration: 0.3, overwrite: 'auto' }));
  }

  function next() { ensureOpen(() => goTo(S.tourIdx + 1)); }
  function prev() { ensureOpen(() => goTo(S.tourIdx - 1)); }
  function ensureOpen(then) {
    if (S.mode === 'free' || S.mode === 'scrub') {
      S.mode = 'opening';
      gsap.to(explode, {
        progress: 1, duration: (1 - explode.progress()) * 1.2 + 0.2, ease: 'power2.out', overwrite: true,
        onComplete: () => { startTour(S.tourIdx); then && then(); },
      });
      return;
    }
    if (S.mode === 'open') then();
  }

  // ---------------- 5 : contrôle manuel ----------------
  function scrubStart() {
    if (!['open', 'free', 'opening', 'scrub'].includes(S.mode)) return false;
    if (S.mode === 'opening' && seq) {
      // on reprend la main en pleine ouverture : on fige la séquence, l'anticipation se termine en douceur
      seq.kill(); seq = null;
      ui.setOpen(true);
      gsap.to(S, { antic: 1, sy: 1, sxz: 1, tilt: 0.1, float: 0.35, spin: 0.06, duration: 0.3, overwrite: 'auto' });
      gsap.to(ui.el.vignette, { opacity: 1, duration: 0.3 });
      gsap.to(lid.part.params, { vibrate: 0, duration: 0.3 });
    }
    if (S.mode === 'open') stopTour();
    gsap.killTweensOf(explode); // annule une fin d'ouverture en cours (et le redémarrage de la visite)
    S.mode = 'scrub';
    scrubT = explode.progress();
    ui.lock(false);
    return true;
  }
  function scrubTo(p) {
    if (S.mode !== 'scrub') return;
    scrubT = Math.min(1, Math.max(0, p));
    gsap.to(explode, { progress: scrubT, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
  }
  function scrubBy(dp) { scrubTo(scrubT + dp); }
  function scrubEnd() {
    if (S.mode !== 'scrub') return;
    if (scrubT < 0.07) { close(); return; }
    if (scrubT > 0.93) {
      S.mode = 'opening';
      gsap.to(explode, { progress: 1, duration: 0.3, overwrite: true, onComplete: () => startTour(S.tourIdx) });
      return;
    }
    S.mode = 'free';
  }

  // ---------------- 6 : fermeture ----------------
  function close() {
    if (!['open', 'free', 'scrub'].includes(S.mode)) return;
    S.mode = 'closing';
    stopTour();
    gsap.killTweensOf(explode);
    ui.lock(true);
    const inner = layers.filter((L) => L !== lid && L.index > 0);
    seq = gsap.timeline({
      onComplete: () => {
        seq = null;
        explode.progress(0);
        S.mode = 'idle';
        ui.lock(false);
        ui.showBang();
      },
    });
    inner.forEach((L, k) => {
      seq.to(L, { ex: 0, duration: 0.55, ease: ease('bounce.out', 'power2.inOut') }, k * 0.085);
    });
    layers.forEach((L) => seq.to(L, { spin: Math.round(L.spin / TAU) * TAU, duration: 0.7, ease: 'power2.inOut' }, 0));
    const tLid = inner.length * 0.085 + 0.18;
    seq.to(lid, { ex: 0, duration: 0.36, ease: 'power3.in' }, tLid)
      .to(lid.part.params, { hinge: 0, duration: 0.36, ease: 'power4.in' }, tLid)
      .call(() => { ui.setOpen(false); clap(1); }, null, tLid + 0.36)
      .to(ui.el.vignette, { opacity: 0, duration: 0.6 }, tLid + 0.36)
      .to(S, { antic: 0, tilt: 0, float: 1, spin: 0.45, duration: 0.9, ease: 'power2.inOut' }, tLid + 0.4)
      .call(() => ui.fold(false), null, tLid + 0.55);
  }

  // ---------------- 7 : BANG! ----------------
  function bang() {
    if (S.mode !== 'idle') return;
    S.mode = 'bang';
    ui.lock(true);
    ui.fold(true);
    const egg = byId.egg, crunch = byId.crunch, sauce = byId.sauce;
    const cheese = byId['cheddar-2'];
    const E = egg.part.params, C = crunch.part.params, Sa = sauce.part.params;
    const fly = 7;
    const tl = gsap.timeline({ onComplete: () => { S.mode = 'idle'; ui.lock(false); } });
    seq = tl;

    tl.to(S, { antic: 1, duration: 0.5, ease: 'power2.inOut' }, 0)
      .to(S, { yaw: nearestYaw(S.yaw, 0.65), spin: 0.05, tilt: 0.12, float: 0.3, duration: 0.5, ease: 'power2.inOut' }, 0)
      .to(ui.el.vignette, { opacity: 0.8, duration: 0.4 }, 0)
      // le chapeau décolle et embarque œuf, crunch et sauce
      .to(lid.part.params, { hinge: 0.6, duration: 0.4, ease: 'power2.out' }, 0.3)
      .to([lid, sauce, crunch, egg], { drop: fly, duration: 0.42, ease: 'back.in(1.4)', stagger: 0.03 }, 0.3)
      .call(() => fx.steamBurst(worldOf(byId['cheddar-2'], 0.05), 30), null, 0.55)
      // l'œuf tombe…
      .set(E, { splat: 0.6, splatY: 1.5, burst: 0 }, 0.85)
      .fromTo(egg, { drop: 4.4 }, { drop: 0, duration: 0.45, ease: 'power2.in' }, 0.9)
      // …s'écrase, s'étale, le jaune éclate
      .call(() => {
        E.kick(-6);
        fx.splash(worldOf(egg, 0.12), 30, '#ffa300', 1.6);
        fx.splash(worldOf(egg, 0.08), 12, '#fffaf0', 2.2);
        S.shake = reduced ? 0 : 0.3;
        cheese.part.params.melt = 1;
      }, null, 1.35)
      .to(E, { splatY: 0.35, duration: 0.07, ease: 'power2.out' }, 1.35)
      .to(E, { splatY: 1, duration: 0.7, ease: ease('elastic.out(1, 0.35)') }, 1.42)
      .to(E, { splat: 1.12, duration: 0.14, ease: 'power3.out' }, 1.35)
      .to(E, { splat: 1, duration: 0.6, ease: ease('elastic.out(1, 0.45)') }, 1.49)
      .to(E, { burst: 1, duration: 0.5, ease: 'power2.out' }, 1.4)
      // pluie de lardons & oignons crispy
      .set(C, { rain: 0 }, 1.7)
      .set(crunch, { drop: 0 }, 1.7)
      .to(C, { rain: 1, duration: 1.0, ease: 'none' }, 1.75)
      .call(() => fx.rain(worldOf(crunch, 1.6), 50, worldOf(egg, egg.height).y), null, 1.8)
      // la sauce nappe le tout
      .set(Sa, { cover: 0, drip: 0 }, 2.6)
      .set(sauce, { drop: 0 }, 2.6)
      .to(Sa, { cover: 1, duration: 0.65, ease: ease('elastic.out(1, 0.5)') }, 2.65)
      .to(Sa, { drip: 1, duration: 0.9, ease: 'power2.out' }, 2.8)
      .call(() => fx.splash(worldOf(sauce, 0.08), 18, '#f5651b', 1.4), null, 2.7)
      // le chapeau claque : BANG!
      .to(lid, { drop: 0, duration: 0.38, ease: 'power3.in' }, 3.4)
      .to(lid.part.params, { hinge: 0, duration: 0.38, ease: 'power3.in' }, 3.4)
      .call(() => { clap(1.25); S.shake = reduced ? 0 : 1; ui.sticker(); }, null, 3.78)
      .to(ui.el.vignette, { opacity: 0, duration: 0.6 }, 4.2)
      .to(S, { antic: 0, tilt: 0, float: 1, spin: 0.45, duration: 0.9, ease: 'power2.inOut' }, 4.3)
      .call(() => ui.fold(false), null, 4.6);
  }

  // tap : suivant / précédent pendant la visite, petit "boing" sinon
  function tap(xFrac) {
    if (S.mode === 'open' || S.mode === 'free') { xFrac < 0.33 ? prev() : next(); return; }
    if (S.mode === 'idle' && !reduced) {
      byId.egg.part.params.kick(-3);
      gsap.timeline()
        .to(S, { sy: 0.88, sxz: 1.07, duration: 0.1, ease: 'power2.out' })
        .to(S, { sy: 1, sxz: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.35)' });
    }
  }

  return {
    open, close, bang, next, prev, tap, scrubStart, scrubTo, scrubBy, scrubEnd,
    get progress() { return explode.progress(); },
  };
}
