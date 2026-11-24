import { NextRequest } from "next/server";
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
