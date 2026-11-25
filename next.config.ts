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
  // `next dev` only: a phone on the same Wi-Fi opens the laptop's private
  // address (the "Network" line npm run dev prints). Next blocks its dev
  // scripts for any address but localhost unless it is listed here, and
  // the page arrives without its map or working buttons. Private ranges
  // only (10/8, 172.16/12, 192.168/16) and .local names; ignored by builds.
  allowedDevOrigins: [
    "10.*.*.*",
    ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
    "192.168.*.*",
    "*.local",
  ],
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
