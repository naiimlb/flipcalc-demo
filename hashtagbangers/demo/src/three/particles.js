import { BufferGeometry, BufferAttribute, Points, ShaderMaterial, Color, DynamicDrawUsage, SRGBColorSpace } from 'three';

// Pool de particules unique (vapeur, miettes, gouttes, étincelles, confettis).
// Tout est pré-alloué : aucune création d'objet pendant l'animation.

const STEAM = 0, CRUMB = 1, DROP = 2, SPARK = 3, CONFETTI = 4;
const SHAPE = [0, 1, 1, 3, 2];
const GRAV = [0, -7, -8, -2.5, -2.2];
const DRAG = [1.2, 0.2, 0.1, 1.5, 2.4];
const _c = new Color();
const _rgb = { r: 0, g: 0, b: 0 };
const CACHE = new Map();
// couleurs pré-converties (sRGB) : pas d'analyse de chaîne pendant l'animation
function rgbOf(hex) {
  let v = CACHE.get(hex);
  if (!v) { _c.set(hex).getRGB(_rgb, SRGBColorSpace); v = [_rgb.r, _rgb.g, _rgb.b]; CACHE.set(hex, v); }
  return v;
}

const vert = /* glsl */`
attribute vec3 aColor;
attribute float aAlpha;
attribute float aSize;
attribute float aRot;
attribute float aShape;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
varying float vRot;
varying float vShape;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  vColor = aColor; vAlpha = aAlpha; vRot = aRot; vShape = aShape;
}`;

