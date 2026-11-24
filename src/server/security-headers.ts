// Security headers for every response (BUILD_PROMPT section 16).
// next.config.ts sends them with headers(), so they apply to pages, API
// routes and static files alike.
//
// The Content-Security-Policy has no nonce. Next 16's CSP guide says nonces
// need every page rendered per request and don't work with Partial
// Prerendering, which we use (cacheComponents). So scripts are allowed from
// our own origin and inline (Next's own bootstrap scripts are inline), and
// from Clerk, and nowhere else. docs/decisions.md (A5) explains the
// trade-off.

type Env = Record<string, string | undefined>;
export type Header = { key: string; value: string };

// Clerk's publishable key is "pk_test_" or "pk_live_" + base64(host + "$"),
// where host is the Clerk frontend API for our instance. Decoding it gives
// the exact host to allow, for development and production alike. Anything
// that doesn't decode cleanly gives null (nothing is allowed).
export function clerkFrontendHost(publishableKey: string | undefined): string | null {
  const match = publishableKey?.match(/^pk_(?:test|live)_([A-Za-z0-9+/=_-]+)$/);
  if (!match) return null;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  if (!decoded.endsWith("$")) return null;
  const host = decoded.slice(0, -1);
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
}

// "https://abc.supabase.co" → "abc.supabase.co", or null.
function supabaseHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.host : null;
  } catch {
    return null;
  }
}

const CLERK_BOT_PROTECTION = "https://*.protect.clerk.com";
// Clerk's bot protection probes the same hosts on other ports (seen in the
// browser: 8443, 18443, 2082, 992), so connections allow any port there.
const CLERK_BOT_PROTECTION_ANY_PORT = "https://*.protect.clerk.com:*";
const CLOUDFLARE_CHALLENGE = "https://challenges.cloudflare.com"; // Clerk's sign-up captcha
const MAP_TILES = "https://tiles.openfreemap.org"; // MapLibre base map (WP-C)

export function contentSecurityPolicy(env: Env): string {
  const isDev = env.NODE_ENV === "development";
  const clerk = clerkFrontendHost(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const supabase = supabaseHost(env.NEXT_PUBLIC_SUPABASE_URL);

  const directives: Record<string, (string | null | false)[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      // React uses eval for better error messages in development only.
      isDev && "'unsafe-eval'",
      clerk && `https://${clerk}`,
      CLOUDFLARE_CHALLENGE,
      CLERK_BOT_PROTECTION,
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://img.clerk.com"],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      clerk && `https://${clerk}`,
      supabase && `https://${supabase}`,
      supabase && `wss://${supabase}`, // Realtime (live agent board)
      MAP_TILES,
      CLERK_BOT_PROTECTION_ANY_PORT,
    ],
    "frame-src": ["'self'", CLOUDFLARE_CHALLENGE, CLERK_BOT_PROTECTION],
    "worker-src": ["'self'", "blob:"], // MapLibre runs in a blob: worker
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`,
  );
  // On plain http://localhost this would break loading, so production only.
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

export function securityHeaders(env: Env): Header[] {
  // CSP_REPORT_ONLY=1 sends the same policy as report-only: the browser logs
  // violations in the console but blocks nothing. Only for emergencies.
  const cspHeader =
    env.CSP_REPORT_ONLY === "1" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

  return [
    { key: cspHeader, value: contentSecurityPolicy(env) },
    // Browsers only honour this over https, so it's harmless on localhost.
    // No "preload": that's a promise for a domain we don't own yet.
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Old browsers; new ones use frame-ancestors 'none' above.
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Camera (report photos) and location (report GPS, driver sharing) for
    // our own pages only; nothing else.
    {
      key: "Permissions-Policy",
      value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
    },
  ];
}
