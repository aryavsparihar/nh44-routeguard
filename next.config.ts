import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
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
  // A plain 404 for addresses that match no route (app/global-not-found.tsx);
  // needed because the root layout sits in the [locale] folder.
  experimental: { globalNotFound: true },
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
    return [
      { source: "/:path*", headers: securityHeaders(process.env) },
      // The service worker (public/sw.js): the browser must always check
      // for a new copy, or an old worker could stay for a day.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

// next-intl: translations for server components (src/i18n/request.ts).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
