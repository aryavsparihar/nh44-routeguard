import { describe, expect, it } from "vitest";
import { generateVAPIDKeys } from "web-push";
import { keyBytes } from "./push";

describe("keyBytes", () => {
  it("turns a VAPID public key into its 65 bytes, starting with 0x04", () => {
    const { publicKey } = generateVAPIDKeys();
    const bytes = keyBytes(publicKey);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
    expect(Buffer.from(bytes).toString("base64url")).toBe(publicKey);
  });
});
