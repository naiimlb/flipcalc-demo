import * as THREE from "three";
import type { Design } from "./design/schema";
import { buildDesignGroup, disposeGroup } from "./three/geometry";
import { exportUsdz } from "./three/export";

/**
 * « Voir chez moi » : l'objet à taille réelle dans la pièce.
 * - iPhone / iPad : AR Quick Look (fichier USDZ généré dans le navigateur) ;
 * - Android : WebXR (Chrome + ARCore), l'objet se pose d'un toucher sur le sol détecté ;
 * - sinon : non disponible (le bouton n'est pas affiché).
 */
export { detectAr, type ArMode } from "./ar-detect";

/** AR Quick Look : un lien rel="ar" vers le USDZ, avec une image enfant (exigée par Safari). */
export async function openQuickLook(design: Design): Promise<void> {
  const usdz = await exportUsdz(design);
  const url = URL.createObjectURL(new Blob([usdz as BlobPart], { type: "model/vnd.usdz+zip" }));
  const anchor = document.createElement("a");
  anchor.setAttribute("rel", "ar");
  // Taille réelle : on interdit le redimensionnement par pincement.
  anchor.href = `${url}#allowsContentScaling=0`;
  anchor.appendChild(document.createElement("img"));
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Session WebXR « immersive-ar » : réticule sur le sol, un toucher pose l'objet (en mètres, donc à taille réelle). */
export async function startWebXr(design: Design, overlay: HTMLElement, onEnd: () => void): Promise<() => void> {
  if (!navigator.xr) throw new Error("WebXR indisponible.");
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: overlay },
  });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");
  renderer.domElement.style.display = "none";
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#bbbbff", 2.2));
  const sun = new THREE.DirectionalLight("#ffffff", 1.2);
  sun.position.set(0.5, 1, 0.25);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);

  // L'objet, en mètres, centré sur son pied.
  const model = buildDesignGroup(design, 0.001);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  model.position.set(-center.x, -box.min.y, -center.z);
  holder.add(model);
  holder.visible = false;
  scene.add(holder);

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.06, 0.08, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: "#7b5ce6" }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  await renderer.xr.setSession(session);
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitSource = await session.requestHitTestSource?.({ space: viewerSpace });

  const onSelect = () => {
    if (!reticle.visible) return;
    holder.position.setFromMatrixPosition(reticle.matrix);
    holder.visible = true;
  };
  session.addEventListener("select", onSelect);

  renderer.setAnimationLoop((_time, frame) => {
    if (frame && hitSource) {
      const refSpace = renderer.xr.getReferenceSpace();
      const hits = frame.getHitTestResults(hitSource);
      const pose = hits[0] && refSpace ? hits[0].getPose(refSpace) : null;
      reticle.visible = Boolean(pose);
      if (pose) reticle.matrix.fromArray(pose.transform.matrix);
    }
    renderer.render(scene, camera);
  });

  let ended = false;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    renderer.setAnimationLoop(null);
    session.removeEventListener("select", onSelect);
    disposeGroup(model);
    reticle.geometry.dispose();
    (reticle.material as THREE.Material).dispose();
    renderer.dispose();
    renderer.domElement.remove();
    onEnd();
  };
  session.addEventListener("end", cleanup);
  return () => {
    session.end().catch(() => cleanup());
  };
}
