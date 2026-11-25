// The API docs page (/api/docs) uses Swagger UI from our own site, not a CDN
// (BUILD_PROMPT section 6): this copies its script and stylesheet into
// public/vendor/ with the version in the folder name. Runs before `next dev`
// and `next build`, like copy-maplibre-worker.mjs.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const from = join(root, "node_modules/swagger-ui-dist");
const { version } = JSON.parse(readFileSync(join(from, "package.json"), "utf8"));
const vendor = join(root, "public/vendor");
const name = `swagger-ui-${version}`;

mkdirSync(join(vendor, name), { recursive: true });
for (const old of readdirSync(vendor)) {
  if (old.startsWith("swagger-ui-") && old !== name) rmSync(join(vendor, old), { recursive: true, force: true });
}
for (const file of ["swagger-ui-bundle.js", "swagger-ui.css", "LICENSE"]) {
  copyFileSync(join(from, file), join(vendor, name, file));
}
console.log(`copied Swagger UI to public/vendor/${name}`);
