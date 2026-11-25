// A random UUID (version 4), for Idempotency-Keys made on the phone.
//
// crypto.randomUUID() exists only on https pages and localhost ("secure
// contexts"). A phone testing the app at the laptop's Wi-Fi address over
// plain http has crypto.getRandomValues() but not randomUUID(), so fall back
// to building the same format from 16 random bytes.
type CryptoLike = Pick<Crypto, "getRandomValues"> & { randomUUID?: () => string };

export function newUuid(c: CryptoLike = globalThis.crypto): string {
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
