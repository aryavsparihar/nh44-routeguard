import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

describe("proxy.ts without Clerk keys", () => {
  it("lets requests straight through and never loads Clerk's middleware", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    vi.stubEnv("CLERK_SECRET_KEY", "");
    const clerkMiddleware = vi.fn();
    vi.doMock("@clerk/nextjs/server", () => ({ clerkMiddleware }));

    const { default: proxy } = await import("@/proxy");
    const res = await (proxy as (req: NextRequest) => Response | Promise<Response>)(
      new NextRequest("http://localhost:3000/api/v1/health"),
    );

    expect(clerkMiddleware).not.toHaveBeenCalled();
    expect(res.headers.get("x-middleware-next")).toBe("1"); // NextResponse.next()
    vi.unstubAllEnvs();
  });
});

describe("proxy.ts with Clerk keys", () => {
  it("asks Clerk to protect only the signed-in pages", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_fake");
    type Handler = (auth: { protect: () => Promise<void> }, req: NextRequest) => Promise<void>;
    let handler: Handler | undefined;
    vi.doMock("@clerk/nextjs/server", () => ({
      clerkMiddleware: (h: Handler) => {
        handler = h;
        return () => NextResponse.next();
      },
    }));

    await import("@/proxy");
    const protect = vi.fn(async () => {});
    for (const path of ["/admin/users", "/board", "/", "/api/v1/me", "/administrator"]) {
      await handler!({ protect }, new NextRequest(`http://localhost:3000${path}`));
    }

    expect(protect).toHaveBeenCalledTimes(2); // /admin/users and /board
    vi.unstubAllEnvs();
    vi.doUnmock("@clerk/nextjs/server");
  });
});
