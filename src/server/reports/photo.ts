import "server-only";
import sharp from "sharp";
import { REPORT_RULES } from "./rules";

// Report photos (BUILD_PROMPT section 10): JPEG, PNG or WebP by their first
// bytes (never by the file name or the type the phone claims), at most 5 MB.
// Every photo is re-encoded as WebP with no metadata: EXIF (GPS position,
// phone model, time) is dropped, the picture is turned upright first, and
// the long side is cut to 1600 px.
export type PhotoKind = "jpeg" | "png" | "webp";

export function sniffImage(bytes: Uint8Array): PhotoKind | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...b.subarray(8, 12)) === "WEBP") return "webp";
  return null;
}

export class PhotoError extends Error {}

// Pixel limit: a 5 MB file can still claim to be gigapixels ("decompression
// bomb"); sharp refuses anything over this before decoding.
const MAX_INPUT_PIXELS = 40_000_000;

export async function cleanPhoto(bytes: Uint8Array): Promise<Buffer> {
  if (bytes.byteLength > REPORT_RULES.photo.max_bytes) throw new PhotoError("too_big");
  if (!sniffImage(bytes)) throw new PhotoError("not_an_image");
  const side = REPORT_RULES.photo.max_side_px;
  try {
    return await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      .rotate() // apply the EXIF orientation, then the EXIF goes
      .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(); // sharp writes no metadata unless asked (withMetadata)
  } catch {
    throw new PhotoError("unreadable");
  }
}
