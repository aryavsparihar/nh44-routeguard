// Verification levels that count as "verified" (the same list as
// private.is_verified() in the database). A driver needs one of these to
// post road reports: their agent vouched for them, or they passed the
// optional Aadhaar QR check. Aadhaar is never the only way.
export const VERIFIED_LEVELS = ["agent_vouched", "aadhaar_qr", "official"] as const;

export function isVerifiedLevel(level: string | null | undefined): boolean {
  return VERIFIED_LEVELS.includes(level as (typeof VERIFIED_LEVELS)[number]);
}
