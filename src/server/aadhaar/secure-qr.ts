import "server-only";
import { createHash, createPublicKey, verify as verifySignature, type KeyObject } from "node:crypto";
import { unzipSync } from "node:zlib";

// Aadhaar Secure QR check (BUILD_PROMPT section 11). Pure functions: no
// database, no logging. The QR text is never stored or logged; only the
// verdict, the last 4 digits and the certificate version leave this file.
//
// Layout (UIDAI Secure QR): the QR holds a big decimal number. As bytes it
// is a compressed block; uncompressed, the last 256 bytes are an RSA-SHA256
// signature over everything before them. The text fields come first,
// separated by byte 255. Version 2 and later start with "V2"…, then the
// email/mobile indicator; older codes start with the indicator. The fields
// after that are the reference id (last 4 digits of the Aadhaar number and a
// timestamp), the name, and the rest of the address, then the photo.

export const MAX_QR_DIGITS = 16_000; // real codes are a few thousand digits
export const MAX_UNZIPPED_BYTES = 64 * 1024; // stops zip bombs
const SIGNATURE_BYTES = 256;
const SEPARATOR = 255;

export type Verdict = "verified" | "manual_review" | "rejected";
export type RejectReason = "not_a_number" | "too_long" | "unreadable" | "signature" | "layout" | "name";
export type PinnedKey = { version: string; key: KeyObject; test: boolean };
export type CheckResult =
  | { verdict: "verified" | "manual_review"; last4: string; certVersion: string; testKey: boolean }
  | { verdict: "rejected"; reason: RejectReason; certVersion: string | null; testKey: boolean };

export function decimalToBytes(digits: string): Buffer {
  let hex = BigInt(digits).toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  return Buffer.from(hex, "hex");
}

// Lower case, letters only, single spaces (any script; NFKC first).
export function normaliseName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

// Same name → verified. Close (word order, an initial, a typo) → a person
// looks. Otherwise rejected.
export function compareNames(onCard: string, profile: string): "same" | "close" | "different" {
  const a = normaliseName(onCard);
  const b = normaliseName(profile);
  if (!a || !b) return "different";
  if (a === b) return "same";
  const sortWords = (s: string) => s.split(" ").sort().join(" ");
  if (sortWords(a) === sortWords(b)) return "close";
  const similarity = 1 - editDistance(a, b) / Math.max(a.length, b.length);
  return similarity >= 0.8 ? "close" : "different";
}

// Splits the first `count` fields on byte 255 (the photo after them may
// contain 255 too, so we never split the whole block).
function leadingFields(data: Buffer, count: number): string[] | null {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < data.length && out.length < count; i++) {
    if (data[i] === SEPARATOR) {
      out.push(data.subarray(start, i).toString("latin1"));
      start = i + 1;
    }
  }
  return out.length === count ? out : null;
}

function nameAndReference(data: Buffer): { name: string; reference: string } | null {
  const first = leadingFields(data, 1);
  if (!first) return null;
  const versioned = first[0].startsWith("V");
  // V2+: version, indicator, reference, name. Older: indicator, reference, name.
  const fields = leadingFields(data, versioned ? 4 : 3);
  if (!fields) return null;
  const [reference, rawName] = versioned ? [fields[2], fields[3]] : [fields[1], fields[2]];
  // Text fields are UTF-8 (names can be in any Indian script).
  const name = Buffer.from(rawName, "latin1").toString("utf8");
  return { name, reference };
}

export function checkSecureQr(qr: string, keys: PinnedKey[], profileName: string): CheckResult {
  const rejected = (reason: RejectReason, key: PinnedKey | null = null): CheckResult => ({
    verdict: "rejected",
    reason,
    certVersion: key?.version ?? null,
    testKey: key?.test ?? false,
  });

  if (qr.length > MAX_QR_DIGITS) return rejected("too_long");
  if (!/^\d+$/.test(qr)) return rejected("not_a_number");

  let data: Buffer;
  try {
    data = unzipSync(decimalToBytes(qr), { maxOutputLength: MAX_UNZIPPED_BYTES });
  } catch {
    return rejected("unreadable"); // not compressed, truncated, or too big
  }
  if (data.length <= SIGNATURE_BYTES) return rejected("unreadable");

  const signed = data.subarray(0, data.length - SIGNATURE_BYTES);
  const signature = data.subarray(data.length - SIGNATURE_BYTES);
  const key = keys.find((k) => {
    try {
      return verifySignature("sha256", signed, k.key, signature);
    } catch {
      return false;
    }
  });
  if (!key) return rejected("signature");

  const parsed = nameAndReference(signed);
  if (!parsed || !/^\d{4}/.test(parsed.reference)) return rejected("layout", key);
  const last4 = parsed.reference.slice(0, 4);

  const match = compareNames(parsed.name, profileName);
  if (match === "different") return rejected("name", key);
  return {
    verdict: match === "same" ? "verified" : "manual_review",
    last4,
    certVersion: key.version,
    testKey: key.test,
  };
}

// Pinned certificates from config/uidai/certs.json. Each entry's SHA-256
// fingerprint is checked before the key is used; a mismatch stops the check.
export type CertEntry = { version: string; test: boolean; sha256: string; pem: string; note?: string };

export function pinnedKeys(entries: CertEntry[], allowTest: boolean): PinnedKey[] {
  return entries
    .filter((e) => allowTest || !e.test)
    .map((e) => {
      const fingerprint = createHash("sha256").update(e.pem).digest("hex");
      if (fingerprint !== e.sha256.toLowerCase()) {
        throw new Error(`config/uidai/certs.json: fingerprint mismatch for ${e.version}`);
      }
      return { version: e.version, key: createPublicKey(e.pem), test: e.test };
    });
}
