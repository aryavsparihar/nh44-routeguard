import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger, hashUserId } from "./logger";
import { getRequestId } from "./request-id";

// Collects log lines in memory instead of printing them.
function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const log = createLogger(stream);
  log.level = "info";
  return { log, lines };
}

describe("logger redaction", () => {
  it("hides tokens, cookies and phone numbers", () => {
    const { log, lines } = captureLogger();
    log.info({
      headers: { authorization: "Bearer abc.def.ghi", cookie: "__session=xyz" },
      user: { phone: "+919876543210", token: "tok_123" },
    });

    const out = lines.join("");
    expect(out).not.toContain("abc.def.ghi");
    expect(out).not.toContain("__session=xyz");
    expect(out).not.toContain("+919876543210");
    expect(out).not.toContain("tok_123");
    expect(out).toContain("[Redacted]");
  });

  it("writes JSON with an ISO time and a text level", () => {
    const { log, lines } = captureLogger();
    log.info({ status: 200 }, "request");
    const line = JSON.parse(lines[0]);
    expect(line.level).toBe("info");
    expect(new Date(line.time).toISOString()).toBe(line.time);
    expect(line.pid).toBeUndefined();
  });
});

describe("hashUserId", () => {
  it("gives 12 hex characters, the same for the same user", () => {
    const a = hashUserId("user_2abc");
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(hashUserId("user_2abc")).toBe(a);
    expect(hashUserId("user_2abd")).not.toBe(a);
    expect(a).not.toContain("user");
  });
});

describe("getRequestId", () => {
  it("reuses a valid incoming UUID", () => {
    const id = "3F1C3C1E-2B9A-4B7E-9A51-6F0D2F6B7A10";
    expect(getRequestId(new Headers({ "x-request-id": id }))).toBe(id.toLowerCase());
  });

  it.each(["", "abc", "x".repeat(500), "3f1c3c1e-2b9a-4b7e-9a51-6f0d2f6b7a10 fake log line"])(
    "replaces %j with a fresh UUID",
    (incoming) => {
      const id = getRequestId(new Headers(incoming ? { "x-request-id": incoming } : {}));
      expect(id).not.toBe(incoming);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});
