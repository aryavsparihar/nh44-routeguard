// The OpenAPI document must list every route under app/api/v1 with the same
// access and rate limit the route uses, and every example must be valid
// input. CI runs this, so a new route without docs fails the build
// (BUILD_PROMPT section 6).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { OPERATIONS } from "./operations";
import { buildOpenApi, errorsFor } from "./spec";

vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => null,
}));

type Found = { method: string; path: string; access: string; rateLimit: string | null; file: string };

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

// "app/api/v1/reports/[id]/route.ts" → "/api/v1/reports/{id}"
function apiPath(file: string): string {
  return `/${file.replace(/^app\//, "").replace(/\/route\.ts$/, "")}`.replace(/\[([^\]]+)\]/g, "{$1}");
}

const HANDLER =
  /export const (GET|POST|PATCH|DELETE|PUT)\s*=\s*withApi(?:<[^>]*>)?\(\s*\{\s*access:\s*("public"|"signed-in"|\[[^\]]*\])(?:,\s*rateLimit:\s*"(\w+)")?/g;

function routesInCode(): Found[] {
  return routeFiles("app/api/v1").flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return [...source.matchAll(HANDLER)].map((m) => ({
      method: m[1].toLowerCase(),
      path: apiPath(file),
      access: m[2].replace(/\s+/g, ""),
      rateLimit: m[3] ?? null,
      file,
    }));
  });
}

// '"public"', '"signed-in"' or the sorted role list, for comparing.
const accessOf = (a: (typeof OPERATIONS)[number]["access"] | string) => {
  if (typeof a === "string" && !a.startsWith("[")) return a.startsWith('"') ? a : JSON.stringify(a);
  const roles: string[] = typeof a === "string" ? JSON.parse(a) : [...a];
  return JSON.stringify(roles.sort());
};

describe("OpenAPI coverage", () => {
  const code = routesInCode();

  it("finds the route handlers", () => {
    expect(code.length).toBeGreaterThan(30);
  });

  it("documents every route method under app/api/v1, and nothing else", () => {
    const inCode = code.map((r) => `${r.method} ${r.path}`).sort();
    const inSpec = OPERATIONS.map((o) => `${o.method} ${o.path}`).sort();
    expect(inSpec).toEqual(inCode);
  });

  it("states the same access and rate limit as the route", () => {
    for (const route of code) {
      const op = OPERATIONS.find((o) => o.method === route.method && o.path === route.path)!;
      expect(accessOf(op.access), `${route.method} ${route.path}`).toBe(accessOf(route.access));
      expect(op.rateLimit ?? null, `${route.method} ${route.path}`).toBe(route.rateLimit);
    }
  });

  it("marks the routes without an Origin check, and only those", () => {
    const NO_ORIGIN = /export const (POST|PATCH|DELETE|PUT)\s*=\s*withApi(?:<[^>]*>)?\(\s*\{[^}]*checkOrigin:\s*false/g;
    const inCode = routeFiles("app/api/v1")
      .flatMap((file) => [...readFileSync(file, "utf8").matchAll(NO_ORIGIN)].map((m) => `${m[1].toLowerCase()} ${apiPath(file)}`))
      .sort();
    const inSpec = OPERATIONS.filter((o) => o.checkOrigin === false).map((o) => `${o.method} ${o.path}`).sort();
    expect(inSpec).toEqual(inCode);
    expect(inCode).toEqual(["post /api/v1/internal/jobs/run"]);
  });

  it("has a request example the route's own schema accepts", () => {
    // The examples' times are on 26 Nov 2026; some schemas compare with now.
    vi.useFakeTimers({ now: new Date("2026-11-26T10:00:00Z"), toFake: ["Date"] });
    for (const op of OPERATIONS) {
      if (op.body) {
        expect(op.bodyExample, `${op.method} ${op.path}`).toBeDefined();
        const result = op.body.safeParse(op.bodyExample);
        expect(result.success, `${op.method} ${op.path}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
      }
    }
    vi.useRealTimers();
  });

  it("has a success answer for every operation, with an example unless it has no JSON body", () => {
    for (const op of OPERATIONS) {
      const answers = Object.entries(op.success);
      expect(answers.length, `${op.method} ${op.path}`).toBeGreaterThan(0);
      for (const [status, answer] of answers) {
        const noBody = status === "204" || status === "304" || answer.contentType === "image/webp" || op.path.endsWith("openapi.json");
        if (!noBody) expect(answer.example, `${op.method} ${op.path} ${status}`).toBeDefined();
      }
    }
  });

  it("lists 401 for every signed-in endpoint, 403 for role-limited ones and 429 for limited ones", () => {
    for (const op of OPERATIONS) {
      const errors = errorsFor(op);
      if (op.access !== "public") expect(errors[401], op.path).toBeDefined();
      if (Array.isArray(op.access)) expect(errors[403], op.path).toBeDefined();
      if (op.rateLimit) expect(errors[429], op.path).toBeDefined();
      if (op.body || op.multipart) expect(errors[422], op.path).toBeDefined();
      if (op.query) expect(errors[400], op.path).toBeDefined();
      if (op.params) expect(errors[404], op.path).toBeDefined();
    }
  });
});

describe("the OpenAPI document", () => {
  const doc = buildOpenApi("test") as {
    openapi: string;
    paths: Record<string, Record<string, { operationId: string; responses: Record<string, { content?: Record<string, { example?: unknown }> }> }>>;
  };

  it("is OpenAPI 3.1 with unique operation ids", () => {
    expect(doc.openapi).toBe("3.1.0");
    const ids = Object.values(doc.paths).flatMap((p) => Object.values(p).map((o) => o.operationId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every error answer a problem+json example", () => {
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        for (const [status, answer] of Object.entries(op.responses)) {
          if (Number(status) < 400) continue;
          const example = answer.content?.["application/problem+json"]?.example as { status?: number } | undefined;
          expect(example?.status, `${method} ${path} ${status}`).toBe(Number(status));
        }
      }
    }
  });

  it("only points at schemas it defines", () => {
    const text = JSON.stringify(doc);
    const defined = Object.keys((doc as unknown as { components: { schemas: object } }).components.schemas);
    for (const m of text.matchAll(/"#\/components\/schemas\/([^"]+)"/g)) expect(defined).toContain(m[1]);
  });

  it("carries the advisory disclaimer", () => {
    expect(JSON.stringify(doc)).toContain("advisory and not an official police service");
  });
});

describe("GET /api/v1/openapi.json and /api/docs", () => {
  const noParams = { params: Promise.resolve({}) };
  const get = (path: string) => new NextRequest(`http://localhost:3000${path}`, { headers: { host: "localhost:3000" } });

  it("serves the document at both usual paths", async () => {
    const { GET } = await import("@/app/api/v1/openapi.json/route");
    const { GET: alias } = await import("@/app/api/openapi.json/route");
    for (const handler of [GET, alias]) {
      const res = await handler(get("/api/v1/openapi.json"), noParams);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");
      expect((await res.json()).openapi).toBe("3.1.0");
    }
  });

  it("serves Swagger UI from our own files", async () => {
    const { GET } = await import("@/app/api/docs/route");
    const res = await GET(get("/api/docs"), noParams);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toMatch(/src="\/vendor\/swagger-ui-[\d.]+\/swagger-ui-bundle\.js"/);
    expect(html).not.toMatch(/<script[^>]+src="https?:/);
    expect(html).not.toMatch(/<link[^>]+href="https?:/);
    expect(html).toContain("not an official police service");
  });
});
