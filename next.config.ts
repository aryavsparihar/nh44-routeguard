import type { NextConfig } from "next";
import { securityHeaders } from "./src/server/security-headers";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone for the Docker image
  // (Dockerfile). Run it with `node .next/standalone/server.js`.
  output: "standalone",
  // The commit SHA, set by the deploy workflow. Lets Next notice when a
  // browser still runs the previous version during a rolling deploy and
  // reload the page instead of breaking. Unset locally.
  deploymentId: process.env.DEPLOYMENT_VERSION || undefined,
  cacheComponents: true,
  partialPrefetching: true,
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Security headers on every response (src/server/security-headers.ts).
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env) }];
  },
};

export default nextConfig;
