// Makes the PNG app icons from public/icons/icon.svg. Run after changing the
// SVG: node scripts/icons/build-icons.mjs
import sharp from "sharp";

const svg = "public/icons/icon.svg";
await sharp(svg).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg).resize(512, 512).png().toFile("public/icons/icon-512.png");
// Maskable: the artwork inside the middle 80 % (the "safe zone"), on the
// brand green, so launchers can crop it to any shape.
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#005f3f" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");
console.log("icons written");
