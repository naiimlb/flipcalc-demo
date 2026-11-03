"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HERO_OBJECTS, type HeroObject } from "@/lib/design/hero";
import { MATERIAL_PRESETS, applyPartTransform, createPartGeometry, disposeGroup } from "@/lib/three/geometry";

/** Position commune du pointeur / du doigt / de l'inclinaison, de -1 à 1 sur chaque axe. */
type Pointer = { x: number; y: number };

/** Construit un objet centré et ramené à une taille de 1 unité. */
function buildObject(obj: HeroObject): THREE.Group {
  const inner = new THREE.Group();
  for (const part of obj.parts) {
    const preset = MATERIAL_PRESETS[part.material];
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(part.color),
      metalness: preset.metalness,
      roughness: Math.min(preset.roughness, 0.6),
      transparent: preset.opacity < 1,
      opacity: preset.opacity,
    });
    const mesh = new THREE.Mesh(createPartGeometry(part, "low"), material);
    applyPartTransform(mesh, part);
    inner.add(mesh);
  }
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  inner.position.copy(center.multiplyScalar(-1));
  const outer = new THREE.Group();
  outer.add(inner);
  outer.scale.setScalar(1 / Math.max(size.x, size.y, size.z, 1));
  return outer;
}

/** Emplacements autour du titre, en fraction de la zone visible (paysage / portrait). */
const SLOTS_WIDE = [
  { x: -0.41, y: 0.27, z: -0.4, size: 0.16, spin: 0.22, phase: 0, tilt: [0.35, 0.5, 0.1] },
  { x: 0.41, y: 0.37, z: -0.8, size: 0.14, spin: -0.18, phase: 1.4, tilt: [0.45, -0.6, -0.08] },
  { x: -0.38, y: -0.3, z: -0.6, size: 0.15, spin: 0.26, phase: 2.6, tilt: [0.1, 0.4, 0.05] },
  { x: 0.39, y: -0.28, z: -0.2, size: 0.15, spin: -0.3, phase: 3.9, tilt: [0.9, 0.2, 0.3] },
];
const SLOTS_TALL = [
  { x: -0.3, y: 0.36, z: -0.4, size: 0.3, spin: 0.22, phase: 0, tilt: [0.35, 0.5, 0.1] },
  { x: 0.3, y: 0.39, z: -0.8, size: 0.26, spin: -0.18, phase: 1.4, tilt: [0.45, -0.6, -0.08] },
  { x: -0.3, y: -0.37, z: -0.6, size: 0.26, spin: 0.26, phase: 2.6, tilt: [0.1, 0.4, 0.05] },
  { x: 0.3, y: -0.36, z: -0.2, size: 0.26, spin: -0.3, phase: 3.9, tilt: [0.9, 0.2, 0.3] },
];

function Floater({ obj, index, pointer, animate }: { obj: HeroObject; index: number; pointer: React.MutableRefObject<Pointer>; animate: boolean }) {
  const object = useMemo(() => buildObject(obj), [obj]);
  useEffect(() => () => disposeGroup(object), [object]);
  const { viewport } = useThree();
  const tall = viewport.aspect < 0.9;
  const slot = (tall ? SLOTS_TALL : SLOTS_WIDE)[index];
  const unit = Math.min(viewport.width, viewport.height * 1.25);
  const base = useMemo(() => new THREE.Vector3(slot.x * viewport.width, slot.y * viewport.height, slot.z), [slot, viewport.width, viewport.height]);
  const outer = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const g = outer.current;
    const s = spinner.current;
    if (!g || !s) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const depth = 1 + slot.z * -0.6;
    // Parallaxe : les objets suivent légèrement le pointeur (ou l'inclinaison), avec amortissement.
    const px = pointer.current.x;
    const py = pointer.current.y;
    g.position.x = THREE.MathUtils.damp(g.position.x, base.x + px * 0.18 * depth, 3, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, base.y + py * 0.12 * depth + (animate ? Math.sin(t * 0.7 + slot.phase) * 0.06 : 0), 3, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, slot.tilt[0] - py * 0.35, 3, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, px * 0.55, 3, dt);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, slot.tilt[2] + px * 0.12, 3, dt);
    if (animate) s.rotation.y += dt * slot.spin;
  });

  return (
    <group ref={outer} position={base} rotation={[slot.tilt[0], 0, slot.tilt[2]]} scale={unit * slot.size}>
      <group ref={spinner} rotation={[0, slot.tilt[1], 0]}>
        <primitive object={object} />
      </group>
    </group>
  );
}

/** Reflets doux générés localement (aucune image HDR à télécharger). */
function LocalEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const texture = pmrem.fromScene(room, 0.04).texture;
    scene.environment = texture;
    scene.environmentIntensity = 0.45;
    return () => {
      scene.environment = null;
      texture.dispose();
      pmrem.dispose();
      room.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      });
    };
  }, [gl, scene]);
  return null;
}

/**
 * Scène 3D du héros : quatre objets Forma3D qui flottent autour du titre, tournent lentement
 * et réagissent au curseur, au doigt et à l'inclinaison de l'appareil.
 * Éclairage néon : bleu électrique sur les bords gauches, corail sur les bords droits.
 */
export default function HeroScene({ pointer, reduceMotion, onReady }: { pointer: React.MutableRefObject<Pointer>; reduceMotion: boolean; onReady(): void }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [dpr, setDpr] = useState(() => Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio, 1.75));

  // Pause quand le héros n'est plus à l'écran ou que l'onglet est masqué (batterie de l'iPad).
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    let onScreen = true;
    const update = () => setVisible(onScreen && document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={wrapper} className="absolute inset-0">
      <Canvas
        dpr={dpr}
        frameloop={!visible ? "never" : reduceMotion ? "demand" : "always"}
        camera={{ position: [0, 0, 5], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          requestAnimationFrame(onReady);
        }}
        aria-hidden
      >
        {/* Qualité adaptative : la résolution baisse si l'appareil peine, remonte s'il suit. */}
        <PerformanceMonitor
          onDecline={() => setDpr(1)}
          onIncline={() => setDpr(Math.min(window.devicePixelRatio, 2))}
          flipflops={3}
          onFallback={() => setDpr(0.85)}
        />
        <LocalEnvironment />
        <ambientLight intensity={0.18} />
        <directionalLight position={[1.5, 3, 5]} intensity={0.9} color="#ffffff" />
        {/* Lumières de contour néon */}
        <directionalLight position={[-6, 1.5, -2]} intensity={5} color="#2f6bff" />
        <directionalLight position={[6, -1, -2]} intensity={4.2} color="#ff6b4a" />
        <directionalLight position={[0, 5, -4]} intensity={1.6} color="#8b5cf6" />
        {HERO_OBJECTS.map((obj, i) => (
          <Floater key={obj.id} obj={obj} index={i} pointer={pointer} animate={!reduceMotion} />
        ))}
      </Canvas>
    </div>
  );
}
