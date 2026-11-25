import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pkg from "maplibre-gl/package.json";

// RiskMap.tsx names the copied worker file by version; this fails when
// maplibre-gl is upgraded without updating that name.
describe("MapLibre worker URL", () => {
  it("matches the installed maplibre-gl version", () => {
    const source = readFileSync("src/ui/risk/RiskMap.tsx", "utf8");
    expect(source).toContain(`/vendor/maplibre-gl-worker-${pkg.version}.mjs`);
  });
});
