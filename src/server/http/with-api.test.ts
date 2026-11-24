import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { readJson } from "./body";
import type { Caller } from "./caller";
import { ConflictError } from "./errors";
import { created, ok } from "./responses";
import { notAllowed, withApi } from "./with-api";

// Swap the real caller lookup for one each test controls.
let fakeCaller: Caller | null = null;
vi.mock("./caller", () => ({ getCaller: async () => fakeCaller }));

const noParams = { params: Promise.resolve({}) };

function request(method = "GET", init: { headers?: Record<string, string>; body?: string } = {}) {
  return new NextRequest("http://localhost:3000/api/v1/thing?phone=123", {
    method,
    headers: { host: "localhost:3000", ...init.headers },
    body: init.body,
  });
}

beforeEach(() => {
  fakeCaller = null;
});

describe("withApi", () => {
  it("runs the handler and adds X-Request-Id", async () => {
    const GET = withApi({ access: "public" }, async () => ok({ hello: "world" }));
    const res = await GET(request(), noParams);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hello: "world" } });
    expect(res.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  it("passes route params to the handler", async () => {
    const GET = withApi<{ id: string }>({ access: "public" }, async ({ params }) => ok(params));
    const res = await GET(request(), { params: Promise.resolve({ id: "42" }) });
    expect(await res.json()).toEqual({ data: { id: "42" } });
  });

  it("401 problem when a signed-in route is called signed out", async () => {
    const GET = withApi({ access: "signed-in" }, async () => ok({}));
    const res = await GET(request(), noParams);

    expect(res.status).toBe(401);
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.request_id).toBe(res.headers.get("X-Request-Id"));
    expect(body.instance).toBe("/api/v1/thing"); // no query string
  });

  it("403 for the wrong role, 200 for the right one", async () => {
    const GET = withApi({ access: ["admin"] }, async () => ok({}));

    fakeCaller = { userId: "user_1", role: "driver" };
    expect((await GET(request(), noParams)).status).toBe(403);

    fakeCaller = { userId: "user_2", role: "admin" };
    const res = await GET(request(), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("403 for a cross-site POST before the handler runs", async () => {
    const handler = vi.fn(async () => ok({}));
    const POST = withApi({ access: "public" }, handler);
    const res = await POST(request("POST", { headers: { origin: "https://evil.example" } }), noParams);

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("maps thrown ApiErrors and validation errors", async () => {
    const schema = z.object({ truck: z.string().min(4) }).strict();
    const POST = withApi({ access: "public" }, async ({ req }) => {
      const body = await readJson(req, schema);
      if (body.truck === "TAKEN") throw new ConflictError("Truck already has an active shipment.");
      return created(body, "/api/v1/shipments/1");
    });
    const send = (body: string) =>
      POST(
        request("POST", {
          headers: { origin: "http://localhost:3000", "content-type": "application/json" },
          body,
        }),
        noParams,
      );

    const good = await send('{"truck":"JK05G7712"}');
    expect(good.status).toBe(201);
    expect(good.headers.get("Location")).toBe("/api/v1/shipments/1");

    expect((await send('{"truck":"TAKEN"}')).status).toBe(409);
    expect((await send('{"truck":"x"}')).status).toBe(422);
    expect((await send("not json")).status).toBe(400);
  });

  it("generic 500 for a bug, with the request id and no internals", async () => {
    const GET = withApi({ access: "public" }, async () => {
      throw new Error("connection to db.internal:5432 refused");
    });
    const res = await GET(request(), noParams);

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("db.internal");
    expect(JSON.parse(text).request_id).toBe(res.headers.get("X-Request-Id"));
  });

  it("keeps a valid incoming request id", async () => {
    const id = "3f1c3c1e-2b9a-4b7e-9a51-6f0d2f6b7a10";
    const GET = withApi({ access: "public" }, async () => ok({}));
    const res = await GET(request("GET", { headers: { "x-request-id": id } }), noParams);
    expect(res.headers.get("X-Request-Id")).toBe(id);
  });
});

describe("notAllowed", () => {
  it("answers 405 problem+json with Allow, adding HEAD next to GET", async () => {
    const handler = notAllowed(["GET"]);
    const res = await handler(request("POST"), noParams);

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD");
    expect(res.headers.get("Content-Type")).toBe("application/problem+json");
  });
});
