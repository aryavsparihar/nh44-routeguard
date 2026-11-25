// MapLibre GL 6 runs map work in a Web Worker loaded from its own file
// (maplibre-gl-worker.mjs). Next.js doesn't bundle that file, so we copy it
// into public/vendor/ with the version in the name and tell MapLibre where it
// is (src/ui/risk/RiskMap.tsx). Runs before `next dev` and `next build`.
// Same origin, so the CSP stays worker-src 'self' blob:.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const pkg = JSON.parse(readFileSync(join(root, "node_modules/maplibre-gl/package.json"), "utf8"));
const outDir = join(root, "public/vendor");
const name = `maplibre-gl-worker-${pkg.version}.mjs`;

mkdirSync(outDir, { recursive: true });
for (const old of readdirSync(outDir)) {
  if (old.startsWith("maplibre-gl-worker-") && old !== name) rmSync(join(outDir, old));
}
copyFileSync(join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"), join(outDir, name));
console.log(`copied MapLibre worker to public/vendor/${name}`);
