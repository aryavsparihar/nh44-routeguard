import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { newUuid } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newUuid", () => {
  it("uses crypto.randomUUID when the page has it", () => {
    expect(newUuid({ getRandomValues: () => new Uint8Array(16), randomUUID: () => "from-randomUUID" })).toBe("from-randomUUID");
  });

  it("builds a version-4 UUID from random bytes on a plain-http page", () => {
    // Like a phone at http://192.168.x.x: getRandomValues but no randomUUID.
    const http = { getRandomValues: <T extends ArrayBufferView | null>(a: T) => webcrypto.getRandomValues(a as never) as T };
    const ids = Array.from({ length: 200 }, () => newUuid(http));
    for (const id of ids) expect(id).toMatch(V4);
    expect(new Set(ids).size).toBe(200);
  });

  it("sets the version and variant bits whatever the bytes are", () => {
    expect(newUuid({ getRandomValues: <T,>(a: T) => (a as Uint8Array).fill(0xff) as T })).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(newUuid({ getRandomValues: <T,>(a: T) => (a as Uint8Array).fill(0) as T })).toBe("00000000-0000-4000-8000-000000000000");
  });
});
