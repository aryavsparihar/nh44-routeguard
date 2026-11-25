"use client";

// Shrinks a report photo before it is sent or queued (BUILD_PROMPT section
// 13: about 300 KB). Longest side at most the server's max_side_px, then
// JPEG at falling quality until it fits. Drawing to a canvas also drops the
// photo's EXIF data (GPS, camera) on the phone; the server strips it again.
// If the browser can't read the image, the original is used as it is.
import rules from "@/config/report-rules.json";

export const TARGET_BYTES = 300 * 1024;
const QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42];

export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function compressPhoto(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap === "undefined" || typeof document === "undefined") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }
  let maxSide = rules.photo.max_side_px;
  let best: Blob | null = null;
  // Smaller sides only if the lowest quality is still too big.
  for (let round = 0; round < 3; round++) {
    const size = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    for (const q of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", q));
      if (!blob) continue;
      best = blob;
      if (blob.size <= TARGET_BYTES) {
        bitmap.close();
        return blob;
      }
    }
    maxSide = Math.round(maxSide * 0.75);
  }
  bitmap.close();
  return best && best.size < file.size ? best : file;
}
