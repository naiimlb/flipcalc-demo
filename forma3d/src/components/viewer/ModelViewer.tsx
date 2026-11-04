"use client";

import { Suspense, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, Environment, Grid, Html, Lightformer, Line, OrbitControls, PerformanceMonitor, TransformControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Design, Part } from "@/lib/design/schema";
import { FINISH_PRESETS } from "@/lib/design/finishes";
import {
  MATERIAL_PRESETS,
  SCENE_SCALE,
  computeDesignBounds,
  computeExplodeOffsets,
  createPartGeometry,
  partRotation,
} from "@/lib/three/geometry";
import { detectQuality, type ViewerQuality } from "./quality";
import { VIEWER_BACKGROUNDS, type LightingPreset, type ViewerHandle, type ViewerSettings } from "./settings";

export type { RenderMode, ViewerHandle, ViewerSettings } from "./settings";

/** Couleur de fond sombre (luminance relative < 0,4) : sert à choisir la teinte du quadrillage. */
function isDarkColor(hex: string): boolean {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.4;
}

const NEON_RIMS = ["#ff5fd8", "#5fd6ff", "#b59bff", "#ff8fc7"];
const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

type Vec = { x: number; y: number; z: number };
export type TransformMode = "translate" | "rotate" | "scale";
/** Résultat d'un glissement de poignée (en mm et degrés), appliqué ensuite à la conception. */
export interface TransformChange {
  position: Vec;
  rotation: Vec;
  scale: Vec;
  delta: Vec;
}

interface ViewerProps {
  design: Design | null;
  settings: ViewerSettings;
  focusId: string | null;
  /** `additive` : Maj ou ⌘ enfoncé (sélection multiple). */
  onFocusChange(id: string | null, additive?: boolean): void;
  /** Sélection multiple (éditeur) : toutes ces pièces sont mises en avant. */
  selectedIds?: string[];
  /** Poignées de transformation sur la pièce sélectionnée (éditeur). */
  transformMode?: TransformMode | null;
  /** Magnétisme : pas de déplacement (mm), d'angle (degrés) et d'échelle. */
  snap?: { translate: number; rotate: number; scale: number } | null;
  uniformScale?: boolean;
  onTransform?(id: string, change: TransformChange): void;
  /** Outil de mesure : chaque paire de points touchés sur le modèle donne une distance. */
  measure?: boolean;
  /** Couleurs du fond (capture PNG, vidéo 360°). */
  backgroundStops?: string[];
  /** Maillage externe (fournisseur text-to-3D), affiché à la place des primitives. */
  meshUrl?: string | null;
  handleRef?: Ref<ViewerHandle>;
  /** Pièces masquées dans l'éditeur (arborescence). */
  hiddenIds?: string[];
  /** Repère X / Y / Z à l'origine. */
  showAxes?: boolean;
  /** Règle : cotes de l'encombrement (largeur, profondeur, hauteur). */
  showRuler?: boolean;
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
      onPointerMissed={() => !props.measure && props.onFocusChange(null)}
      className="!touch-none select-none"
    >
      <PerformanceMonitor flipflops={2} onDecline={() => setQuality("low")} />
      <Scene {...props} quality={quality} />
    </Canvas>
  );
}

