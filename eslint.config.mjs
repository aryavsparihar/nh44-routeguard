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
    // Local Python virtualenvs and build output: not our code, not in git.
    ".venv*/**",
    "jobs/.venv/**",
    "scripts/round2/.build/**",
    // Copied from node_modules before dev/build (scripts/ui/copy-maplibre-worker.mjs).
    "public/vendor/**",
    "team-guides/**",
  ]),
]);

export default eslintConfig;
