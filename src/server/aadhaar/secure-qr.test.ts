// The Aadhaar Secure QR checker and POST /api/v1/verify/aadhaar-qr
// (BUILD_PROMPT section 11). QR codes here are made in the test with a fresh
// key, in the same layout as UIDAI's; no real Aadhaar data is used.
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { gzipSync } from "node:zlib";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import certs from "@/config/uidai/certs.json";
import type { Caller } from "@/src/server/http/caller";
import {
  checkSecureQr,
  compareNames,
  MAX_QR_DIGITS,
  pinnedKeys,
  type CertEntry,
  type PinnedKey,
} from "./secure-qr";

function keyPair() {
  return generateKeyPairSync("rsa", { modulusLength: 2048 });
}
const signer = keyPair();
const other = keyPair();
const KEY: PinnedKey = { version: "test-1", key: signer.publicKey, test: true };
const OTHER: PinnedKey = { version: "other", key: other.publicKey, test: false };

function fields(name: string, { versioned = true } = {}) {
  const sep = Buffer.from([255]);
  const text = [
    ...(versioned ? ["V2"] : []),
    "3",
    "4821" + "20261125101500123",
    name,
    "01-01-1990",
    "M",
    "S/O Demo",
    "Jammu",
  ];
  const parts: Buffer[] = [];
  for (const t of text) parts.push(Buffer.from(t, "utf8"), sep);
  // A fake photo that itself contains 255 bytes.
  parts.push(Buffer.from([1, 255, 2, 255, 3]));
  return Buffer.concat(parts);
}

function toDecimal(bytes: Buffer): string {
  return BigInt(`0x${bytes.toString("hex")}`).toString(10);
}

function makeQr(name: string, opts: { key?: KeyObject; versioned?: boolean; tamper?: boolean } = {}) {
  const signed = fields(name, opts);
  const signature = sign("sha256", signed, opts.key ?? signer.privateKey);
  const data = Buffer.concat([signed, signature]);
  if (opts.tamper) data[10] ^= 1;
  return toDecimal(gzipSync(data));
}

describe("checkSecureQr", () => {
  it("verifies a good code whose name matches", () => {
    expect(checkSecureQr(makeQr("Ravi Kumar"), [KEY], "Ravi Kumar")).toEqual({
      verdict: "verified",
      last4: "4821",
      certVersion: "test-1",
      testKey: true,
    });
  });

  it("reads codes without the version field too", () => {
    expect(checkSecureQr(makeQr("Ravi Kumar", { versioned: false }), [KEY], "ravi kumar").verdict).toBe("verified");
  });

  it("reads names in Indian scripts", () => {
    expect(checkSecureQr(makeQr("रवि कुमार"), [KEY], "रवि कुमार").verdict).toBe("verified");
  });

  it("sends a close name (word order, typo) to manual review", () => {
    expect(checkSecureQr(makeQr("Ravi Kumar"), [KEY], "Kumar Ravi").verdict).toBe("manual_review");
    expect(checkSecureQr(makeQr("Ravi Kumar"), [KEY], "Ravi Kumarr").verdict).toBe("manual_review");
  });

  it("rejects a different name, keeping no last 4", () => {
    const r = checkSecureQr(makeQr("Ravi Kumar"), [KEY], "Sunita Devi");
    expect(r).toEqual({ verdict: "rejected", reason: "name", certVersion: "test-1", testKey: true });
    expect(r).not.toHaveProperty("last4");
  });

  it("rejects a tampered byte", () => {
    expect(checkSecureQr(makeQr("Ravi Kumar", { tamper: true }), [KEY], "Ravi Kumar")).toMatchObject({
      verdict: "rejected",
      reason: "signature",
    });
  });

  it("rejects a code signed by a key we have not pinned", () => {
    expect(checkSecureQr(makeQr("Ravi Kumar", { key: other.privateKey }), [KEY], "Ravi Kumar")).toMatchObject({
      verdict: "rejected",
      reason: "signature",
    });
    // With only the other key pinned, our code fails the same way.
    expect(checkSecureQr(makeQr("Ravi Kumar"), [OTHER], "Ravi Kumar").verdict).toBe("rejected");
  });

  it("rejects truncated, non-numeric and oversized input", () => {
    const qr = makeQr("Ravi Kumar");
    expect(checkSecureQr(qr.slice(0, qr.length - 40), [KEY], "Ravi Kumar")).toMatchObject({ reason: "unreadable" });
    expect(checkSecureQr("12ab34", [KEY], "Ravi Kumar")).toMatchObject({ reason: "not_a_number" });
    expect(checkSecureQr("", [KEY], "Ravi Kumar")).toMatchObject({ reason: "not_a_number" });
    expect(checkSecureQr("9".repeat(MAX_QR_DIGITS + 1), [KEY], "Ravi Kumar")).toMatchObject({ reason: "too_long" });
  });

  it("stops a zip bomb without unpacking it", () => {
    const bomb = toDecimal(gzipSync(Buffer.alloc(2 * 1024 * 1024)));
    expect(bomb.length).toBeLessThan(MAX_QR_DIGITS);
    expect(checkSecureQr(bomb, [KEY], "Ravi Kumar")).toMatchObject({ reason: "unreadable" });
  });

  it("rejects a signed block with no name or reference", () => {
    const signed = Buffer.from("V2\xff3\xffabcd", "latin1");
    const data = Buffer.concat([signed, sign("sha256", signed, signer.privateKey)]);
    expect(checkSecureQr(toDecimal(gzipSync(data)), [KEY], "x")).toMatchObject({ reason: "layout" });
  });
});

