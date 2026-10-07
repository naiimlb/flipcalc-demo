import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Sprite, SpriteMaterial,
  Mesh, PlaneGeometry, RingGeometry, MeshBasicMaterial, AdditiveBlending, SRGBColorSpace, ACESFilmicToneMapping, Vector3,
} from 'three';
import { radialTexture } from './textures.js';

// Rendu, caméra, éclairage studio, glow / ombre / onde de choc et gestion de la qualité.

export function createStage(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);

  // studio : key chaude, rim rose, fill doux, ambiance rose
  scene.add(new HemisphereLight(0xfff3e4, 0xff9cc8, 0.75));
  const key = new DirectionalLight(0xffeed6, 2.5);
  key.position.set(3.5, 6, 5);
  const rim = new DirectionalLight(0xff3a96, 2.6);
  rim.position.set(-5, 2.5, -4);
  const rim2 = new DirectionalLight(0xffc4e0, 0.9);
  rim2.position.set(5, 1.5, -3);
  const fill = new DirectionalLight(0xfff0e6, 0.45);
  fill.position.set(-4, 1, 5);
  scene.add(key, rim, rim2, fill);

  // glow rose derrière le burger
  const glow = new Sprite(new SpriteMaterial({
    map: radialTexture([[0, 'rgba(255,120,190,0.85)'], [0.35, 'rgba(255,80,160,0.35)'], [1, 'rgba(255,60,150,0)']]),
    blending: AdditiveBlending, depthWrite: false, transparent: true,
  }));
  // placé derrière le burger (dans l'axe caméra) et testé en profondeur : le burger le masque
  glow.renderOrder = -2;
  glow.scale.set(7, 7, 1);
  scene.add(glow);

  // fausse ombre en blob
  const shadow = new Mesh(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(90,0,40,0.55)'], [0.5, 'rgba(120,0,60,0.25)'], [1, 'rgba(120,0,60,0)']]),
    transparent: true, depthWrite: false,
  }));
  shadow.renderOrder = -1;
  shadow.position.y = -0.06;
  scene.add(shadow);

  // onde de choc (fermeture / BANG!)
  const shock = new Mesh(new RingGeometry(0.86, 1, 72).rotateX(-Math.PI / 2), new MeshBasicMaterial({
    color: 0xff3d9a, transparent: true, opacity: 0, depthWrite: false,
  }));
  shock.position.y = 0.02;
  shock.renderOrder = -1;
  const shock2 = shock.clone();
  shock2.material = shock.material.clone();
  shock2.material.color.set(0xffffff);
  scene.add(shock, shock2);

  const size = { w: 1, h: 1 };
  const dprMax = Math.min(window.devicePixelRatio || 1, 2);
  const LEVELS = [
    { pr: dprMax, budget: 1 },
    { pr: Math.min(dprMax, 1.6), budget: 0.7 },
    { pr: Math.min(dprMax, 1.3), budget: 0.45 },
    { pr: 1, budget: 0.3 },
  ];
  let level = 0;
  const onQuality = [];

  function resize() {
    size.w = window.innerWidth;
    size.h = window.innerHeight;
    renderer.setPixelRatio(LEVELS[level].pr);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    onQuality.forEach((f) => f(LEVELS[level], size));
  }

  // réduction auto de la qualité si le FPS moyen passe sous 45
  let acc = 0, frames = 0, grace = 2.5;
  function monitor(dt) {
    if (grace > 0) { grace -= dt; return; }
    acc += dt; frames++;
    if (acc < 1.5) return;
    const fps = frames / acc;
    acc = 0; frames = 0;
    if (fps < 45 && level < LEVELS.length - 1) {
      level++;
      grace = 1.5;
      resize();
    }
  }

  // distance caméra pour que (w × h) tienne dans (fw × fh) de l'écran
  const tanV = Math.tan((camera.fov * Math.PI) / 360);
  function fit(w, h, fw, fh) {
    const tanH = tanV * camera.aspect;
    return Math.max(w / 2 / (tanH * fw), h / 2 / (tanV * fh));
  }

  const target = new Vector3();
  function applyRig(r) {
    const ce = Math.cos(r.elev);
    target.set(0, r.ty, 0);
    camera.position.set(
      Math.sin(r.az) * ce * r.dist + r.px,
      r.ty + Math.sin(r.elev) * r.dist + r.py,
      Math.cos(r.az) * ce * r.dist,
    );
    camera.lookAt(target);
    // décale le cadrage vers le haut / bas sans changer la perspective
    camera.setViewOffset(size.w, size.h, 0, r.off * size.h, size.w, size.h);
  }

  return {
    renderer, scene, camera, glow, shadow, shock, shock2, size, fit, applyRig, resize, monitor,
    onQuality: (f) => onQuality.push(f),
    get quality() { return LEVELS[level]; },
  };
}
