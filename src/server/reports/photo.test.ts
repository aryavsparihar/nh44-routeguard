import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cleanPhoto, PhotoError, sniffImage } from "./photo";

// A small JPEG with EXIF (a GPS position and a camera model), made here so
// no real photo is in the repo.
async function jpegWithExif(width = 2400, height = 1200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 110, b: 90 } } })
    .jpeg()
    .withExif({ IFD0: { Make: "TestPhone", Model: "Model X" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "33/1 12/1 0/1" } })
    .toBuffer();
}

describe("sniffImage", () => {
  it("knows JPEG, PNG and WebP by their first bytes", async () => {
    const base = sharp({ create: { width: 4, height: 4, channels: 3, background: "white" } });
    expect(sniffImage(await base.clone().jpeg().toBuffer())).toBe("jpeg");
    expect(sniffImage(await base.clone().png().toBuffer())).toBe("png");
    expect(sniffImage(await base.clone().webp().toBuffer())).toBe("webp");
  });

  it("refuses anything else, whatever it is called", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImage(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // %PDF
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("cleanPhoto", () => {
  it("drops EXIF, cuts the long side to 1600 px and returns WebP", async () => {
    const input = await jpegWithExif();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await cleanPhoto(input);
    const meta = await sharp(out).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
  });

  it("refuses a file that only pretends to be an image", async () => {
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]);
    await expect(cleanPhoto(fake)).rejects.toThrow(PhotoError);
  });

  it("refuses a file over 5 MB before decoding it", async () => {
    await expect(cleanPhoto(new Uint8Array(5 * 1024 * 1024 + 1))).rejects.toThrow("too_big");
  });
});
