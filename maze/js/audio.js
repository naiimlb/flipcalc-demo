/* ============================================================
   MazeRun — Sons synthétisés (WebAudio, aucun fichier audio)
   ============================================================ */
'use strict';

class AudioFX {
  constructor() {
    this.ctx = null; this.master = null; this.ambient = null;
    let m = false; try { m = localStorage.getItem('mazerun.muted') === '1'; } catch (e) { }
    this.muted = m;
    this.lastStep = 0;
  }
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('mazerun.muted', m ? '1' : '0'); } catch (e) { }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise(dur, vol = 0.1, freq = 1000, when = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t0 = c.currentTime + when;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t0);
  }
  step() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStep < 0.28) return;
    this.lastStep = now;
    this.noise(0.07, 0.10, 500 + Math.random() * 300);
  }
  tap() { this.tone(520, 0.06, 'triangle', 0.12); }
  star() { this.tone(880, 0.12, 'sine', 0.18); this.tone(1318, 0.14, 'sine', 0.18, 0.08); this.tone(1760, 0.3, 'sine', 0.16, 0.16); }
  hint() { this.tone(500, 0.25, 'triangle', 0.15, 0, 900); }
  tick() { this.tone(1400, 0.05, 'square', 0.06); }
  portal() { this.tone(220, 0.6, 'sawtooth', 0.08, 0, 880); this.tone(440, 0.6, 'sine', 0.12, 0.05, 1760); }
  win() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319];
    seq.forEach((f, i) => this.tone(f, 0.28, i < 4 ? 'triangle' : 'sine', 0.18, i * 0.12));
    [523, 659, 784].forEach(f => this.tone(f, 1.4, 'sine', 0.08, 0.85));
  }
  lose() { this.tone(300, 0.5, 'sawtooth', 0.12, 0, 120); this.tone(200, 0.7, 'square', 0.06, 0.2, 80); }
  thunder(when = 0) { this.noise(1.6, 0.35, 140, when); this.noise(0.5, 0.25, 320, when + 0.05); this.tone(48, 1.4, 'sine', 0.12, when, 30); }
  swoosh() { this.noise(0.28, 0.12, 2200); this.tone(320, 0.22, 'sine', 0.05, 0, 640); }
  unlock() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, i * 0.09)); }
  shutter() { this.noise(0.05, 0.25, 3500); this.tone(1800, 0.05, 'square', 0.05, 0.05); }
  startAmbient(theme) {
    this.stopAmbient();
    if (!this.ctx) return;
    const c = this.ctx;
    const base = { prairie: 196, jungle: 174, beach: 220, desert: 164, mountain: 246, autumn: 185, volcano: 110, ice: 261, neon: 146, space: 130 }[theme] || 196;
    const g = c.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(0.05, c.currentTime, 1.5);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.12;
    const lg = c.createGain(); lg.gain.value = 250; lfo.connect(lg); lg.connect(f.frequency);
    const oscs = [];
    [[1, 'sine'], [1.5, 'triangle'], [2.003, 'sine'], [0.5, 'triangle']].forEach(([r, t]) => {
      const o = c.createOscillator(); o.type = t; o.frequency.value = base * r; o.detune.value = (Math.random() - 0.5) * 12;
      const og = c.createGain(); og.gain.value = r > 1.4 ? 0.35 : 0.6;
      o.connect(og); og.connect(f); o.start(); oscs.push(o);
    });
    f.connect(g); g.connect(this.master); lfo.start();
    this.ambient = { g, oscs, lfo };
  }
  stopAmbient() {
    if (!this.ambient || !this.ctx) return;
    const a = this.ambient, c = this.ctx;
    a.g.gain.setTargetAtTime(0, c.currentTime, 0.4);
    setTimeout(() => { try { a.oscs.forEach(o => o.stop()); a.lfo.stop(); } catch (e) { } }, 1500);
    this.ambient = null;
  }
}
