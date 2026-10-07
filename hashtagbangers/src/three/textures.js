import { CanvasTexture, RepeatWrapping, SRGBColorSpace, NoColorSpace } from 'three';

// Petites textures procédurales (canvas 2D), générées une seule fois au démarrage.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// Dessine un blob en le répétant sur les bords → texture raccordable (tileable).
function wrapBlob(ctx, size, x, y, r, fill) {
  ctx.fillStyle = fill;
  for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
    const cx = x + ox * size, cy = y + oy * size;
    if (cx + r < 0 || cy + r < 0 || cx - r > size || cy - r > size) continue;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
}

function grain(ctx, size, amount, rand) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function tex(c, srgb = true, repeat = true) {
  const t = new CanvasTexture(c);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Croûte de steak smash : brun profond, zones caramélisées, points grillés.
export function beefTextures(rand) {
  const S = 256;
  const [c, x] = canvas(S);
  x.fillStyle = '#4a220e'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) wrapBlob(x, S, rand() * S, rand() * S, 4 + rand() * 16, `rgba(122,62,26,${0.25 + rand() * 0.3})`);
  for (let i = 0; i < 220; i++) wrapBlob(x, S, rand() * S, rand() * S, 2 + rand() * 9, `rgba(44,18,6,${0.3 + rand() * 0.4})`);
  for (let i = 0; i < 160; i++) wrapBlob(x, S, rand() * S, rand() * S, 1 + rand() * 3, `rgba(168,92,40,${0.35 + rand() * 0.35})`);
  for (let i = 0; i < 90; i++) wrapBlob(x, S, rand() * S, rand() * S, 1 + rand() * 2.5, `rgba(18,8,3,${0.6})`);
  grain(x, S, 26, rand);
  return { map: tex(c), bump: tex(c, false) };
}

// Grain de mie / croûte de pain, multiplié aux couleurs de sommets.
export function bunTexture(rand) {
  const S = 256;
  const [c, x] = canvas(S);
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) wrapBlob(x, S, rand() * S, rand() * S, 2 + rand() * 10, `rgba(200,120,60,${0.04 + rand() * 0.06})`);
  for (let i = 0; i < 200; i++) wrapBlob(x, S, rand() * S, rand() * S, 1 + rand() * 3, `rgba(255,240,210,${0.2})`);
  grain(x, S, 14, rand);
  return tex(c);
}

// Mie toastée (faces coupées du pain).
export function crumbTexture(rand) {
  const S = 256;
  const [c, x] = canvas(S);
  const g = x.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#f6dca6'); g.addColorStop(0.7, '#efc983'); g.addColorStop(1, '#c98a3e');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) {
    x.fillStyle = `rgba(${rand() < 0.5 ? '170,110,50' : '255,245,220'},${0.12 + rand() * 0.15})`;
    x.beginPath(); x.arc(rand() * S, rand() * S, 0.8 + rand() * 2.5, 0, Math.PI * 2); x.fill();
  }
  return tex(c, true, false);
}

// Lardons fumés : viande rouge-rosée veinée de gras.
export function baconTexture(rand) {
  const W = 128, H = 64;
  const [c, x] = canvas(W, H);
  x.fillStyle = '#b4372b'; x.fillRect(0, 0, W, H);
  for (let b = 0; b < 4; b++) {
    const y0 = 6 + b * 15 + rand() * 4;
    x.strokeStyle = `rgba(247,205,186,${0.75 + rand() * 0.2})`;
    x.lineWidth = 2 + rand() * 4;
    x.beginPath();
    for (let i = 0; i <= W; i += 8) x.lineTo(i, y0 + Math.sin(i * 0.08 + b) * 3);
    x.stroke();
  }
  for (let i = 0; i < 60; i++) {
    x.fillStyle = `rgba(110,24,18,${0.3})`;
    x.fillRect(rand() * W, rand() * H, 2 + rand() * 6, 1 + rand() * 2);
  }
  const t = tex(c);
  return t;
}

// Dégradé radial générique (glow, ombre, onde de choc).
export function radialTexture(stops, size = 128) {
  const [c, x] = canvas(size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return tex(c, true, false);
}