describe("compareNames", () => {
  it.each([
    ["Ravi Kumar", "ravi  kumar", "same"],
    ["Ravi Kumar.", "Ravi Kumar", "same"],
    ["Ravi Kumar", "Kumar Ravi", "close"],
    ["Ravi Kumar", "", "different"],
    ["Ravi Kumar", "Sunita Devi", "different"],
  ] as const)("%s vs %s → %s", (a, b, want) => {
    expect(compareNames(a, b)).toBe(want);
  });
});

describe("pinnedKeys", () => {
  const entries = certs.certificates as CertEntry[];

  it("loads the demo key only when test keys are allowed", () => {
    expect(pinnedKeys(entries, false).every((k) => !k.test)).toBe(true);
    expect(pinnedKeys(entries, true).some((k) => k.test)).toBe(true);
  });

  it("refuses a certificate whose fingerprint does not match", () => {
    const bad = entries.map((e) => ({ ...e, sha256: "0".repeat(64) }));
    expect(() => pinnedKeys(bad, true)).toThrow(/fingerprint/);
  });
});

// ---- The route ----

let fakeCaller: Caller | null = null;
vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => fakeCaller,
}));
vi.mock("@/src/server/db", () => ({ getDb: async () => ({}) }));
vi.mock("@/src/server/http/rate-limit.store", () => ({
  hitBucket: async () => ({ allowed: true, hits: 1, retryAfterSeconds: 0 }),
}));
const users = vi.hoisted(() => ({ findUser: vi.fn() }));
vi.mock("@/src/server/users/users.repository", () => users);
const repo = vi.hoisted(() => ({ recordAadhaarCheck: vi.fn() }));
vi.mock("@/src/server/aadhaar/aadhaar.repository", () => repo);
const keys = vi.hoisted(() => ({ aadhaarKeys: vi.fn() }));
vi.mock("@/src/server/aadhaar/keys", () => keys);

const { POST, GET } = await import("@/app/api/v1/verify/aadhaar-qr/route");
const { AADHAAR_CONSENT_VERSION } = await import("./aadhaar.schemas");

const noParams = { params: Promise.resolve({}) };
const post = (body: unknown) =>
  new NextRequest("http://localhost:3000/api/v1/verify/aadhaar-qr", {
    method: "POST",
    headers: { host: "localhost:3000", "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
const body = (qr: string) => ({ qr, consent: true, consent_version: AADHAAR_CONSENT_VERSION });

describe("POST /api/v1/verify/aadhaar-qr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("FEATURE_AADHAAR_QR", "true");
    fakeCaller = { userId: "user_driver", role: "driver" };
    users.findUser.mockResolvedValue({ id: "user_driver", display_name: "Ravi Kumar" });
    repo.recordAadhaarCheck.mockResolvedValue("aadhaar_qr");
    keys.aadhaarKeys.mockReturnValue([KEY]);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("is 404 while the feature is off", async () => {
    vi.stubEnv("FEATURE_AADHAAR_QR", "");
    const res = await POST(post(body(makeQr("Ravi Kumar"))), noParams);
    expect(res.status).toBe(404);
    expect(repo.recordAadhaarCheck).not.toHaveBeenCalled();
  });

  it("verifies, stores only the verdict, last 4 and versions, and logs no QR or name", async () => {
    const qr = makeQr("Ravi Kumar");
    const out: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
    const res = await POST(post(body(qr)), noParams);
    spy.mockRestore();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await res.json()).data).toEqual({
      verdict: "verified",
      reason: null,
      verification_level: "aadhaar_qr",
      test_key: true,
    });
    expect(repo.recordAadhaarCheck).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ verdict: "verified", last4: "4821", certVersion: "test-1", consentVersion: AADHAAR_CONSENT_VERSION }),
    );
    const stored = JSON.stringify(repo.recordAadhaarCheck.mock.calls[0][1]);
    expect(stored).not.toContain("Ravi");
    expect(stored).not.toContain(qr.slice(0, 40));
    const logs = out.join("");
    expect(logs).not.toContain(qr.slice(0, 40));
    expect(logs).not.toContain("Ravi");
  });

  it("stores a rejection with no last 4", async () => {
    const res = await POST(post(body(makeQr("Sunita Devi"))), noParams);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ verdict: "rejected", reason: "name" });
    expect(repo.recordAadhaarCheck.mock.calls[0][1]).toMatchObject({ verdict: "rejected", last4: null });
  });

  it.each([
    ["no consent", { qr: "123", consent: false, consent_version: "x" }],
    ["letters in the QR", { qr: "12ab", consent: true, consent_version: "aadhaar-2026-11-25" }],
    ["an extra field", { qr: "123", consent: true, consent_version: "aadhaar-2026-11-25", aadhaar: "1234" }],
    ["an old consent version", { qr: "123", consent: true, consent_version: "old" }],
  ])("rejects %s with 422", async (_label, b) => {
    const res = await POST(post(b), noParams);
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain("application/problem+json");
  });

  it("is 413 or 422 for a body past the size cap", async () => {
    const res = await POST(post(body("9".repeat(40_000))), noParams);
    expect([413, 422]).toContain(res.status);
  });

  it("is for drivers and agents only", async () => {
    fakeCaller = { userId: "user_x", role: "police" };
    expect((await POST(post(body("123")), noParams)).status).toBe(403);
    fakeCaller = null;
    expect((await POST(post(body("123")), noParams)).status).toBe(401);
  });

  it("refuses the demo key when test keys are not allowed (none pinned → 503)", async () => {
    keys.aadhaarKeys.mockReturnValue([]);
    expect((await POST(post(body(makeQr("Ravi Kumar"))), noParams)).status).toBe(503);
  });

  it("answers 405 to GET", async () => {
    expect((await GET(post({}), noParams)).status).toBe(405);
  });
});
