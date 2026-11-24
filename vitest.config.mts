import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Same "@/..." imports as the app (tsconfig paths).
      "@/": root,
      // "server-only" throws outside Next's server build. Tests run server
      // code directly, so they get an empty stand-in instead.
      "server-only": `${root}test/server-only-stub.ts`,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "app/**/*.test.ts"],
  },
});
