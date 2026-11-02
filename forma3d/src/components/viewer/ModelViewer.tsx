"use client";

import { Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, Environment, Grid, Lightformer, OrbitControls, PerformanceMonitor, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Design, Part } from "@/lib/design/schema";
import {
  MATERIAL_PRESETS,
  SCENE_SCALE,
  computeDesignBounds,
  computeExplodeOffsets,
  createPartGeometry,
  partRotation,
} from "@/lib/three/geometry";
import { detectQuality, type ViewerQuality } from "./quality";
import { VIEWER_BACKGROUNDS, type ViewerHandle, type ViewerSettings } from "./settings";

export type { RenderMode, ViewerHandle, ViewerSettings } from "./settings";

const NEON_RIMS = ["#ff5fd8", "#5fd6ff", "#b59bff", "#ff8fc7"];

interface ViewerProps {
  design: Design | null;
  settings: ViewerSettings;
  focusId: string | null;
  onFocusChange(id: string | null): void;
  /** Maillage externe (fournisseur text-to-3D), affiché à la place des primitives. */
  meshUrl?: string | null;
  handleRef?: Ref<ViewerHandle>;
}

export default function ModelViewer(props: ViewerProps) {
  // Niveau de rendu : appareil modeste ou téléphone = « low » ; descend aussi tout seul si l'affichage rame.
  const [quality, setQuality] = useState<ViewerQuality>(detectQuality);
  return (
    <Canvas
      dpr={quality === "low" ? [1, 1.25] : [1, 1.75]}
      // Image fixe quand rien ne bouge (économise la batterie) ; en continu seulement pour la rotation automatique.
      frameloop={props.settings.autoRotate ? "always" : "demand"}
      gl={{ preserveDrawingBuffer: true, antialias: quality !== "low", alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [3, 2.4, 3.6], fov: 38, near: 0.01, far: 200 }}
      onPointerMissed={() => props.onFocusChange(null)}
      className="!touch-none select-none"
    >
      <PerformanceMonitor flipflops={2} onDecline={() => setQuality("low")} />
      <Scene {...props} quality={quality} />
    </Canvas>
  );
}

