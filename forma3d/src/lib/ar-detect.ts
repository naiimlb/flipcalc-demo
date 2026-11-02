/** Détection de la réalité augmentée (module léger, sans Three.js). */
export type ArMode = "quicklook" | "webxr";

export async function detectAr(): Promise<ArMode | null> {
  if (typeof window === "undefined") return null;
  try {
    const anchor = document.createElement("a");
    if (anchor.relList?.supports?.("ar")) return "quicklook";
  } catch {
    // relList absent : pas d'AR Quick Look
  }
  const xr = navigator.xr;
  if (xr) {
    try {
      if (await xr.isSessionSupported("immersive-ar")) return "webxr";
    } catch {
      // WebXR refusé (contexte non sécurisé, réglages)
    }
  }
  return null;
}

