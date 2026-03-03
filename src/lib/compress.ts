/**
 * Client-side file compression for uploads.
 * Accepts files up to 15 MB and compresses images/PDFs to fit under 4 MB.
 * PDFs are rendered to page images via pdf.js, then JPEG-compressed.
 */

const UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB (Vercel serverless body limit)
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB user-facing limit

/**
 * Komprimiert eine Datei falls nötig, damit sie unter das Upload-Limit passt.
 * - Bilder: Canvas verkleinert + JPEG-komprimiert
 * - PDFs: Seiten werden zu Bildern gerendert, dann komprimiert
 * - Text unter 4 MB: durchgereicht
 */
export async function compressForUpload(file: File): Promise<File> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Datei zu groß (max. 15 MB)");
  }

  // Already small enough → pass through
  if (file.size <= UPLOAD_LIMIT) return file;

  // Images → canvas compression
  if (file.type.startsWith("image/")) {
    return compressImage(file);
  }

  // PDFs → render pages to images, then compress
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return compressPdf(file);
  }

  throw new Error("Text-Dateien müssen unter 4 MB sein.");
}

// ---------------------------------------------------------------------------
// Image compression
// ---------------------------------------------------------------------------

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let maxDim = 2400;
  let quality = 0.82;

  for (let attempt = 0; attempt < 8; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await canvasToBlob(canvas, quality);

    if (blob.size <= UPLOAD_LIMIT) {
      bitmap.close();
      return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
        type: "image/jpeg",
      });
    }

    quality = Math.max(0.3, quality - 0.08);
    maxDim = Math.max(800, maxDim - 300);
  }

  bitmap.close();
  throw new Error("Bild konnte nicht genug komprimiert werden");
}

// ---------------------------------------------------------------------------
// PDF compression (render pages → combine → JPEG)
// ---------------------------------------------------------------------------

async function compressPdf(file: File): Promise<File> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  // Render each page to a canvas
  const TARGET_WIDTH = 1400;
  const pageCanvases: HTMLCanvasElement[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const scale = TARGET_WIDTH / vp.width;
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(scaled.width);
    canvas.height = Math.round(scaled.height);

    const renderTask = page.render({
      canvasContext: canvas.getContext("2d")!,
      viewport: scaled,
    });
    await renderTask.promise;

    pageCanvases.push(canvas);
  }

  // Stack pages into one tall canvas (max ~16000px for browser compat)
  const MAX_HEIGHT = 16000;
  const totalHeight = pageCanvases.reduce((h, c) => h + c.height, 0);
  const combinedHeight = Math.min(totalHeight, MAX_HEIGHT);

  const combined = document.createElement("canvas");
  combined.width = TARGET_WIDTH;
  combined.height = combinedHeight;
  const ctx = combined.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, combined.width, combined.height);

  let y = 0;
  for (const pc of pageCanvases) {
    if (y + pc.height > combinedHeight) break;
    ctx.drawImage(pc, 0, y);
    y += pc.height;
  }

  // Compress the combined image, iterating quality/scale down
  let quality = 0.75;
  let shrink = 1;

  for (let attempt = 0; attempt < 8; attempt++) {
    let canvas = combined;

    // If we need to shrink, create a smaller canvas
    if (shrink < 1) {
      const w = Math.round(combined.width * shrink);
      const h = Math.round(combined.height * shrink);
      canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const sCtx = canvas.getContext("2d")!;
      sCtx.drawImage(combined, 0, 0, w, h);
    }

    const blob = await canvasToBlob(canvas, quality);

    if (blob.size <= UPLOAD_LIMIT) {
      return new File([blob], file.name.replace(/\.pdf$/i, ".jpg"), {
        type: "image/jpeg",
      });
    }

    quality = Math.max(0.25, quality - 0.07);
    shrink = Math.max(0.4, shrink - 0.08);
  }

  throw new Error("PDF konnte nicht genug komprimiert werden");
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", quality)
  );
}
