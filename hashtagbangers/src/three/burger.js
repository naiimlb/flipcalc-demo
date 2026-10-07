import { Group, Vector3, Quaternion } from 'three';
import { PARTS, cheeseStrings } from './parts.js';

// buildBurger(layers, ctx) : empile une couche par entrée de LAYERS.
// Chaque couche est un Group nommé (= id), animable séparément via son état `L` :
//   L.ex     0 → 1   détachement (ouverture éclatée)
//   L.drop   offset vertical libre (moment BANG!)
//   L.spin   rotation propre quand la couche lévite
//   L.part.params    paramètres spécifiques (fonte du cheddar, charnière du pain…)
//
// Pour passer plus tard à un .glb : remplace `PARTS[def.part](ctx)` par le nœud du
// modèle portant le même nom que `def.id` (voir fromGLTF en bas de fichier) ;
// les séquences GSAP ne changent pas.

const DOWN = new Vector3(0, -1, 0);
const _a = new Vector3(), _b = new Vector3(), _d = new Vector3(), _q = new Quaternion();

export function buildBurger(defs, ctx, source = null) {
  const root = new Group();
  root.name = 'burger';
  const stack = new Group();
  root.add(stack);

  let y = 0, lift = 0;
  const layers = defs.map((def, index) => {
    const part = source ? source(def) : PARTS[def.part](ctx, def);
    const group = new Group();
    group.name = def.id;
    group.add(part.object);
    group.position.y = y;
    stack.add(group);
    lift += def.gap;
    const L = {
      def, id: def.id, index, group, part,
      baseY: y, height: def.height, lift,
      ex: 0, drop: 0, spin: 0, spinSpeed: (index % 2 ? -1 : 1) * (0.18 + (index % 3) * 0.07),
      phase: index * 1.37, hl: 0, dim: 0, materials: [], below: null,
    };
    y += def.height;
    group.traverse((o) => {
      if (!o.material) return;
      const m = o.material;
      if (L.materials.includes(m)) return;
      m.userData.base = m.color.clone();
      m.userData.ei = m.emissiveIntensity ?? 0;
      L.materials.push(m);
    });
    return L;
  });
  layers.forEach((L, i) => { L.below = layers[i - 1] || null; });

  // filaments de cheddar entre chaque tranche et le steak du dessous
  const strings = [];
  layers.forEach((L) => {
    if (L.def.fx !== 'cheese' || !L.below) return;
    const list = cheeseStrings(L.part.mat, 5);
    list.forEach((m, k) => {
      stack.add(m);
      strings.push({ m, top: L, bot: L.below, a: (k / 5) * Math.PI * 2 + k * 0.4, r: 0.55 + (k % 3) * 0.15, th: 0.016 + (k % 2) * 0.008 });
    });
  });

  const byId = Object.fromEntries(layers.map((L) => [L.id, L]));
  const height = y;

  function update(dt, t, c) {
    for (const L of layers) {
      L.spin += dt * L.spinSpeed * L.ex;
      L.group.position.y = L.baseY + L.lift * L.ex + L.drop + Math.sin(t * 1.7 + L.phase) * 0.045 * L.ex;
      L.group.rotation.y = L.spin;
      L.group.rotation.z = Math.sin(t * 1.1 + L.phase) * 0.035 * L.ex;
      const s = 1 + 0.06 * L.hl * c.tour;
      L.group.scale.set(s, s, s);
      if (L.def.fx === 'cheese') L.part.params.melt = Math.max(L.part.params.melt, 0.12 + L.ex * 0.88) - dt * 0.15 * (1 - L.ex);
      L.part.update(dt, t, L, c);
      // mise en lumière de la couche active pendant la visite
      const dim = c.tour * (1 - L.hl) * 0.62;
      if (dim !== L.dim) {
        L.dim = dim;
        for (const m of L.materials) {
          m.color.copy(m.userData.base).multiplyScalar(1 - dim);
          if (m.emissive) m.emissiveIntensity = m.userData.ei * (1 - dim);
        }
      }
    }
    for (const s of strings) {
      const T = s.top, B = s.bot;
      const gap = T.group.position.y - (B.group.position.y + B.height * B.group.scale.y);
      if (gap < 0.03 || gap > 1.2) { s.m.visible = false; continue; }
      s.m.visible = true;
      const at = s.a + T.spin, ab = s.a + B.spin;
      const { y: dy } = T.part.droop(Math.cos(s.a) * s.r, Math.sin(s.a) * s.r, T.part.params.melt);
      _a.set(Math.cos(at) * s.r, T.group.position.y + dy, Math.sin(at) * s.r);
      _b.set(Math.cos(ab) * s.r * 0.85, B.group.position.y + B.height, Math.sin(ab) * s.r * 0.85);
      _d.subVectors(_b, _a);
      const len = _d.length();
      _q.setFromUnitVectors(DOWN, _d.divideScalar(len));
      s.m.position.copy(_a);
      s.m.quaternion.copy(_q);
      const th = s.th / (1 + len * 3.2);
      s.m.scale.set(th, len, th);
    }
  }

  return { root, stack, layers, byId, height, update };
}

// Adaptateur .glb (non utilisé par le prototype) :
//   const gltf = await new GLTFLoader().loadAsync('/bangers.glb');
//   buildBurger(LAYERS, ctx, fromGLTF(gltf.scene));
// Chaque nœud du modèle doit porter l'id de la couche ("bun-top", "egg"…), origine en bas de couche.
export function fromGLTF(scene) {
  return (def) => {
    const object = scene.getObjectByName(def.id);
    const params = { hinge: 0, vibrate: 0, melt: 0, splat: 1, splatY: 1, burst: 0, rain: 1, cover: 1, drip: 1, kick() {} };
    return { object, params, mat: null, droop: () => ({ y: 0 }), update() {} };
  };
}