const frag = /* glsl */`
varying vec3 vColor;
varying float vAlpha;
varying float vRot;
varying float vShape;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float a;
  vec3 col = vColor;
  if (vShape < 0.5) { a = smoothstep(0.5, 0.0, d); a *= a; }
  else if (vShape < 1.5) {
    a = smoothstep(0.5, 0.4, d);
    col *= 1.0 + 0.35 * smoothstep(0.25, 0.0, length(p + vec2(0.13, 0.13)));
  }
  else if (vShape < 2.5) {
    float c = cos(vRot), s = sin(vRot);
    vec2 q = mat2(c, -s, s, c) * p;
    a = step(abs(q.x), 0.42) * step(abs(q.y), 0.2 + 0.1 * abs(sin(vRot * 1.7)));
  }
  else { a = pow(smoothstep(0.5, 0.0, d), 1.6); col = mix(col, vec3(1.0, 0.95, 0.8), smoothstep(0.18, 0.0, d)); }
  a *= vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

export class Particles {
  constructor(cap = 640) {
    this.cap = cap;
    this.enabled = true;
    this.budget = 1; // réduit par le gestionnaire de qualité
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.alpha = new Float32Array(cap);
    this.size = new Float32Array(cap);
    this.rot = new Float32Array(cap);
    this.shape = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.kind = new Uint8Array(cap);
    this.floor = new Float32Array(cap);
    this.bounces = new Uint8Array(cap);
    this.base = new Float32Array(cap);
    this.spin = new Float32Array(cap);
    this.cursor = 0;
    this.live = 0;
    const g = new BufferGeometry();
    const attr = (name, arr, n) => { const a = new BufferAttribute(arr, n); a.setUsage(DynamicDrawUsage); g.setAttribute(name, a); return a; };
    this.aPos = attr('position', this.pos, 3);
    this.aCol = attr('aColor', this.col, 3);
    this.aAlpha = attr('aAlpha', this.alpha, 1);
    this.aSize = attr('aSize', this.size, 1);
    this.aRot = attr('aRot', this.rot, 1);
    this.aShape = attr('aShape', this.shape, 1);
    this.material = new ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: { uScale: { value: 400 } },
      transparent: true, depthWrite: false,
    });
    this.points = new Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  setScale(viewportH, fov) {
    this.material.uniforms.uScale.value = viewportH / (2 * Math.tan((fov * Math.PI) / 360));
  }

  spawn(kind, p, vx, vy, vz, life, size, color, floor = -1e9) {
    if (!this.enabled) return;
    let i = this.cursor;
    // cherche un emplacement libre ; sinon recycle le plus ancien
    for (let n = 0; n < this.cap; n++) {
      const k = (this.cursor + n) % this.cap;
      if (this.life[k] <= 0) { i = k; break; }
    }
    this.cursor = (i + 1) % this.cap;
    const j = i * 3;
    this.pos[j] = p.x; this.pos[j + 1] = p.y; this.pos[j + 2] = p.z;
    this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
    const c = rgbOf(color);
    this.col[j] = c[0]; this.col[j + 1] = c[1]; this.col[j + 2] = c[2];
    this.life[i] = life; this.max[i] = life;
    this.kind[i] = kind; this.shape[i] = SHAPE[kind];
    this.base[i] = size; this.size[i] = size;
    this.rot[i] = Math.random() * 6.28; this.spin[i] = (Math.random() - 0.5) * 14;
    this.floor[i] = floor; this.bounces[i] = 0;
    this.alpha[i] = 1;
  }

  steam(p) {
    this.spawn(STEAM, p, (Math.random() - 0.5) * 0.15, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15, 1.6 + Math.random(), 0.45 + Math.random() * 0.3, '#fff6f0');
  }
  steamBurst(p, n) {
    for (let k = 0; k < n * this.budget; k++) {
      this.spawn(STEAM, p, (Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6, 1.2 + Math.random() * 1.2, 0.6 + Math.random() * 0.6, '#ffffff');
    }
  }
  spark(p, dir) {
    const s = 1.2 + Math.random() * 1.4;
    this.spawn(SPARK, p, dir.x * s, dir.y * s + 0.6, dir.z * s, 0.35 + Math.random() * 0.3, 0.07 + Math.random() * 0.05, Math.random() < 0.5 ? '#ff8a1f' : '#ffc23d');
  }
  crumb(p, floor) {
    this.spawn(CRUMB, p, (Math.random() - 0.5) * 0.3, -0.2, (Math.random() - 0.5) * 0.3, 2.2, 0.035 + Math.random() * 0.035, Math.random() < 0.6 ? '#d98a2b' : '#a8331f', floor);
  }
  drop(p, floor, color, size) {
    this.spawn(DROP, p, 0, -0.1, 0, 2.5, size * (0.8 + Math.random() * 0.5), color, floor);
  }
  splash(p, n, color, speed = 2) {
    for (let k = 0; k < n * this.budget; k++) {
      const a = Math.random() * 6.28, v = speed * (0.4 + Math.random());
      this.spawn(DROP, p, Math.cos(a) * v, 1 + Math.random() * 2, Math.sin(a) * v, 1.4, 0.05 + Math.random() * 0.05, color, p.y - 0.05);
    }
  }
  rain(p, n, floor) {
    for (let k = 0; k < n * this.budget; k++) {
      const a = Math.random() * 6.28, r = Math.random() * 1.1;
      _p.set(p.x + Math.cos(a) * r, p.y + Math.random() * 1.5, p.z + Math.sin(a) * r);
      this.spawn(CRUMB, _p, 0, -1 - Math.random() * 2, 0, 2.2, 0.04 + Math.random() * 0.04, Math.random() < 0.6 ? '#e09a35' : '#b33a24', floor);
    }
  }
  confetti(p, n) {
    const cols = ['#ec1e79', '#ff6fb5', '#ffffff', '#ffc2e0', '#0b0b0f', '#ffb000'];
    for (let k = 0; k < n * this.budget; k++) {
      const a = Math.random() * 6.28, v = 2 + Math.random() * 4;
      this.spawn(CONFETTI, p, Math.cos(a) * v, 3 + Math.random() * 5, Math.sin(a) * v * 0.6, 2.2 + Math.random() * 1.2, 0.16 + Math.random() * 0.12, cols[k % cols.length]);
    }
  }

  update(dt, t) {
    let live = 0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const j = i * 3, k = this.kind[i];
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      live++;
      const u = 1 - this.life[i] / this.max[i];
      const drag = Math.exp(-DRAG[k] * dt);
      this.vel[j] *= drag; this.vel[j + 2] *= drag;
      this.vel[j + 1] = this.vel[j + 1] * (k === STEAM ? drag : 1) + GRAV[k] * dt;
      if (k === STEAM) this.vel[j + 1] += 0.5 * dt;
      if (k === CONFETTI) {
        this.vel[j + 1] = Math.max(this.vel[j + 1], -1.6);
        this.pos[j] += Math.sin(t * 6 + i) * 0.6 * dt;
        this.rot[i] += this.spin[i] * dt;
      }
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      // rebond sur la couche du dessous (si la particule est au-dessus du burger)
      if ((k === DROP || k === CRUMB) && this.pos[j + 1] < this.floor[i] && this.vel[j + 1] < 0) {
        const r = Math.hypot(this.pos[j], this.pos[j + 2]);
        if (r < 1.0 && this.bounces[i] < 2) {
          this.pos[j + 1] = this.floor[i];
          this.vel[j + 1] *= -(k === DROP ? 0.38 : 0.3);
          this.vel[j] += (Math.random() - 0.5) * 0.4; this.vel[j + 2] += (Math.random() - 0.5) * 0.4;
          this.bounces[i]++;
          if (this.bounces[i] === 2) this.life[i] = Math.min(this.life[i], 0.35);
        } else if (r < 1.0) {
          this.pos[j + 1] = this.floor[i];
          this.vel[j + 1] = 0;
        } else {
          this.floor[i] = -1e9;
        }
      }
      if (k === STEAM) {
        this.size[i] = this.base[i] * (1 + u * 1.8);
        this.alpha[i] = Math.sin(Math.PI * u) * 0.32;
      } else if (k === SPARK) {
        this.alpha[i] = 1 - u; this.size[i] = this.base[i] * (1 - u * 0.5);
      } else if (k === DROP) {
        this.alpha[i] = 1; this.size[i] = this.base[i] * (this.bounces[i] ? 1 - u * 0.4 : 1);
      } else {
        this.alpha[i] = Math.min(1, (1 - u) * 4);
      }
    }
    this.live = live;
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aAlpha.needsUpdate = true;
    this.aSize.needsUpdate = this.aRot.needsUpdate = this.aShape.needsUpdate = true;
  }

  clear() { this.life.fill(0); this.alpha.fill(0); this.size.fill(0); }
}

const _p = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
