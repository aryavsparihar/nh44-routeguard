import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

const context = { params: Promise.resolve({}) };

describe("GET /api/v1/health", () => {
  it("answers 200 ok with a request id", async () => {
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/health"), context);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: "ok" } });
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("POST answers a JSON 405 with Allow", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/health", { method: "POST" });
    const res = await POST(req, context);

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD");
  });
});
