import { ImageResponse } from "next/og";

export const alt = "Forma3D : décrivez un problème, imprimez la solution en 3D";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image de partage (Open Graph) : sobre, aux couleurs du parcours Simple. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#faf9f7", color: "#1c1b19" }}>
        <div style={{ fontSize: 40, color: "#254ca0", fontWeight: 600 }}>Forma3D</div>
        <div style={{ fontSize: 72, fontWeight: 700, marginTop: 24, lineHeight: 1.1 }}>Décrivez un problème,</div>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>imprimez la solution.</div>
        <div style={{ fontSize: 32, marginTop: 32, color: "#4a4742" }}>Une pièce en 3D conçue par IA, vérifiée, prête pour votre imprimante.</div>
      </div>
    ),
    size,
  );
}