function Scene({ design, settings, focusId, onFocusChange, meshUrl, handleRef, quality }: ViewerProps & { quality: ViewerQuality }) {
  const { camera, gl, scene, size, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const explode = useRef(0);

  const bounds = useMemo(() => (design ? computeDesignBounds(design) : null), [design]);
  const offsets = useMemo(
    () => (design && bounds ? computeExplodeOffsets(design, bounds) : new Map<string, THREE.Vector3>()),
    [design, bounds],
  );
  const sceneBox = useMemo(() => {
    if (!bounds || bounds.isEmpty()) return new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
    return new THREE.Box3(bounds.min.clone().multiplyScalar(SCENE_SCALE), bounds.max.clone().multiplyScalar(SCENE_SCALE));
  }, [bounds]);
  const sphere = useMemo(() => sceneBox.getBoundingSphere(new THREE.Sphere()), [sceneBox]);

  const fit = useCallback(() => {
    const persp = camera as THREE.PerspectiveCamera;
    const fov = (persp.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(size.height, 1);
    const radius = Math.max(sphere.radius, 0.05);
    const distance = (radius / Math.sin(fov / 2)) * (aspect < 1 ? 1 / aspect : 1) * 1.08;
    const direction = new THREE.Vector3(0.95, 0.6, 1.3).normalize();
    camera.position.copy(sphere.center).addScaledVector(direction, distance);
    persp.near = distance / 100;
    persp.far = distance * 30;
    persp.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(sphere.center);
      controls.current.minDistance = radius * 0.6;
      controls.current.maxDistance = distance * 4;
      controls.current.update();
    }
    invalidate();
  }, [camera, size.width, size.height, sphere, invalidate]);

  useEffect(() => {
    fit();
  }, [fit]);

  const dolly = useCallback(
    (factor: number) => {
      const target = controls.current?.target ?? sphere.center;
      camera.position.sub(target).multiplyScalar(factor).add(target);
      controls.current?.update();
      invalidate();
    },
    [camera, sphere, invalidate],
  );

  // Double-tap (ou double-clic) : recentre la vue. Ignoré pour un glissement ou un geste à deux doigts (pincement).
  const fitRef = useRef(fit);
  useEffect(() => {
    fitRef.current = fit;
  }, [fit]);
  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Set<number>();
    let multi = false;
    let down: { x: number; y: number; t: number } | null = null;
    let last: { x: number; y: number; t: number } | null = null;
    const onDown = (e: PointerEvent) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) multi = true;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      const start = down;
      if (pointers.size === 0) {
        const wasMulti = multi;
        multi = false;
        down = null;
        if (!start || wasMulti) {
          last = null;
          return;
        }
        const now = performance.now();
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12 || now - start.t > 350) {
          last = null;
          return;
        }
        if (last && now - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40) {
          last = null;
          fitRef.current();
        } else {
          last = { x: e.clientX, y: e.clientY, t: now };
        }
      }
    };
    const onCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) {
        multi = false;
        down = null;
        last = null;
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
    };
  }, [gl]);

  // En mode « image fixe », tout changement de réglage doit déclencher un nouveau rendu.
  useEffect(() => {
    invalidate();
  }, [invalidate, design, settings, focusId, meshUrl, quality]);

  useImperativeHandle(
    handleRef,
    () => ({
      zoomIn: () => dolly(0.8),
      zoomOut: () => dolly(1.25),
      resetView: fit,
      // Capture de qualité : rendu temporaire en haute résolution (2 à 3 fois la taille affichée).
      capturePng: async () => {
        const previous = gl.getPixelRatio();
        const hd = Math.min(3, Math.max(2, window.devicePixelRatio * 2));
        gl.setPixelRatio(hd);
        gl.setSize(size.width, size.height, false);
        gl.render(scene, camera);
        const blob = await compositePng(gl.domElement, VIEWER_BACKGROUNDS[settings.mode]);
        gl.setPixelRatio(previous);
        gl.setSize(size.width, size.height, false);
        invalidate();
        return blob;
      },
    }),
    [dolly, fit, gl, scene, camera, settings.mode, size.width, size.height, invalidate],
  );

  useFrame((_, delta) => {
    const target = settings.exploded ? 1 : 0;
    if (explode.current === target) return;
    explode.current = THREE.MathUtils.damp(explode.current, target, 5, delta);
    if (Math.abs(explode.current - target) < 0.002) explode.current = target;
    invalidate(); // l'animation continue jusqu'à l'arrivée, puis le rendu se fige
  });

  const real = settings.mode === "real";

  return (
    <>
      {/* Éclairage studio : lumière principale, débouchage et contre-jour ; reflets par une carte d'environnement (boîtes à lumière). */}
      <ambientLight intensity={real ? 0.22 : 0.8} />
      <hemisphereLight args={["#eef0ff", "#2b2266", real ? 0.45 : 0.3]} />
      <directionalLight position={[4, 6, 5]} intensity={real ? 1.6 : 0.6} />
      {real && <directionalLight position={[-5, 3, 2]} intensity={0.55} color="#c9d4ff" />}
      {real && <directionalLight position={[0, 4, -6]} intensity={0.9} color="#ffffff" />}
      <Environment resolution={quality === "low" ? 32 : 128}>
        <Lightformer form="rect" intensity={2.4} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} color="#ffffff" />
        <Lightformer intensity={2} position={[0, 5, -5]} scale={[10, 5, 1]} color="#ffffff" />
        <Lightformer intensity={1.2} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#c3b5ff" />
        <Lightformer intensity={1.2} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#a6dcff" />
        <Lightformer form="ring" intensity={1.5} position={[2, 2, 6]} scale={2} color="#ffffff" />
      </Environment>

      {meshUrl ? (
        <Suspense fallback={null}>
          <GlbModel url={meshUrl} box={sceneBox} />
        </Suspense>
      ) : (
        design && (
          <group scale={SCENE_SCALE}>
            {design.model.parts.map((part, index) => (
              <PartMesh
                key={part.id}
                part={part}
                index={index}
                offset={offsets.get(part.id) ?? null}
                explode={explode}
                settings={settings}
                focused={focusId === part.id}
                dimmed={focusId !== null && focusId !== part.id}
                detail={quality}
                onSelect={() => onFocusChange(part.id)}
              />
            ))}
          </group>
        )
      )}

      {settings.showGrid && (
        <Grid
          position={[sphere.center.x, 0, sphere.center.z]}
          infiniteGrid
          cellSize={0.1}
          sectionSize={0.5}
          cellThickness={0.6}
          sectionThickness={1}
          cellColor={real ? "#b9bde6" : "#8d9bff"}
          sectionColor={real ? "#8c90c9" : "#d2c2ff"}
          fadeDistance={Math.max(sphere.radius * 14, 4)}
          fadeStrength={1.5}
        />
      )}
      {real && (
        <ContactShadows
          position={[sphere.center.x, 0.0005, sphere.center.z]}
          scale={Math.max(sphere.radius * 5, 1)}
          far={Math.max(sphere.radius * 2, 0.5)}
          blur={2.8}
          opacity={0.55}
          resolution={quality === "low" ? 256 : 512}
          // Ombre figée sur appareil modeste (elle n'est recalculée que si la conception change).
          frames={quality === "low" ? 1 : Infinity}
          key={`${design?.title ?? "vide"}-${quality}`}
        />
      )}

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={settings.autoRotate}
        autoRotateSpeed={0.8}
        maxPolarAngle={Math.PI * 0.95}
        // Tactile : un doigt tourne, deux doigts pincent pour zoomer (et déplacent la vue).
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        rotateSpeed={0.9}
        zoomSpeed={0.9}
        panSpeed={0.8}
        screenSpacePanning
      />
    </>
  );
}

/* ----------------------------- Pièces ----------------------------- */