function Scene({
  design,
  settings,
  focusId,
  onFocusChange,
  meshUrl,
  handleRef,
  quality,
  hiddenIds,
  showAxes = false,
  showRuler = false,
  selectedIds,
  transformMode = null,
  snap = null,
  uniformScale = false,
  onTransform,
  measure = false,
  backgroundStops,
}: ViewerProps & { quality: ViewerQuality }) {
  const { camera, gl, scene, size, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const explode = useRef(0);
  // Objets 3D des pièces (pour accrocher les poignées) et pièce en cours de glissement.
  const objects = useRef(new Map<string, THREE.Group>());
  const dragging = useRef<string | null>(null);
  const dragStart = useRef<{ position: THREE.Vector3; rotation: THREE.Euler } | null>(null);
  const [gizmoTarget, setGizmoTarget] = useState<THREE.Group | null>(null);
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
  const selected = useMemo(() => new Set(selectedIds ?? (focusId ? [focusId] : [])), [selectedIds, focusId]);

  // Une modification arrive (poignée relâchée, champ saisi…) : la pièce reprend la position de la conception.
  useEffect(() => {
    dragging.current = null;
  }, [design]);
  useEffect(() => {
    if (!measure) setMeasurePoints([]);
  }, [measure]);
  const focusPart = focusId ? design?.model.parts.find((p) => p.id === focusId) ?? null : null;
  const gizmoOn = Boolean(transformMode && focusPart && !focusPart.locked && !meshUrl && !hiddenIds?.includes(focusPart.id) && !settings.exploded && !measure);
  // Avant la prochaine image : les poignées ne restent jamais accrochées à une pièce retirée de la scène.
  useLayoutEffect(() => {
    const obj = gizmoOn && focusId ? objects.current.get(focusId) ?? null : null;
    setGizmoTarget(obj?.parent ? obj : null);
  }, [gizmoOn, focusId, design, hiddenIds]);

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

  const fit = useCallback(
    (target: THREE.Sphere = sphere) => {
    const persp = camera as THREE.PerspectiveCamera;
    const fov = (persp.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(size.height, 1);
    const radius = Math.max(target.radius, 0.05);
    const distance = (radius / Math.sin(fov / 2)) * (aspect < 1 ? 1 / aspect : 1) * 1.08;
    const direction = new THREE.Vector3(0.95, 0.6, 1.3).normalize();
    camera.position.copy(target.center).addScaledVector(direction, distance);
    persp.near = distance / 100;
    persp.far = distance * 30;
    persp.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(target.center);
      controls.current.minDistance = Math.min(radius * 0.6, sphere.radius * 0.3);
      controls.current.maxDistance = Math.max(distance * 4, sphere.radius * 12);
      controls.current.update();
    }
    invalidate();
    },
    [camera, size.width, size.height, sphere, invalidate],
  );

  // Recadrage automatique seulement quand on change de projet (pas à chaque retouche d'une pièce).
  const fitKey = design ? `${design.title}|${design.model.parts.length}` : "vide";
  const fitKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (fitKeyRef.current === fitKey && fitKeyRef.current !== null) return;
    fitKeyRef.current = fitKey;
    fit();
  }, [fit, fitKey]);

  const frame = useCallback(
    (partId: string | null) => {
      const part = partId ? design?.model.parts.find((p) => p.id === partId) : null;
      if (!part) return fit();
      const geometry = createPartGeometry(part, "low");
      geometry.computeBoundingSphere();
      const local = geometry.boundingSphere ?? new THREE.Sphere();
      geometry.dispose();
      const center = new THREE.Vector3(part.position.x, part.position.y, part.position.z).multiplyScalar(SCENE_SCALE);
      fit(new THREE.Sphere(center, Math.max(local.radius * SCENE_SCALE, 0.02)));
    },
    [design, fit],
  );

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
  const fitRef = useRef<(target?: THREE.Sphere) => void>(fit);
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
          fitRef.current(undefined);
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
  }, [invalidate, design, settings, focusId, meshUrl, quality, hiddenIds, showAxes, showRuler, selected, measurePoints, gizmoTarget]);

  useImperativeHandle(
    handleRef,
    () => ({
      zoomIn: () => dolly(0.8),
      zoomOut: () => dolly(1.25),
      resetView: () => fit(),
      frame,
      // Capture de qualité : rendu temporaire en haute résolution (2 à 3 fois la taille affichée).
      capturePng: async () => {
        const previous = gl.getPixelRatio();
        const hd = Math.min(3, Math.max(2, window.devicePixelRatio * 2));
        gl.setPixelRatio(hd);
        gl.setSize(size.width, size.height, false);
        gl.render(scene, camera);
        const blob = await compositePng(gl.domElement, backgroundStops ?? VIEWER_BACKGROUNDS[settings.mode]);
        gl.setPixelRatio(previous);
        gl.setSize(size.width, size.height, false);
        invalidate();
        return blob;
      },
      // Vidéo 360° : la caméra fait un tour complet autour du modèle pendant l'enregistrement du canevas.
      recordTurntable: async (seconds: number) => {
        if (typeof MediaRecorder === "undefined" || typeof gl.domElement.captureStream !== "function") return null;
        const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
        const stream = gl.domElement.captureStream(30);
        const recorder = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 8_000_000 } : undefined);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        const stopped = new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
        });
        const ctrl = controls.current;
        const target = ctrl ? ctrl.target.clone() : sphere.center.clone();
        const offset = camera.position.clone().sub(target);
        const previousBackground = scene.background;
        const previousAuto = ctrl?.autoRotate ?? false;
        const stops = backgroundStops ?? VIEWER_BACKGROUNDS[settings.mode];
        scene.background = new THREE.Color(stops[1] ?? stops[0]);
        if (ctrl) ctrl.autoRotate = false;
        recorder.start(250);
        await new Promise<void>((resolve) => {
          const t0 = performance.now();
          const tick = () => {
            const t = Math.min(1, (performance.now() - t0) / (Math.max(2, seconds) * 1000));
            const q = new THREE.Quaternion().setFromAxisAngle(UP, t * Math.PI * 2);
            camera.position.copy(target).add(offset.clone().applyQuaternion(q));
            camera.lookAt(target);
            ctrl?.update();
            invalidate();
            if (t < 1) requestAnimationFrame(tick);
            else resolve();
          };
          requestAnimationFrame(tick);
        });
        recorder.stop();
        await stopped;
        stream.getTracks().forEach((track) => track.stop());
        scene.background = previousBackground;
        if (ctrl) ctrl.autoRotate = previousAuto;
        invalidate();
        return chunks.length ? new Blob(chunks, { type: type || "video/webm" }) : null;
      },
    }),
    [dolly, fit, frame, gl, scene, camera, settings.mode, size.width, size.height, invalidate, backgroundStops, sphere],
  );

  // Glissement d'une poignée : échelle uniforme si demandé, puis report dans la conception au relâchement.
  const onGizmoDown = useCallback(() => {
    const obj = gizmoTarget;
    if (!obj || !focusId) return;
    dragging.current = focusId;
    dragStart.current = { position: obj.position.clone(), rotation: obj.rotation.clone() };
  }, [gizmoTarget, focusId]);
  const onGizmoChange = useCallback(() => {
    const obj = gizmoTarget;
    if (!obj || transformMode !== "scale") return;
    const s = obj.scale;
    const revolution = focusPart && ["cylinder", "cone", "capsule", "torus", "tube"].includes(focusPart.shape);
    if (uniformScale || focusPart?.shape === "sphere") {
      const u = [s.x, s.y, s.z].reduce((a, b) => (Math.abs(b - 1) > Math.abs(a - 1) ? b : a), 1);
      s.set(u, u, u);
    } else if (revolution) {
      const r = Math.abs(s.x - 1) >= Math.abs(s.z - 1) ? s.x : s.z;
      s.set(r, s.y, r);
    }
  }, [gizmoTarget, transformMode, uniformScale, focusPart]);
  const onGizmoUp = useCallback(() => {
    const obj = gizmoTarget;
    const start = dragStart.current;
    if (!obj || !focusId || !start || !onTransform) return;
    const r = (n: number) => Math.round(n * 100) / 100;
    const change: TransformChange = {
      position: { x: r(obj.position.x), y: r(obj.position.y), z: r(obj.position.z) },
      rotation: { x: r(obj.rotation.x / DEG), y: r(obj.rotation.y / DEG), z: r(obj.rotation.z / DEG) },
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      delta: { x: r(obj.position.x - start.position.x), y: r(obj.position.y - start.position.y), z: r(obj.position.z - start.position.z) },
    };
    obj.scale.set(1, 1, 1);
    dragStart.current = null;
    // La pièce garde sa nouvelle place jusqu'à l'arrivée de la conception modifiée.
    dragging.current = `${focusId}:attente`;
    onTransform(focusId, change);
  }, [gizmoTarget, focusId, onTransform]);

  useFrame((_, delta) => {
    const target = settings.exploded ? 1 : 0;
    if (explode.current === target) return;
    explode.current = THREE.MathUtils.damp(explode.current, target, 5, delta);
    if (Math.abs(explode.current - target) < 0.002) explode.current = target;
    invalidate(); // l'animation continue jusqu'à l'arrivée, puis le rendu se fige
  });

  const real = settings.mode === "real";
  // Plan de travail quadrillé : filets gris neutres, plus clairs sur fond sombre.
  const bgDark = isDarkColor((backgroundStops ?? VIEWER_BACKGROUNDS[settings.mode])[0]);

  return (
    <>
      <Lights preset={real ? settings.lighting ?? "studio" : "studio"} real={real} quality={quality} />

      {meshUrl ? (
        <Suspense fallback={null}>
          <GlbModel url={meshUrl} box={sceneBox} />
        </Suspense>
      ) : (
        design && (
          <group scale={SCENE_SCALE}>
            {design.model.parts.map((part, index) =>
              hiddenIds?.includes(part.id) ? null : (
              <PartMesh
                key={part.id}
                part={part}
                index={index}
                offset={offsets.get(part.id) ?? null}
                explode={explode}
                settings={settings}
                focused={selected.has(part.id)}
                dimmed={selected.size > 0 && !selected.has(part.id)}
                detail={quality}
                onSelect={(additive) => onFocusChange(part.id, additive)}
                onMeasure={measure ? (point) => setMeasurePoints((pts) => [...pts, point]) : undefined}
                register={(obj) => {
                  if (obj) objects.current.set(part.id, obj);
                  else objects.current.delete(part.id);
                }}
                dragging={dragging}
              />
              ),
            )}
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
          cellColor={real ? (bgDark ? "#3a3d44" : "#c9ccd3") : "#8d9bff"}
          sectionColor={real ? (bgDark ? "#555963" : "#a7abb4") : "#d2c2ff"}
          fadeDistance={Math.max(sphere.radius * 14, 4)}
          fadeStrength={1.5}
        />
      )}
      {showAxes && <axesHelper args={[Math.max(sphere.radius * 1.4, 0.2)]} position={[0, 0.0008, 0]} />}
      {showRuler && bounds && !bounds.isEmpty() && <Ruler bounds={bounds} />}
      {measurePoints.length > 0 && <Measurements points={measurePoints} dot={Math.max(sphere.radius * 0.018, 0.003)} />}
      {gizmoTarget && transformMode && (
        <TransformControls
          object={gizmoTarget}
          mode={transformMode}
          space={transformMode === "translate" ? "world" : "local"}
          translationSnap={snap ? snap.translate : null}
          rotationSnap={snap ? snap.rotate * DEG : null}
          scaleSnap={snap ? snap.scale : null}
          size={quality === "low" ? 1.1 : 0.9}
          onMouseDown={onGizmoDown}
          onObjectChange={onGizmoChange}
          onMouseUp={onGizmoUp}
        />
      )}
      {real && settings.shadows !== false && (
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
  onSelect(additive: boolean): void;
  onMeasure?: (point: THREE.Vector3) => void;
  register?: (obj: THREE.Group | null) => void;
  dragging?: React.RefObject<string | null>;
}

function PartMesh({ part, index, offset, explode, settings, focused, dimmed, detail, onSelect, onMeasure, register, dragging }: PartMeshProps) {
  const group = useRef<THREE.Group>(null);
  // Enregistrée avant les effets du parent, qui y accroche les poignées dans la même passe.
  useLayoutEffect(() => {
    register?.(group.current);
    return () => register?.(null);
  }, [register]);
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
    // Pendant le glissement d'une poignée, c'est elle qui place la pièce.
    if (dragging?.current && dragging.current.split(":")[0] === part.id) return;
    group.current.position.copy(base);
    if (offset) group.current.position.addScaledVector(offset, explode.current ?? 0);
  });

  // Matière de la bibliothèque (PLA, PETG, résine…) : aspect plus fin que la matière d'export.
  const finish = !settings.materialOverride && part.finish ? FINISH_PRESETS[part.finish] : null;
  const preset = finish ?? MATERIAL_PRESETS[kind];
  const edgeColor = dimmed ? "#4b4fa6" : `#${rimColor.clone().offsetHSL(0, 0.1, 0.12).getHexString()}`;

  return (
    <group ref={group} position={base} rotation={rotation}>
      <mesh
        key={`${neon ? "neon" : "real"}-${geometry.uuid}`}
        geometry={geometry}
        onClick={(e) => {
          if (onMeasure) {
            e.stopPropagation();
            onMeasure(e.point.clone());
            return;
          }
          if (part.locked) return;
          e.stopPropagation();
          onSelect(e.shiftKey || e.metaKey || e.ctrlKey);
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
            clearcoat={finish ? finish.clearcoat : kind === "plastic" || kind === "ceramic" ? 0.35 : 0}
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

/* ----------------------------- Éclairage ----------------------------- */

/**
 * Préréglages d'éclairage : studio (boîtes à lumière blanches), néon (contre-jours bleu électrique et corail),
 * jour (ciel et soleil). Le rendu néon (matière lumineuse) garde un éclairage neutre.
 */
function Lights({ preset, real, quality }: { preset: LightingPreset; real: boolean; quality: ViewerQuality }) {
  const res = quality === "low" ? 32 : 128;
  if (!real || preset === "studio") {
    return (
      <>
        <ambientLight intensity={real ? 0.22 : 0.8} />
        <hemisphereLight args={["#f4f5f7", "#3a3c42", real ? 0.45 : 0.3]} />
        <directionalLight position={[4, 6, 5]} intensity={real ? 1.6 : 0.6} />
        {real && <directionalLight position={[-5, 3, 2]} intensity={0.55} color="#f2f4f8" />}
        {real && <directionalLight position={[0, 4, -6]} intensity={0.9} color="#ffffff" />}
        <Environment key="studio" resolution={res}>
          <Lightformer form="rect" intensity={2.4} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} color="#ffffff" />
          <Lightformer intensity={2} position={[0, 5, -5]} scale={[10, 5, 1]} color="#ffffff" />
          <Lightformer intensity={1.2} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#ffffff" />
          <Lightformer intensity={1.2} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#ffffff" />
          <Lightformer form="ring" intensity={1.5} position={[2, 2, 6]} scale={2} color="#ffffff" />
        </Environment>
      </>
    );
  }
  if (preset === "neon") {
    return (
      <>
        <ambientLight intensity={0.1} />
        <directionalLight position={[2, 5, 6]} intensity={0.7} />
        <directionalLight position={[-6, 2, -3]} intensity={3.2} color="#2f6bff" />
        <directionalLight position={[6, 1.5, -3]} intensity={3} color="#ff6b4a" />
        <directionalLight position={[0, 6, -6]} intensity={1.1} color="#8b5cf6" />
        <Environment key="neon" resolution={res}>
          <Lightformer intensity={3} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#2f6bff" />
          <Lightformer intensity={3} position={[5, 1, 0]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#ff6b4a" />
          <Lightformer intensity={0.8} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} color="#ffffff" />
        </Environment>
      </>
    );
  }
  return (
    <>
      <ambientLight intensity={0.35} />
      <hemisphereLight args={["#cfe8ff", "#8a7458", 0.9]} />
      <directionalLight position={[6, 9, 4]} intensity={2.4} color="#fff1d6" />
      <Environment key="jour" resolution={res}>
        <Lightformer form="rect" intensity={3} position={[0, 7, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} color="#eaf4ff" />
        <Lightformer intensity={1.6} position={[0, 2, 6]} scale={[12, 4, 1]} color="#fff6e5" />
        <Lightformer intensity={1} position={[0, -2, 0]} rotation-x={-Math.PI / 2} scale={[12, 12, 1]} color="#b8a48a" />
      </Environment>
    </>
  );
}

/* ----------------------------- Mesure ----------------------------- */

/** Mesures prises sur le modèle : chaque paire de points donne une distance en millimètres. */
function Measurements({ points, dot }: { points: THREE.Vector3[]; dot: number }) {
  const pairs: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i + 1 < points.length; i += 2) pairs.push([points[i], points[i + 1]]);
  return (
    <group>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[dot, 12, 12]} />
          <meshBasicMaterial color="#ffb020" depthTest={false} />
        </mesh>
      ))}
      {pairs.map(([a, b], i) => {
        const mm = a.distanceTo(b) / SCENE_SCALE;
        const mid = a.clone().add(b).multiplyScalar(0.5);
        return (
          <group key={i}>
            <Line points={[a, b]} color="#ffb020" lineWidth={2.5} />
            <Html position={mid} center zIndexRange={[30, 0]}>
              <span className="pointer-events-none whitespace-nowrap rounded-md bg-[#ffb020] px-2 py-0.5 text-xs font-bold tabular-nums text-night">
                {mm < 100 ? mm.toFixed(1) : Math.round(mm)} mm
              </span>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

/* ----------------------------- Règle ----------------------------- */

/** Cotes de l'encombrement (en millimètres) le long des arêtes de la boîte englobante. */
function Ruler({ bounds }: { bounds: THREE.Box3 }) {
  const min = bounds.min.clone().multiplyScalar(SCENE_SCALE);
  const max = bounds.max.clone().multiplyScalar(SCENE_SCALE);
  const size = bounds.getSize(new THREE.Vector3());
  const gap = Math.max(size.x, size.y, size.z) * SCENE_SCALE * 0.08;
  const fmt = (mm: number) => `${Math.round(mm)} mm`;
  const lines: { from: [number, number, number]; to: [number, number, number]; label: string; color: string }[] = [
    { from: [min.x, 0.001, max.z + gap], to: [max.x, 0.001, max.z + gap], label: fmt(size.x), color: "#ff5a5a" },
    { from: [max.x + gap, 0.001, min.z], to: [max.x + gap, 0.001, max.z], label: fmt(size.z), color: "#3d7aff" },
    { from: [min.x - gap, min.y, max.z], to: [min.x - gap, max.y, max.z], label: fmt(size.y), color: "#3ddc84" },
  ];
  return (
    <group>
      {lines.map((l) => {
        const mid: [number, number, number] = [(l.from[0] + l.to[0]) / 2, (l.from[1] + l.to[1]) / 2, (l.from[2] + l.to[2]) / 2];
        return (
          <group key={l.label + l.color}>
            <Line points={[l.from, l.to]} color={l.color} lineWidth={2} />
            <Html position={mid} center zIndexRange={[20, 0]}>
              <span className="pointer-events-none whitespace-nowrap rounded-md bg-night/85 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">{l.label}</span>
            </Html>
          </group>
        );
      })}
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
