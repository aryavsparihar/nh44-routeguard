// Every API route must go through withApi() (or notAllowed(), which uses
// it). That is where access is checked, so a route written any other way
// could leak data without anyone noticing. This test reads each route.ts
// under app/api and fails if a handler is exported some other way.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_DIR = join(process.cwd(), "app", "api");
const METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

// Names of the handlers a file exports, and what each one is defined as.
function exportedHandlers(source: string): { method: string; wrappedSafely: boolean }[] {
  const handlers: { method: string; wrappedSafely: boolean }[] = [];
  const isSafe = (name: string) =>
    new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*(?:withApi|notAllowed)\\s*[(<]`).test(source);

  // export const GET = withApi(...)
  for (const match of source.matchAll(/export\s+const\s+([A-Z]+)\s*=/g)) {
    if (METHODS.includes(match[1])) handlers.push({ method: match[1], wrappedSafely: isSafe(match[1]) });
  }
  // export function GET / export async function GET: never allowed
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]+)/g)) {
    if (METHODS.includes(match[1])) handlers.push({ method: match[1], wrappedSafely: false });
  }
  // export { notSupported as POST, ... }
  for (const block of source.matchAll(/export\s*{([^}]*)}/g)) {
    for (const part of block[1].split(",")) {
      const [local, exported = local] = part.trim().split(/\s+as\s+/);
      if (METHODS.includes(exported)) handlers.push({ method: exported, wrappedSafely: isSafe(local) });
    }
  }
  return handlers;
}

const files = routeFiles(API_DIR);

describe("API routes", () => {
  it("finds the route files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [relative(process.cwd(), file), file]))(
    "%s exports only withApi()/notAllowed() handlers",
    (_name, file) => {
      const handlers = exportedHandlers(readFileSync(file, "utf8"));
      expect(handlers.length).toBeGreaterThan(0);
      expect(handlers.filter((h) => !h.wrappedSafely).map((h) => h.method)).toEqual([]);
    },
  );
});

describe("the check itself", () => {
  it("catches a plain exported function", () => {
    expect(exportedHandlers("export async function GET() { return new Response('hi') }")).toEqual([
      { method: "GET", wrappedSafely: false },
    ]);
  });

  it("catches a const that isn't wrapped", () => {
    expect(exportedHandlers("export const POST = async () => new Response('hi');")).toEqual([
      { method: "POST", wrappedSafely: false },
    ]);
  });

  it("accepts withApi with a type argument and re-exports of notAllowed", () => {
    const source = `
      export const PATCH = withApi<{ id: string }>({ access: ["admin"] }, async () => ok(1));
      const notSupported = notAllowed(["PATCH"]);
      export { notSupported as GET, notSupported as POST };`;
    expect(exportedHandlers(source).every((h) => h.wrappedSafely)).toBe(true);
  });
});