const NEON_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const NEON_FRAGMENT = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uRim;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, 2.2);
    vec3 color = mix(uBase, uRim, rim) * (0.85 + rim * 1.1);
    float alpha = clamp(0.32 + rim * 0.75, 0.0, 1.0) * uOpacity;
    gl_FragColor = vec4(color, alpha);
  }
`;

function createNeonMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color() },
      uRim: { value: new THREE.Color() },
      uOpacity: { value: 1 },
    },
    vertexShader: NEON_VERTEX,
    fragmentShader: NEON_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

interface PartMeshProps {
  part: Part;
  index: number;
  offset: THREE.Vector3 | null;
  explode: React.RefObject<number>;
  settings: ViewerSettings;
  focused: boolean;
  dimmed: boolean;
  detail: ViewerQuality;
  onSelect(): void;
}

function PartMesh({ part, index, offset, explode, settings, focused, dimmed, detail, onSelect }: PartMeshProps) {
  const group = useRef<THREE.Group>(null);
  // Moins de facettes à l'écran sur appareil modeste (les exports GLB/STL gardent le plein détail).
  const geometry = useMemo(() => createPartGeometry(part, detail), [part, detail]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const base = useMemo(() => new THREE.Vector3(part.position.x, part.position.y, part.position.z), [part]);
  const rotation = useMemo(() => partRotation(part), [part]);
  const color = settings.colorOverride ?? part.color;
  const kind = settings.materialOverride ?? part.material;
  const neon = settings.mode === "neon";

  const neonMaterial = useMemo(createNeonMaterial, []);
  useEffect(() => () => neonMaterial.dispose(), [neonMaterial]);

  const rimColor = useMemo(
    () => new THREE.Color(color).lerp(new THREE.Color(NEON_RIMS[index % NEON_RIMS.length]), 0.7),
    [color, index],
  );

  useEffect(() => {
    neonMaterial.uniforms.uBase.value.set(color).lerp(new THREE.Color("#1c2378"), 0.55);
    neonMaterial.uniforms.uRim.value.copy(rimColor).offsetHSL(0, 0, focused ? 0.15 : 0.05);
    neonMaterial.uniforms.uOpacity.value = dimmed ? 0.18 : 1;
    neonMaterial.wireframe = settings.wireframe;
  }, [neonMaterial, color, rimColor, dimmed, focused, settings.wireframe]);

  useFrame(() => {
    if (!group.current) return;
    group.current.position.copy(base);
    if (offset) group.current.position.addScaledVector(offset, explode.current ?? 0);
  });

  const preset = MATERIAL_PRESETS[kind];
  const edgeColor = dimmed ? "#4b4fa6" : `#${rimColor.clone().offsetHSL(0, 0.1, 0.12).getHexString()}`;

  return (
    <group ref={group} position={base} rotation={rotation}>
      <mesh
        key={`${neon ? "neon" : "real"}-${geometry.uuid}`}
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        {neon ? (
          <primitive object={neonMaterial} attach="material" />
        ) : (
          <meshPhysicalMaterial
            color={color}
            metalness={preset.metalness}
            roughness={preset.roughness}
            // Vernis léger sur le plastique et la céramique : reflets plus réalistes.
            clearcoat={kind === "plastic" || kind === "ceramic" ? 0.35 : 0}
            clearcoatRoughness={0.35}
            envMapIntensity={kind === "metal" ? 1.3 : 1}
            transparent={dimmed || preset.opacity < 1}
            opacity={dimmed ? 0.2 : preset.opacity}
            wireframe={settings.wireframe}
            emissive={focused ? "#5b6ee1" : "#000000"}
            emissiveIntensity={focused ? 0.35 : 0}
          />
        )}
        {neon && !settings.wireframe && <Edges threshold={20} color={edgeColor} />}
      </mesh>
    </group>
  );
}

/* ------------------------ Maillage externe ------------------------ */

function GlbModel({ url, box }: { url: string; box: THREE.Box3 }) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => {
    const clone = scene.clone(true);
    const own = new THREE.Box3().setFromObject(clone);
    const ownSize = own.getSize(new THREE.Vector3());
    const target = box.getSize(new THREE.Vector3());
    const factor = Math.max(target.x, target.y, target.z) / Math.max(ownSize.x, ownSize.y, ownSize.z, 1e-6);
    clone.scale.multiplyScalar(factor);
    const scaled = new THREE.Box3().setFromObject(clone);
    const center = scaled.getCenter(new THREE.Vector3());
    const goal = box.getCenter(new THREE.Vector3());
    clone.position.add(new THREE.Vector3(goal.x - center.x, -scaled.min.y, goal.z - center.z));
    return clone;
  }, [scene, box]);
  return <primitive object={object} />;
}

/* --------------------------- Capture PNG -------------------------- */

function compositePng(source: HTMLCanvasElement, stops: string[]): Promise<Blob | null> {
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  const gradient = ctx.createLinearGradient(0, 0, out.width, out.height);
  stops.forEach((c, i) => gradient.addColorStop(i / Math.max(stops.length - 1, 1), c));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);
  return new Promise((resolve) => out.toBlob(resolve, "image/png"));
}
