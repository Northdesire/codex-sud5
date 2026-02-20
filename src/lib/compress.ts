/**
 * Client-side image compression for file uploads.
 * Accepts files up to 15 MB and compresses images to fit under the upload limit.
 * PDFs and text files are passed through unchanged.
 */

const UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB (Vercel serverless body limit)
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB user-facing limit

/**
 * Komprimiert eine Datei falls nötig, damit sie unter das Upload-Limit passt.
 * - Bilder werden via Canvas verkleinert + JPEG-komprimiert
 * - PDFs/Text unter 4 MB werden durchgereicht
 * - Gibt die (ggf. komprimierte) Datei zurück oder wirft einen Fehler
 */
export async function compressForUpload(file: File): Promise<File> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Datei zu groß (max. 15 MB)");
  }

  // Already small enough → pass through
  if (file.size <= UPLOAD_LIMIT) return file;

  // Only images can be compressed client-side
  if (!file.type.startsWith("image/")) {
    throw new Error(
      "PDF/Text-Dateien müssen unter 4 MB sein. Tipp: Fotografiere die Seiten ab."
    );
  }

  // Load image into a bitmap
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // Try progressively lower quality + resolution until it fits
  let maxDim = 2400;
  let quality = 0.82;

  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });

    if (blob.size <= UPLOAD_LIMIT) {
      bitmap.close();
      const name = file.name.replace(/\.[^.]+$/, ".jpg");
      return new File([blob], name, { type: "image/jpeg" });
    }

    // Reduce quality and resolution for next attempt
    quality = Math.max(0.3, quality - 0.08);
    maxDim = Math.max(800, maxDim - 300);
  }

  bitmap.close();
  throw new Error("Bild konnte nicht genug komprimiert werden");
}
