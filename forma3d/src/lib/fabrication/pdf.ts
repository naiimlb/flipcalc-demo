/**
 * PDF minimal d'une page contenant une image JPEG pleine page (plan coté).
 * Écrit à la main pour éviter une bibliothèque de plusieurs centaines de Ko.
 */

const encoder = new TextEncoder();

/** @param pageWidthPt largeur de la page en points (A4 paysage : 842 × 595). */
export function jpegToPdf(jpeg: Uint8Array, imageWidth: number, imageHeight: number, pageWidthPt = 842, pageHeightPt = 595, title = "Plan"): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string | (string | Uint8Array)[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    for (const p of Array.isArray(body) ? body : [body]) push(p);
    push("\nendobj\n");
  };
  // Titre en ASCII (les accents sont retirés pour rester dans l'encodage PDFDocEncoding de base).
  const safeTitle = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[()\\]/g, "")
    .slice(0, 100);
  const content = `q ${pageWidthPt} 0 0 ${pageHeightPt} 0 0 cm /Im0 Do Q`;

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  object(4, [
    `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    "\nendstream",
  ]);
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  object(6, `<< /Title (${safeTitle}) /Producer (Forma3D) >>`);

  const xref = length;
  push(`xref\n0 7\n0000000000 65535 f \n`);
  for (let i = 1; i <= 6; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
