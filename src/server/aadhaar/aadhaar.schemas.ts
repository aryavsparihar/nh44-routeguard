import { z } from "zod";
import { MAX_QR_DIGITS } from "./secure-qr";

// The consent text version the screen showed (messages: me.aadhaar.consent).
export const AADHAAR_CONSENT_VERSION = "aadhaar-qr-2026-11-25";

// Only the QR text and the consent tick. Digits only, capped; the checker
// also caps it, so a schema change can't open a hole.
export const aadhaarQrBody = z
  .object({
    qr: z.string().max(MAX_QR_DIGITS).regex(/^\d+$/, "The QR text must be digits only."),
    consent: z.literal(true),
    consent_version: z.literal(AADHAAR_CONSENT_VERSION),
  })
  .strict();
