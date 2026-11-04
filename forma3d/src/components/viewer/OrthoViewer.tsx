"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Edges, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Design, Part } from "@/lib/design/schema";
import { MATERIAL_PRESETS, SCENE_SCALE, computeDesignBounds, createPartGeometry, partRotation } from "@/lib/three/geometry";

export type OrthoSide = "top" | "front" | "right";

/** Direction de la caméra pour chaque vue (le haut de l'écran reste Y, sauf vue de dessus : -Z). */
const VIEW: Record<OrthoSide, { dir: [number, number, number]; up: [number, number, number] }> = {
  top: { dir: [0, 1, 0], up: [0, 0, -1] },
  front: { dir: [0, 0, 1], up: [0, 1, 0] },
  right: { dir: [1, 0, 0], up: [0, 1, 0] },
};

/**
 * Vue orthographique légère (dessus, face, droite) pour l'affichage 2 ou 4 vues de l'éditeur :
 * pas d'éclairage d'environnement, rendu seulement quand quelque chose change.
 */
export default function OrthoViewer({
  design,
  side,
  selection,
  hiddenIds,
  showGrid,
  showAxes,
  onSelect,
}: {
  design: Design;
  side: OrthoSide;
  selection: string | null;
  hiddenIds: string[];
  showGrid: boolean;
  showAxes: boolean;
  onSelect(id: string | null): void;
}) {
  return (
    <Canvas
      orthographic
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 10], zoom: 100, near: 0.01, far: 500 }}
      onPointerMissed={() => onSelect(null)}
      className="!touch-none select-none"
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={0.8} />
      <OrthoScene design={design} side={side} selection={selection} hiddenIds={hiddenIds} showGrid={showGrid} showAxes={showAxes} onSelect={onSelect} />
    </Canvas>
  );
}

function OrthoScene({
  design,
  side,
  selection,
  hiddenIds,
  showGrid,
  showAxes,
  onSelect,
}: {
  design: Design;
  side: OrthoSide;
  selection: string | null;
  hiddenIds: string[];
  showGrid: boolean;
  showAxes: boolean;
  onSelect(id: string | null): void;
}) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const bounds = useMemo(() => computeDesignBounds(design), [design]);
  const fitKey = `${design.title}|${design.model.parts.length}|${side}|${size.width}x${size.height}`;

  useEffect(() => {
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3()).multiplyScalar(SCENE_SCALE);
    const extent = bounds.getSize(new THREE.Vector3()).multiplyScalar(SCENE_SCALE);
    const { dir, up } = VIEW[side];
    const w = side === "right" ? extent.z : extent.x;
    const h = side === "top" ? extent.z : extent.y;
    const ortho = camera as THREE.OrthographicCamera;
    ortho.up.set(...up);
    ortho.position.copy(center).add(new THREE.Vector3(...dir).multiplyScalar(Math.max(extent.length(), 1) * 3));
    ortho.zoom = Math.min(size.width / Math.max(w, 0.01), size.height / Math.max(h, 0.01)) * 0.7;
    ortho.lookAt(center);
    ortho.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(center);
      controls.current.update();
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => {
    invalidate();
  }, [invalidate, design, selection, hiddenIds, showGrid, showAxes]);

  const gridRotation: [number, number, number] = side === "top" ? [0, 0, 0] : side === "front" ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2];
  const extent = bounds.getSize(new THREE.Vector3()).multiplyScalar(SCENE_SCALE);
  return (
    <>
      <group scale={SCENE_SCALE}>
        {design.model.parts.map((part) =>
          hiddenIds.includes(part.id) ? null : (
            <FlatPart key={part.id} part={part} selected={selection === part.id} dimmed={selection !== null && selection !== part.id} onSelect={() => onSelect(part.id)} />
          ),
        )}
      </group>
      {showGrid && (
        <Grid
          rotation={gridRotation}
          position={side === "top" ? [0, -0.001, 0] : side === "front" ? [0, 0, -Math.max(extent.z, 0.1)] : [-Math.max(extent.x, 0.1), 0, 0]}
          infiniteGrid
          cellSize={0.1}
          sectionSize={0.5}
          cellThickness={0.5}
          sectionThickness={1}
          cellColor="#5b6290"
          sectionColor="#8b93c9"
          fadeDistance={30}
        />
      )}
      {showAxes && <axesHelper args={[Math.max(extent.length(), 0.3)]} />}
      <OrbitControls ref={controls} makeDefault enableRotate={false} enableDamping={false} screenSpacePanning touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }} mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }} />
    </>
  );
}

function FlatPart({ part, selected, dimmed, onSelect }: { part: Part; selected: boolean; dimmed: boolean; onSelect(): void }) {
  const geometry = useMemo(() => createPartGeometry(part, "low"), [part]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const preset = MATERIAL_PRESETS[part.material];
  return (
    <mesh
      geometry={geometry}
      position={[part.position.x, part.position.y, part.position.z]}
      rotation={partRotation(part)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <meshStandardMaterial
        color={part.color}
        metalness={preset.metalness * 0.5}
        roughness={0.7}
        transparent={dimmed || preset.opacity < 1}
        opacity={dimmed ? 0.3 : preset.opacity}
        emissive={selected ? "#2f6bff" : "#000000"}
        emissiveIntensity={selected ? 0.45 : 0}
      />
      <Edges threshold={20} color={selected ? "#ffffff" : "#0b0c12"} />
    </mesh>
  );
}
