import { describe, expect, it } from "vitest";
import { clerkFrontendHost, contentSecurityPolicy, securityHeaders } from "./security-headers";

// A made-up Clerk instance host, encoded the way Clerk builds publishable keys.
const FAKE_HOST = "example-instance-12.clerk.accounts.dev";
const FAKE_KEY = `pk_test_${Buffer.from(`${FAKE_HOST}$`).toString("base64")}`;

const PROD = {
  NODE_ENV: "production",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: FAKE_KEY,
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
};

function directive(csp: string, name: string): string {
  return csp.split("; ").find((part) => part.startsWith(`${name} `)) ?? "";
}

describe("clerkFrontendHost", () => {
  it("decodes the host from a publishable key", () => {
    expect(clerkFrontendHost(FAKE_KEY)).toBe(FAKE_HOST);
  });

  it.each([undefined, "", "pk_test_", "sk_test_abc", "pk_test_bm90LWEtaG9zdA==", "pk_test_!!!"])(
    "gives null for %s",
    (key) => expect(clerkFrontendHost(key)).toBeNull(),
  );
});

describe("contentSecurityPolicy", () => {
  it("allows scripts only from us, inline, and Clerk", () => {
    const scripts = directive(contentSecurityPolicy(PROD), "script-src");
    expect(scripts).toContain("'self'");
    expect(scripts).toContain(`https://${FAKE_HOST}`);
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts).not.toMatch(/(^| )https?:( |$)/); // no "any https site"
  });

  it("adds unsafe-eval only in development, and drops upgrade-insecure-requests there", () => {
    const dev = contentSecurityPolicy({ ...PROD, NODE_ENV: "development" });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy(PROD)).toContain("upgrade-insecure-requests");
  });

  it("drops only upgrade-insecure-requests with LOCAL_HTTP=1 (a phone on the same Wi-Fi)", () => {
    const local = contentSecurityPolicy({ ...PROD, LOCAL_HTTP: "1" });
    expect(local).not.toContain("upgrade-insecure-requests");
    expect(local).toBe(contentSecurityPolicy(PROD).replace("; upgrade-insecure-requests", ""));
    expect(contentSecurityPolicy({ ...PROD, LOCAL_HTTP: "true" })).toContain("upgrade-insecure-requests");
  });

  it("lets the browser talk to our Supabase project over https and wss", () => {
    const connect = directive(contentSecurityPolicy(PROD), "connect-src");
    expect(connect).toContain("https://abcdefgh.supabase.co");
    expect(connect).toContain("wss://abcdefgh.supabase.co");
  });

  it("lets Clerk's bot protection probe its hosts on any port", () => {
    expect(directive(contentSecurityPolicy(PROD), "connect-src")).toContain("https://*.protect.clerk.com:*");
  });

  it("leaves Clerk and Supabase out when there are no keys", () => {
    const csp = contentSecurityPolicy({ NODE_ENV: "production" });
    expect(csp).not.toContain("clerk.accounts.dev");
    expect(csp).not.toContain("supabase.co");
    expect(csp).not.toContain("null");
  });

  it("always blocks plugins, framing by other sites and <base> hijacking", () => {
    for (const env of [PROD, { NODE_ENV: "production" }]) {
      const csp = contentSecurityPolicy(env);
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    }
  });
});

describe("securityHeaders", () => {
  it("sends the full set", () => {
    const names = securityHeaders(PROD).map((h) => h.key);
    expect(names).toEqual([
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Cross-Origin-Opener-Policy",
      "Permissions-Policy",
    ]);
  });

  it("switches to report-only with CSP_REPORT_ONLY=1", () => {
    const first = securityHeaders({ ...PROD, CSP_REPORT_ONLY: "1" })[0];
    expect(first.key).toBe("Content-Security-Policy-Report-Only");
    expect(first.value).toBe(contentSecurityPolicy(PROD));
  });
});
