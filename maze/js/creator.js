/* ============================================================
   MazeRun — Atelier du héros : la tête du joueur en photo sur le personnage
   Caméra (getUserMedia) avec repli sur l'appareil photo natif (input file),
   recadrage tactile, teinte de peau déduite de la photo. Tout reste local.
   ============================================================ */
'use strict';

const FACE_KEY = 'mazerun.face.v1';
const FACE_SIZE = 256;

class FaceCreator {
  constructor(game) {
    this.g = game;
    const q = (s) => document.querySelector(s);
    this.el = q('#creator'); this.title = q('#crTitle'); this.sub = q('#crSub');
    this.cam = q('#crCam'); this.video = q('#crVideo'); this.edit = q('#crEdit');
    this.preview = q('#crPreview'); this.zoom = q('#crZoom'); this.buttons = q('#crButtons'); this.file = q('#crFile');
    this.src = null; this.mirror = false; this.stream = null; this.state = 'intro';
    this.crop = { cx: 0.5, cy: 0.42, zoom: 0.6 };
    this.out = document.createElement('canvas'); this.out.width = this.out.height = FACE_SIZE;
    this.file.addEventListener('change', (e) => this.onFile(e));
    this.zoom.addEventListener('input', () => { this.crop.zoom = parseFloat(this.zoom.value); this.renderCrop(); });
    // recadrage au doigt sur l'aperçu
    let drag = null;
    this.preview.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; this.preview.setPointerCapture(e.pointerId); e.preventDefault(); });
    this.preview.addEventListener('pointermove', (e) => {
      if (!drag || !this.src) return;
      const side = this.crop.zoom * Math.min(this.src.width, this.src.height);
      const k = side / this.preview.clientWidth;
      this.crop.cx = clamp(this.crop.cx - (e.clientX - drag[0]) * k / this.src.width, 0.15, 0.85);
      this.crop.cy = clamp(this.crop.cy - (e.clientY - drag[1]) * k / this.src.height, 0.15, 0.85);
      drag = [e.clientX, e.clientY]; this.renderCrop();
    });
    const up = () => { drag = null; };
    this.preview.addEventListener('pointerup', up); this.preview.addEventListener('pointercancel', up);
  }

  open(first = false) {
    this.el.classList.remove('hidden'); this.g.ui.menu.classList.add('hidden');
    this.g.creatorOpen = true; this.first = first;
    this.g.character.mode = 'pose'; this.g.character.t = 0;
    this.setState('intro');
  }
  close() {
    this.stopCamera(); this.el.classList.add('hidden'); this.g.creatorOpen = false;
    if (this.g.state === 'menu') { this.g.ui.menu.classList.remove('hidden'); this.g.renderMenu(); }
    this.g.progress.settings.faceAsked = true; saveProgress(this.g.progress);
    if (this.g.character.mode !== 'wave') { this.g.character.mode = 'wave'; this.g.character.t = 0; }
  }

  setState(s) {
    this.state = s;
    this.cam.classList.toggle('hidden', s !== 'camera');
    this.edit.classList.toggle('hidden', s !== 'edit');
    const has = !!this.g.faceCanvas;
    const B = [];
    if (s === 'intro') {
      this.title.textContent = this.first ? 'Crée ton héros' : 'Mon visage';
      this.sub.textContent = 'Prends-toi en photo : ta tête ira sur le personnage. La photo reste sur ton téléphone, rien n’est envoyé.';
      B.push(['📷 Prendre une photo', 'primary', () => this.startCamera()]);
      B.push(['🖼 Choisir une photo', '', () => { this.file.removeAttribute('capture'); this.file.click(); }]);
      if (has) B.push(['🗑 Retirer ma photo', '', () => { this.g.setFace(null, true); this.close(); this.g.toast('Photo retirée'); }]);
      B.push([this.first ? 'Plus tard' : 'Fermer', 'ghost', () => this.close()]);
    } else if (s === 'camera') {
      this.title.textContent = 'Souris !';
      this.sub.textContent = 'Place ton visage dans le cercle.';
      B.push(['📸 Capturer', 'primary', () => this.capture()]);
      B.push(['Annuler', 'ghost', () => { this.stopCamera(); this.setState('intro'); }]);
    } else {
      this.title.textContent = 'C’est toi ! ✨';
      this.sub.textContent = 'Glisse pour recadrer, ajuste le zoom : le personnage change en direct.';
      B.push(['✓ Garder', 'primary', () => this.keep()]);
      B.push(['↺ Reprendre', '', () => this.setState('intro')]);
    }
    this.buttons.innerHTML = '';
    for (const [label, cls, fn] of B) {
      const b = document.createElement('button');
      b.className = 'btn ' + cls; b.textContent = label;
      b.addEventListener('click', () => { this.g.audio.init(); this.g.audio.tap(); fn(); });
      this.buttons.appendChild(b);
    }
  }

  async startCamera() {
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) return this.fallbackCamera();
    try {
      this.stream = await md.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play().catch(() => { });
      this.mirror = true;
      this.setState('camera');
    } catch (e) {
      // caméra refusée ou indisponible (iframe, permission) : appareil photo natif
      this.fallbackCamera();
    }
  }
  fallbackCamera() { this.file.setAttribute('capture', 'user'); this.file.click(); }
  stopCamera() {
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    this.video.srcObject = null;
  }

  capture() {
    const v = this.video; if (!v.videoWidth) return;
    this.setSource(v, v.videoWidth, v.videoHeight, true);
    this.g.audio.shutter();
    this.stopCamera();
    this.crop = { cx: 0.5, cy: 0.5, zoom: 0.62 };
    this.setState('edit'); this.renderCrop();
  }
  onFile(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      this.setSource(img, img.naturalWidth, img.naturalHeight, false);
      this.crop = { cx: 0.5, cy: 0.4, zoom: 0.7 };
      this.setState('edit'); this.renderCrop();
    };
    img.onerror = () => { URL.revokeObjectURL(url); this.g.toast('Impossible de lire cette photo'); };
    img.src = url;
  }
  /* Copie la source dans un canvas ≤ 1024 px (miroir pour la caméra frontale) */
  setSource(source, w, h, mirror) {
    const k = Math.min(1, 1024 / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    const x = c.getContext('2d');
    if (mirror) { x.translate(c.width, 0); x.scale(-1, 1); }
    x.drawImage(source, 0, 0, c.width, c.height);
    this.src = c; this.mirror = mirror;
  }

  /* Dessine le recadrage dans l'aperçu (rond) et dans la texture 256², puis l'applique au héros */
  renderCrop() {
    if (!this.src) return;
    const s = this.src, side = this.crop.zoom * Math.min(s.width, s.height);
    const sx = clamp(this.crop.cx * s.width - side / 2, 0, s.width - side), sy = clamp(this.crop.cy * s.height - side / 2, 0, s.height - side);
    this.zoom.value = this.crop.zoom;
    const o = this.out.getContext('2d');
    o.clearRect(0, 0, FACE_SIZE, FACE_SIZE);
    o.drawImage(s, sx, sy, side, side, 0, 0, FACE_SIZE, FACE_SIZE);
    const p = this.preview, pc = p.getContext('2d'), P = p.width;
    pc.clearRect(0, 0, P, P);
    pc.save(); pc.beginPath(); pc.arc(P / 2, P / 2, P / 2 - 2, 0, 7); pc.clip();
    pc.drawImage(this.out, 0, 0, P, P); pc.restore();
    pc.strokeStyle = 'rgba(255,224,102,.9)'; pc.lineWidth = 4; pc.beginPath(); pc.arc(P / 2, P / 2, P / 2 - 3, 0, 7); pc.stroke();
    if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.g.setFace(this.out, false); });
  }
  keep() {
    this.g.setFace(this.out, true);
    this.g.audio.unlock();
    this.close();
    this.g.bubbleSay('Trop cool, c’est moi ! 😎');
    this.g.pop('Héros créé !');
  }
}

/* Teinte de peau moyenne d'une photo de visage (zone des joues / du menton) */
function skinFromCanvas(c) {
  const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.floor(h * 0.5); y < h * 0.78; y += 3) for (let x = Math.floor(w * 0.3); x < w * 0.7; x += 3) {
    const o = (y * w + x) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; n++;
  }
  if (!n) return null;
  r /= n * 255; g /= n * 255; b /= n * 255;
  // évite les extrêmes (fond très sombre / surexposé) qui rendraient le corps irréel
  const l = r * 0.3 + g * 0.6 + b * 0.1;
  if (l < 0.12) { const k = 0.12 / Math.max(l, 1e-3); r *= k; g *= k; b *= k; }
  if (l > 0.92) { const k = 0.92 / l; r *= k; g *= k; b *= k; }
  return [clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)];
}
