/* ============================================================
   MazeRun — mini moteur WebGL (aucune dépendance)
   Matrices, géométrie procédurale, scène hiérarchique, particules
   ============================================================ */
'use strict';

/* ---------- Mat4 / Vec3 ---------- */
const M4 = {
  create() { const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  identity(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  copy(o, a) { o.set(a); return o; },
  perspective(o, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
    return o;
  },
  lookAt(o, eye, c, up) {
    let zx = eye[0] - c[0], zy = eye[1] - c[1], zz = eye[2] - c[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    o[15] = 1;
    return o;
  },
  multiply(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },
  /* Translation * RotY * RotX * RotZ * Scale */
  fromTRS(o, p, r, s) {
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    // R = Ry * Rx * Rz
    const r00 = cy * cz + sy * sx * sz, r01 = cx * sz, r02 = -sy * cz + cy * sx * sz;
    const r10 = -cy * sz + sy * sx * cz, r11 = cx * cz, r12 = sy * sz + cy * sx * cz;
    const r20 = sy * cx, r21 = -sx, r22 = cy * cx;
    o[0] = r00 * s[0]; o[1] = r01 * s[0]; o[2] = r02 * s[0]; o[3] = 0;
    o[4] = r10 * s[1]; o[5] = r11 * s[1]; o[6] = r12 * s[1]; o[7] = 0;
    o[8] = r20 * s[2]; o[9] = r21 * s[2]; o[10] = r22 * s[2]; o[11] = 0;
    o[12] = p[0]; o[13] = p[1]; o[14] = p[2]; o[15] = 1;
    return o;
  },
  transformPoint(m, v) {
    return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]];
  },
  transformDir(m, v) {
    return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
  },
  normalMat3(o, m) { // upper 3x3 (assumes uniform-ish scale; shader normalizes)
    o[0] = m[0]; o[1] = m[1]; o[2] = m[2]; o[3] = m[4]; o[4] = m[5]; o[5] = m[6]; o[6] = m[8]; o[7] = m[9]; o[8] = m[10];
    return o;
  }
};

/* ---------- RNG déterministe ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- Constructeur de géométrie ---------- */
// Un vertex = pos(3) + normale(3) + couleur(4: rgb + émissif) + uv(2, négatif = sans texture)
class MeshBuilder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; this.idx = []; this.vcount = 0; }
  get vertexCount() { return this.vcount; }

  _push(p, n, c, m, uv) {
    let x = p[0], y = p[1], z = p[2], nx = n[0], ny = n[1], nz = n[2];
    if (m) {
      const q = M4.transformPoint(m, p); x = q[0]; y = q[1]; z = q[2];
      const d = M4.transformDir(m, n); const l = Math.hypot(d[0], d[1], d[2]) || 1; nx = d[0] / l; ny = d[1] / l; nz = d[2] / l;
    }
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz);
    this.col.push(c[0], c[1], c[2], c[3] || 0);
    this.uv.push(uv ? uv[0] : -1, uv ? uv[1] : -1); // uv < 0 = pas de texture
    return this.vcount++;
  }

  /* Boîte centrée en (0,0,0) de dimensions w,h,d. color: [r,g,b] ou fonction(x,y,z,normal)->[r,g,b,e] */
  box(w, h, d, color, m, opts = {}) {
    const hw = w / 2, hh = h / 2, hd = d / 2;
    const faces = [
      [[1, 0, 0], [[hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd], [hw, -hh, hd]]],
      [[-1, 0, 0], [[-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd], [-hw, -hh, -hd]]],
      [[0, 1, 0], [[-hw, hh, -hd], [-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd]]],
      [[0, -1, 0], [[-hw, -hh, hd], [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd]]],
      [[0, 0, 1], [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]]],
      [[0, 0, -1], [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]]],
    ];
    const cf = typeof color === 'function';
    for (const [n, vs] of faces) {
      if (opts.noBottom && n[1] < 0) continue;
      const base = this.vcount;
      for (const v of vs) {
        const c = cf ? color(v[0], v[1], v[2], n) : color;
        this._push(v, n, c, m);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }

  /* Sphère UV (rayon r) — scale optionnel [sx,sy,sz] ; opts.uv(p, dir) -> [u,v] ou null */
  sphere(r, seg, ring, color, m, scale, opts = {}) {
    const cf = typeof color === 'function';
    const sx = scale ? scale[0] : 1, sy = scale ? scale[1] : 1, sz = scale ? scale[2] : 1;
    const base = this.vcount;
    for (let i = 0; i <= ring; i++) {
      const phi = Math.PI * i / ring, sp = Math.sin(phi), cp = Math.cos(phi);
      for (let j = 0; j <= seg; j++) {
        const th = 2 * Math.PI * j / seg;
        const nx = sp * Math.cos(th), ny = cp, nz = sp * Math.sin(th);
        const p = [nx * r * sx, ny * r * sy, nz * r * sz];
        const n = [nx / sx, ny / sy, nz / sz];
        const c = cf ? color(p[0], p[1], p[2], n) : color;
        this._push(p, n, c, m, opts.uv ? opts.uv(p, [nx, ny, nz]) : null);
      }
    }
    for (let i = 0; i < ring; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * (seg + 1) + j, b = a + seg + 1;
      this.idx.push(a, a + 1, b, b, a + 1, b + 1); // sens antihoraire vu de l'extérieur
    }
    return this;
  }

  /* Cylindre / cône (rayon bas rb, rayon haut rt, hauteur h) centré verticalement */
  cylinder(rb, rt, h, seg, color, m, opts = {}) {
    const cf = typeof color === 'function';
    const hh = h / 2;
    const base = this.vcount;
    const slope = (rb - rt) / h;
    for (let j = 0; j <= seg; j++) {
      const th = 2 * Math.PI * j / seg, c = Math.cos(th), s = Math.sin(th);
      const nl = Math.hypot(1, slope); const n = [c / nl, slope / nl, s / nl];
      const pb = [c * rb, -hh, s * rb], pt = [c * rt, hh, s * rt];
      this._push(pb, n, cf ? color(pb[0], pb[1], pb[2], n) : color, m);
      this._push(pt, n, cf ? color(pt[0], pt[1], pt[2], n) : color, m);
    }
    for (let j = 0; j < seg; j++) {
      const a = base + j * 2;
      this.idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    // capuchons
    if (!opts.noTop && rt > 0) this._disc(rt, hh, seg, [0, 1, 0], color, m, cf);
    if (!opts.noBottom && rb > 0) this._disc(rb, -hh, seg, [0, -1, 0], color, m, cf);
    return this;
  }
  _disc(r, y, seg, n, color, m, cf) {
    const cbase = this.vcount;
    const pc = [0, y, 0];
    this._push(pc, n, cf ? color(0, y, 0, n) : color, m);
    for (let j = 0; j <= seg; j++) {
      const th = 2 * Math.PI * j / seg;
      const p = [Math.cos(th) * r, y, Math.sin(th) * r];
      this._push(p, n, cf ? color(p[0], p[1], p[2], n) : color, m);
    }
    for (let j = 0; j < seg; j++) {
      if (n[1] > 0) this.idx.push(cbase, cbase + 2 + j, cbase + 1 + j);
      else this.idx.push(cbase, cbase + 1 + j, cbase + 2 + j);
    }
  }
  disc(r, seg, color, m) { this._disc(r, 0, seg, [0, 1, 0], color, m, typeof color === 'function'); return this; }

  /* Tore (rayon R, tube r) dans le plan XZ */
  torus(R, r, seg, tube, color, m) {
    const base = this.vcount;
    for (let i = 0; i <= seg; i++) {
      const u = 2 * Math.PI * i / seg, cu = Math.cos(u), su = Math.sin(u);
      for (let j = 0; j <= tube; j++) {
        const v = 2 * Math.PI * j / tube, cv = Math.cos(v), sv = Math.sin(v);
        const p = [(R + r * cv) * cu, r * sv, (R + r * cv) * su];
        const n = [cv * cu, sv, cv * su];
        this._push(p, n, color, m);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
      const a = base + i * (tube + 1) + j, b = a + tube + 1;
      this.idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    return this;
  }

  /* Plan horizontal (y=0) de w x d, subdivisé, couleur fonction(x,z) */
  plane(w, d, nx, nz, color, m) {
    const cf = typeof color === 'function';
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = -w / 2 + w * i / nx, x1 = -w / 2 + w * (i + 1) / nx;
      const z0 = -d / 2 + d * j / nz, z1 = -d / 2 + d * (j + 1) / nz;
      const c = cf ? color((x0 + x1) / 2, (z0 + z1) / 2) : color;
      const base = this.vcount, n = [0, 1, 0];
      this._push([x0, 0, z0], n, c, m); this._push([x0, 0, z1], n, c, m);
      this._push([x1, 0, z1], n, c, m); this._push([x1, 0, z0], n, c, m);
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return this;
  }

  /* Étoile à 5 branches extrudée (rayon ext R, int r, épaisseur t) dans le plan XY */
  star(R, r, t, color, m) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 === 0) ? R : r;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    const ht = t / 2;
    for (const side of [1, -1]) {
      const n = [0, 0, side];
      const c = this.vcount;
      this._push([0, 0, side * ht], n, color, m);
      for (let i = 0; i <= 10; i++) { const p = pts[i % 10]; this._push([p[0], p[1], side * ht], n, color, m); }
      for (let i = 0; i < 10; i++) {
        if (side > 0) this.idx.push(c, c + 1 + i, c + 2 + i); else this.idx.push(c, c + 2 + i, c + 1 + i);
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = pts[i], b = pts[(i + 1) % 10];
      const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1;
      const n = [ey / l, -ex / l, 0];
      const base = this.vcount;
      this._push([a[0], a[1], ht], n, color, m); this._push([b[0], b[1], ht], n, color, m);
      this._push([b[0], b[1], -ht], n, color, m); this._push([a[0], a[1], -ht], n, color, m);
      this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    return this;
  }

  /* Fusionne un autre builder */
  merge(other, m) {
    const base = this.vcount;
    for (let i = 0; i < other.vcount; i++) {
      this._push([other.pos[i * 3], other.pos[i * 3 + 1], other.pos[i * 3 + 2]],
        [other.nor[i * 3], other.nor[i * 3 + 1], other.nor[i * 3 + 2]],
        [other.col[i * 4], other.col[i * 4 + 1], other.col[i * 4 + 2], other.col[i * 4 + 3]], m,
        other.uv[i * 2] >= 0 ? [other.uv[i * 2], other.uv[i * 2 + 1]] : null);
    }
    for (const k of other.idx) this.idx.push(k + base);
    return this;
  }

  build(gl) { return new Mesh(gl, this); }
}

/* Matrice de placement rapide: translation + rotation Y (+X,+Z) + échelle uniforme */
function T(pos, ry = 0, rx = 0, rz = 0, s = 1) {
  return M4.fromTRS(M4.create(), pos, [rx, ry, rz], [s, s, s]);
}

/* ---------- Mesh GPU ---------- */
class Mesh {
  constructor(gl, b) {
    this.gl = gl;
    const n = b.vcount;
    const data = new Float32Array(n * 12);
    for (let i = 0; i < n; i++) {
      const o = i * 12;
      data[o] = b.pos[i * 3]; data[o + 1] = b.pos[i * 3 + 1]; data[o + 2] = b.pos[i * 3 + 2];
      data[o + 3] = b.nor[i * 3]; data[o + 4] = b.nor[i * 3 + 1]; data[o + 5] = b.nor[i * 3 + 2];
      data[o + 6] = b.col[i * 4]; data[o + 7] = b.col[i * 4 + 1]; data[o + 8] = b.col[i * 4 + 2]; data[o + 9] = b.col[i * 4 + 3];
      data[o + 10] = b.uv[i * 2]; data[o + 11] = b.uv[i * 2 + 1];
    }
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    const big = n > 65535;
    this.indexType = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(b.idx) : new Uint16Array(b.idx), gl.STATIC_DRAW);
    this.count = b.idx.length;
    this.vertexCount = n;
  }
  dispose() { this.gl.deleteBuffer(this.vbo); this.gl.deleteBuffer(this.ibo); }
}

/* ---------- Noeud de scène ---------- */
class Node {
  constructor(mesh = null) {
    this.mesh = mesh;
    this.position = [0, 0, 0]; this.rotation = [0, 0, 0]; this.scale = [1, 1, 1];
    this.children = []; this.visible = true; this.alpha = 1; this.additive = false; this.noFog = false;
    this.texture = null; this.noGlow = false;
    this.world = M4.create(); this.local = M4.create();
    this.parent = null;
  }
  add(n) { n.parent = this; this.children.push(n); return n; }
  remove(n) { const i = this.children.indexOf(n); if (i >= 0) { this.children.splice(i, 1); n.parent = null; } }
  updateWorld(parentWorld) {
    M4.fromTRS(this.local, this.position, this.rotation, this.scale);
    if (parentWorld) M4.multiply(this.world, parentWorld, this.local); else M4.copy(this.world, this.local);
    for (const c of this.children) c.updateWorld(this.world);
  }
}

/* ---------- Shaders ---------- */
const VS_MAIN = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec4 aCol; attribute vec2 aUV;
uniform mat4 uProj, uView, uModel; uniform mat3 uNormal;
varying vec3 vNor; varying vec4 vCol; varying vec3 vWorld; varying vec2 vUV;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz; vNor = uNormal * aNor; vCol = aCol; vUV = aUV;
  gl_Position = uProj * uView * w;
}`;
const FS_MAIN = `
precision mediump float;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGroundCol, uFogCol, uCamPos;
uniform float uFogDensity, uAlpha, uGlow, uFlash, uHasTex;
uniform sampler2D uTex;
varying vec3 vNor; varying vec4 vCol; varying vec3 vWorld; varying vec2 vUV;
void main(){
  vec3 n = normalize(vNor);
  float hemi = n.y * 0.5 + 0.5;
  vec3 amb = mix(uGroundCol, uSkyCol, hemi);
  float diff = max(dot(n, uSunDir), 0.0);
  vec3 v = normalize(uCamPos - vWorld);
  vec3 h = normalize(uSunDir + v);
  float spec = pow(max(dot(n, h), 0.0), 28.0) * 0.18;
  vec3 light = amb + uSunCol * diff;
  vec3 lit = vCol.rgb * light + uSunCol * spec;
  vec3 col = mix(lit, vCol.rgb * uGlow, vCol.a);
  if (uHasTex > 0.5 && vUV.x >= 0.0) {
    // photo du visage : disque fondu dans la peau, légèrement éclairé par la scène
    vec4 tx = texture2D(uTex, vUV);
    float mk = 1.0 - smoothstep(0.36, 0.47, length(vUV - 0.5));
    vec3 tl = tx.rgb * mix(vec3(1.0), light, 0.4);
    col = mix(col, tl, mk);
  }
  float d = distance(uCamPos, vWorld);
  float f = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
  col = mix(col, uFogCol, clamp(f, 0.0, 1.0));
  col += uFlash * vec3(0.32, 0.36, 0.48);
  gl_FragColor = vec4(col, uAlpha);
}`;
const VS_PART = `
attribute vec3 aPos; attribute vec4 aCol; attribute float aSize;
uniform mat4 uProj, uView; uniform float uScale;
varying vec4 vCol;
void main(){
  vec4 mv = uView * vec4(aPos, 1.0);
  gl_Position = uProj * mv;
  gl_PointSize = clamp(aSize * uScale / max(-mv.z, 0.5), 1.0, 120.0);
  vCol = aCol;
}`;
const FS_PART = `
precision mediump float;
varying vec4 vCol;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d);
  gl_FragColor = vec4(vCol.rgb, vCol.a * a);
}`;

function compileProgram(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program: ' + gl.getProgramInfoLog(p));
  const u = {}, a = {};
  const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
  return { prog: p, u, a };
}

/* ---------- Système de particules ---------- */
class ParticleSystem {
  constructor(gl, max) {
    this.gl = gl; this.max = max; this.count = 0;
    this.data = new Float32Array(max * 8); // x y z r g b a size
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data, gl.DYNAMIC_DRAW);
    this.additive = true;
  }
  upload() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * 8));
  }
}

/* ---------- Renderer ---------- */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const opts = { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) throw new Error('WebGL indisponible');
    this.gl = gl;
    this.ext32 = gl.getExtension('OES_element_index_uint');
    this.main = compileProgram(gl, VS_MAIN, FS_MAIN);
    this.part = compileProgram(gl, VS_PART, FS_PART);
    this.proj = M4.create(); this.view = M4.create();
    this.normal3 = new Float32Array(9);
    this.camPos = [0, 5, 5];
    this.light = { sunDir: [0.4, 0.8, 0.45], sunCol: [1, 0.95, 0.85], sky: [0.5, 0.6, 0.8], ground: [0.25, 0.22, 0.2], fog: [0.6, 0.7, 0.9], fogDensity: 0.02, flash: 0 };
    this.glow = 1; // pulsation des surfaces émissives (néons, lave, étoiles)
    this.whiteTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.whiteTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    this.pixelRatio = 1;
    this.fov = 60 * Math.PI / 180;
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    this.transparent = [];
    this.drawCalls = 0;
  }
  resize(w, h, pr) {
    this.pixelRatio = pr;
    const cw = Math.floor(w * pr), ch = Math.floor(h * pr);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this.gl.viewport(0, 0, cw, ch);
    this.aspect = w / h;
    M4.perspective(this.proj, this.fov, this.aspect, 0.1, 500);
  }
  setCamera(eye, target) {
    this.camPos = eye;
    M4.lookAt(this.view, eye, target, [0, 1, 0]);
  }
  render(root, particles) {
    const gl = this.gl, L = this.light, P = this.main;
    const f = L.fog, fl = L.flash || 0;
    gl.clearColor(Math.min(1, f[0] + fl * 0.32), Math.min(1, f[1] + fl * 0.36), Math.min(1, f[2] + fl * 0.48), 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(P.u.uView, false, this.view);
    gl.uniform3fv(P.u.uSunDir, L.sunDir); gl.uniform3fv(P.u.uSunCol, L.sunCol);
    gl.uniform3fv(P.u.uSkyCol, L.sky); gl.uniform3fv(P.u.uGroundCol, L.ground);
    gl.uniform3fv(P.u.uFogCol, L.fog); gl.uniform3fv(P.u.uCamPos, this.camPos);
    gl.uniform1f(P.u.uFogDensity, L.fogDensity);
    gl.uniform1f(P.u.uAlpha, 1);
    gl.uniform1f(P.u.uFlash, fl);
    gl.uniform1i(P.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    this.transparent.length = 0; this.drawCalls = 0;
    root.updateWorld(null);
    gl.disable(gl.BLEND); gl.depthMask(true);
    this._draw(root, false);
    // transparents
    if (this.transparent.length) {
      gl.enable(gl.BLEND); gl.depthMask(false);
      for (const n of this.transparent) {
        gl.blendFunc(gl.SRC_ALPHA, n.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1f(P.u.uAlpha, n.alpha);
        this._drawMesh(n);
      }
      gl.uniform1f(P.u.uAlpha, 1);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    if (particles && particles.length) this._drawParticles(particles);
  }
  _draw(n) {
    if (!n.visible) return;
    if (n.mesh) {
      if (n.alpha < 1) this.transparent.push(n); else this._drawMesh(n);
    }
    for (const c of n.children) this._draw(c);
  }
  _drawMesh(n) {
    const gl = this.gl, P = this.main, m = n.mesh;
    gl.uniformMatrix4fv(P.u.uModel, false, n.world);
    gl.uniformMatrix3fv(P.u.uNormal, false, M4.normalMat3(this.normal3, n.world));
    if (n.noFog) gl.uniform1f(P.u.uFogDensity, 0);
    gl.uniform1f(P.u.uGlow, n.noGlow ? 1 : this.glow);
    gl.bindTexture(gl.TEXTURE_2D, n.texture || this.whiteTex);
    gl.uniform1f(P.u.uHasTex, n.texture ? 1 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    gl.enableVertexAttribArray(P.a.aPos); gl.vertexAttribPointer(P.a.aPos, 3, gl.FLOAT, false, 48, 0);
    gl.enableVertexAttribArray(P.a.aNor); gl.vertexAttribPointer(P.a.aNor, 3, gl.FLOAT, false, 48, 12);
    gl.enableVertexAttribArray(P.a.aCol); gl.vertexAttribPointer(P.a.aCol, 4, gl.FLOAT, false, 48, 24);
    gl.enableVertexAttribArray(P.a.aUV); gl.vertexAttribPointer(P.a.aUV, 2, gl.FLOAT, false, 48, 40);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ibo);
    if (n.doubleSided) gl.disable(gl.CULL_FACE);
    gl.drawElements(gl.TRIANGLES, m.count, m.indexType, 0);
    if (n.doubleSided) gl.enable(gl.CULL_FACE);
    if (n.noFog) gl.uniform1f(P.u.uFogDensity, this.light.fogDensity);
    this.drawCalls++;
  }
  _drawParticles(systems) {
    const gl = this.gl, P = this.part;
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(P.u.uView, false, this.view);
    gl.uniform1f(P.u.uScale, this.canvas.height * 0.022);
    gl.enable(gl.BLEND); gl.depthMask(false);
    for (const s of systems) {
      if (!s.count) continue;
      gl.blendFunc(gl.SRC_ALPHA, s.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      s.upload();
      gl.bindBuffer(gl.ARRAY_BUFFER, s.vbo);
      gl.enableVertexAttribArray(P.a.aPos); gl.vertexAttribPointer(P.a.aPos, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(P.a.aCol); gl.vertexAttribPointer(P.a.aCol, 4, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(P.a.aSize); gl.vertexAttribPointer(P.a.aSize, 1, gl.FLOAT, false, 32, 28);
      gl.drawArrays(gl.POINTS, 0, s.count);
      this.drawCalls++;
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    // Rétablir les attributs du programme principal au prochain draw (fait dans _drawMesh)
    gl.disableVertexAttribArray(P.a.aSize);
  }
}

/* utilitaires */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function mulc(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function mixHex(a, b, t) { return mixc(hex(a), hex(b), t); }
/* Texture 2D depuis un canvas / une image (photo du visage) */
function makeTexture(gl, source, existing) {
  const t = existing || gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  return t;
}
