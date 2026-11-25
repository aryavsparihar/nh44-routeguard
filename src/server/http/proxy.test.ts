import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

type Proxy = (req: NextRequest) => Response | Promise<Response>;
const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3000${path}`, { headers });

// Where next-intl sent the request inside the server (the browser URL stays as it was).
const rewrittenTo = (res: Response) => {
  const target = res.headers.get("x-middleware-rewrite");
  return target ? new URL(target).pathname : null;
};

describe("proxy.ts without Clerk keys", () => {
  it("lets API requests straight through and never loads Clerk's middleware", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    const clerkMiddleware = vi.fn();
    vi.doMock("@clerk/nextjs/server", () => ({ clerkMiddleware }));

    const { default: proxy } = await import("@/proxy");
    const res = await (proxy as Proxy)(req("/api/v1/health"));

    expect(clerkMiddleware).not.toHaveBeenCalled();
    expect(res.headers.get("x-middleware-next")).toBe("1"); // NextResponse.next()
    expect(rewrittenTo(res)).toBeNull();
    vi.unstubAllEnvs();
  });

  it("serves pages in the language from the rg_lang cookie, without changing the URL", async () => {
    const { default: proxy } = await import("@/proxy");
    expect(rewrittenTo(await (proxy as Proxy)(req("/privacy", { cookie: "rg_lang=ur" })))).toBe("/ur/privacy");
    expect(rewrittenTo(await (proxy as Proxy)(req("/", { cookie: "rg_lang=hi" })))).toBe("/hi");
  });

  it("uses the phone's language on a first visit, and English when it's unknown", async () => {
    const { default: proxy } = await import("@/proxy");
    expect(rewrittenTo(await (proxy as Proxy)(req("/", { "accept-language": "hi-IN,hi;q=0.9" })))).toBe("/hi");
    expect(rewrittenTo(await (proxy as Proxy)(req("/", { "accept-language": "fr-FR" })))).toBe("/en");
    expect(rewrittenTo(await (proxy as Proxy)(req("/", { cookie: "rg_lang=xx" })))).toBe("/en");
  });
});

describe("proxy.ts with Clerk keys", () => {
  it("asks Clerk to protect only the signed-in pages, then picks the language", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fake");
    type Handler = (auth: { protect: () => Promise<void> }, req: NextRequest) => Promise<Response>;
    let handler: Handler | undefined;
    vi.doMock("@clerk/nextjs/server", () => ({
      clerkMiddleware: (h: Handler) => {
        handler = h;
        return () => NextResponse.next();
      },
    }));

    await import("@/proxy");
    const protect = vi.fn(async () => {});
    const results: Record<string, Response> = {};
    for (const path of ["/admin/users", "/board", "/", "/api/v1/me", "/administrator"]) {
      results[path] = await handler!({ protect }, req(path, { cookie: "rg_lang=ur" }));
    }

    expect(protect).toHaveBeenCalledTimes(2); // /admin/users and /board
    expect(rewrittenTo(results["/board"])).toBe("/ur/board");
    expect(rewrittenTo(results["/api/v1/me"])).toBeNull();
    vi.unstubAllEnvs();
    vi.doUnmock("@clerk/nextjs/server");
  });
});
