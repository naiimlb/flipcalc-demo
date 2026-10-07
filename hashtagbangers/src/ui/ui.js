import { gsap } from 'gsap';

// Couche HTML par-dessus le canvas : panneau, étiquette + ligne de rappel, story bars, zip, sticker BANG!

export function createUI(app, layers, chips, reduced) {
  const $ = (s) => app.querySelector(s);
  const el = {
    vignette: $('.vignette'),
    label: $('.label'), idx: $('.label__idx'), name: $('.label__name'), note: $('.label__note'), desc: $('.label__desc'),
    leader: $('.leader'), under: $('.leader__under'), line: $('.leader__line'), dot: $('.leader__dot'),
    story: $('.story'), zip: $('.zip'), zipTrack: $('.zip__track'),
    sticker: $('.sticker'), burst: $('.sticker__burst polygon'), stickerText: $('.sticker__text'),
    flash: $('.flash'), bang: $('#bang'), open: $('#open'),
  };

  $('.chips').innerHTML = chips.map((c) => `<li>${c}</li>`).join('');
  el.story.innerHTML = layers.map(() => '<i></i>').join('');
  const bars = [...el.story.children];

  // étoile "comics" du sticker
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, r = i % 2 ? 58 + (i % 4) * 4 : 96 + ((i * 37) % 11);
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r * 0.82).toFixed(1)}`);
  }
  el.burst.setAttribute('points', pts.join(' '));

  let labelRect = null;
  let labelVisible = false;
  let labelTl = null;
  const dash = { v: 1 };
  const setDash = () => {
    el.under.style.strokeDashoffset = dash.v;
    el.line.style.strokeDashoffset = dash.v;
  };
  // position "au repos" (sans les transformations en cours d'animation)
  const measure = () => {
    if (!labelVisible) return;
    labelRect = { x: el.label.offsetLeft + el.name.offsetLeft + 26, y: el.label.offsetTop + el.name.offsetTop - 4 };
  };
  window.addEventListener('resize', () => requestAnimationFrame(measure));

  return {
    el,
    fold(on) { app.classList.toggle('is-folded', on); },
    setOpen(on) { app.classList.toggle('is-open', on); },
    setTouring(on) { app.classList.toggle('is-touring', on); },

    showLabel(L, i, n) {
      el.idx.textContent = `${String(i + 1).padStart(2, '0')}/${n}`;
      el.name.textContent = L.def.name;
      el.note.textContent = L.def.note;
      el.desc.textContent = L.def.desc;
      labelVisible = true;
      measure();
      labelTl?.kill();
      const tl = labelTl = gsap.timeline();
      if (reduced) {
        dash.v = 0; setDash();
        tl.fromTo(el.label, { opacity: 0 }, { opacity: 1, duration: 0.3 }).set(el.dot, { opacity: 1, attr: { r: 6 } }, 0);
        return;
      }
      tl.fromTo(el.label, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }, 0)
        .fromTo(el.name, { scale: 0.2, rotation: -16 }, { scale: 1, rotation: -3, duration: 0.55, ease: 'back.out(2.6)' }, 0.05)
        .fromTo(el.note, { scale: 0, rotation: 30 }, { scale: 1, rotation: 5, duration: 0.5, ease: 'back.out(3)' }, 0.25)
        .fromTo(dash, { v: 1 }, { v: 0, duration: 0.55, ease: 'power2.inOut', onUpdate: setDash }, 0.15)
        .fromTo(el.dot, { opacity: 0, attr: { r: 0 } }, { opacity: 1, attr: { r: 6 }, duration: 0.35, ease: 'back.out(3)' }, 0.6);
    },
    hideLabel() {
      labelVisible = false;
      labelTl?.kill();
      labelTl = gsap.timeline()
        .to(el.label, { opacity: 0, y: 12, duration: 0.25 }, 0)
        .to(dash, { v: 1, duration: 0.25, onUpdate: setDash }, 0)
        .to(el.dot, { opacity: 0, duration: 0.2 }, 0);
    },
    // ligne de rappel : du haut de l'étiquette jusqu'au bord de la couche (coordonnées écran)
    leader(ax, ay) {
      if (!labelVisible || !labelRect) return;
      const { x: sx, y: sy } = labelRect;
      const ky = Math.min(sy - 20, ay + 46);
      const d = `M${sx.toFixed(1)} ${sy.toFixed(1)}L${sx.toFixed(1)} ${ky.toFixed(1)}L${ax.toFixed(1)} ${ay.toFixed(1)}`;
      el.under.setAttribute('d', d);
      el.line.setAttribute('d', d);
      el.dot.setAttribute('cx', ax.toFixed(1));
      el.dot.setAttribute('cy', ay.toFixed(1));
    },
    story(i, p) {
      for (let k = 0; k < bars.length; k++) bars[k].style.setProperty('--p', k < i ? 1 : k > i ? 0 : p);
    },
    zip(p) {
      el.zip.style.setProperty('--p', `${(p * 100).toFixed(1)}%`);
      el.zip.setAttribute('aria-valuenow', Math.round(p * 100));
    },
    zipRect() { return el.zipTrack.getBoundingClientRect(); },
    showBang() {
      if (!el.bang.hidden) return;
      el.bang.hidden = false;
      el.bang.classList.add('pop');
    },
    lock(on) { el.open.disabled = on; el.bang.disabled = on; },
    sticker() {
      const tl = gsap.timeline();
      if (reduced) {
        tl.fromTo(el.sticker, { scale: 1, opacity: 0 }, { opacity: 1, duration: 0.2 }).to(el.sticker, { opacity: 0, duration: 0.4, delay: 1 });
        return tl;
      }
      tl.fromTo(el.sticker, { scale: 0, rotation: -25, opacity: 1 }, { scale: 1.18, rotation: 4, duration: 0.22, ease: 'power4.out' })
        .to(el.sticker, { scale: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1.1, 0.35)' })
        .fromTo(el.stickerText, { scale: 1.6 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 0.05)
        .to(el.sticker, { scale: 0, rotation: 12, opacity: 0, duration: 0.3, ease: 'back.in(2)' }, '+=0.75');
      return tl;
    },
    flash(a = 0.7) {
      if (reduced) return;
      gsap.fromTo(el.flash, { opacity: a }, { opacity: 0, duration: 0.35, ease: 'power2.out' });
    },
  };
}
