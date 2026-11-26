import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test reports.
    "coverage/**",
    "test-results/**",
    "playwright-report/**",
    // Local Python virtualenvs and build output: not our code, not in git.
    ".venv*/**",
    "jobs/.venv/**",
    "scripts/round2/.build/**",
    // Copied from node_modules before dev/build (scripts/ui/copy-maplibre-worker.mjs).
    "public/vendor/**",
    "team-guides/**",
    // Round 2 deliverables kept as they were submitted (a Figma plugin and the
    // static Round 2 site). They are not part of the app and are frozen, so we
    // don't lint them; editing them would change what was handed in.
    "docs/ux/figma-plugin/code.js",
    "scripts/round2/web/shared.js",
  ]),
]);

export default eslintConfig;
