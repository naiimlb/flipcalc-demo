export interface ImagePayload {
  mediaType: "image/jpeg";
  data: string;
  previewUrl: string;
}

/** Réduit l'image (1024 px max, JPEG) avant l'envoi : requêtes légères, coût IA maîtrisé. */
export async function prepareImage(file: File): Promise<ImagePayload> {
  if (!file.type.startsWith("image/")) throw new Error("Choisissez une image.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Image trop lourde (15 Mo max).");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image illisible.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { mediaType: "image/jpeg", data: dataUrl.split(",")[1] ?? "", previewUrl: dataUrl };
}
