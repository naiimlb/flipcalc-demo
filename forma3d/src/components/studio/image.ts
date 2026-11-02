export interface ImagePayload {
  mediaType: "image/jpeg";
  data: string;
  previewUrl: string;
}

/** Côté le plus long envoyé à l'IA (au-delà, l'analyse n'est pas meilleure et le coût augmente). */
const MAX_SIDE = 1024;
/** Taille maximale du JPEG en base64 (le serveur refuse au-delà de 2 000 000 caractères). */
const MAX_BASE64 = 1_400_000;

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  // Photo de téléphone : on respecte l'orientation enregistrée par l'appareil (EXIF).
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  } catch {
    // Formats que createImageBitmap ne lit pas partout (HEIC sur iPhone…) : on passe par une balise image.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Format d'image non pris en charge : utilisez une photo JPEG ou PNG.");
    }
  }
}

/** Redimensionne (1024 px max) et compresse (JPEG) la photo avant l'envoi : requêtes légères, coût IA maîtrisé. */
export async function prepareImage(file: File): Promise<ImagePayload> {
  if (file.type && !file.type.startsWith("image/")) throw new Error("Choisissez une image.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Image trop lourde (25 Mo max).");
  const image = await decode(file);
  try {
    let side = MAX_SIDE;
    let quality = 0.85;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, side / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image illisible.");
      ctx.fillStyle = "#ffffff"; // fond blanc pour les PNG transparents
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image.source, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const data = dataUrl.split(",")[1] ?? "";
      if (data.length <= MAX_BASE64) return { mediaType: "image/jpeg", data, previewUrl: dataUrl };
      quality = Math.max(0.55, quality - 0.1);
      side = Math.round(side * 0.85);
    }
    throw new Error("Image trop détaillée : essayez une autre photo.");
  } finally {
    image.close();
  }
}
