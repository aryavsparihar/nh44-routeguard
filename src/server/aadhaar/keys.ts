import "server-only";
import certs from "@/config/uidai/certs.json";
import { aadhaarTestCertAllowed } from "@/src/server/flags";
import { pinnedKeys, type CertEntry, type PinnedKey } from "./secure-qr";

// Loaded once per server instance; fingerprints are checked on first use.
let cached: { allowTest: boolean; keys: PinnedKey[] } | null = null;

export function aadhaarKeys(): PinnedKey[] {
  const allowTest = aadhaarTestCertAllowed();
  if (!cached || cached.allowTest !== allowTest) {
    cached = { allowTest, keys: pinnedKeys(certs.certificates as CertEntry[], allowTest) };
  }
  return cached.keys;
}
