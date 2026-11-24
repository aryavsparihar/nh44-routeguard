import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { DELETE, GET, POST } from "./route";

const context = { params: Promise.resolve({ path: ["nope"] }) };

describe("unknown /api/* paths", () => {
  it.each([
    ["GET", GET],
    ["POST", POST],
    ["DELETE", DELETE],
  ])("%s answers a JSON 404", async (method, handler) => {
    const req = new NextRequest("http://localhost:3000/api/nope", { method });
    const res = await handler(req, context);

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect((await res.json()).instance).toBe("/api/nope");
  });
});
