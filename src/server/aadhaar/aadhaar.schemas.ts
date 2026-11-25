import { z } from "zod";
import { AADHAAR_CONSENT_VERSION } from "@/src/shared/aadhaar";
import { MAX_QR_DIGITS } from "./secure-qr";

export { AADHAAR_CONSENT_VERSION };

// Only the QR text and the consent tick. Digits only, capped; the checker
// also caps it, so a schema change can't open a hole.
export const aadhaarQrBody = z
  .object({
    qr: z.string().max(MAX_QR_DIGITS).regex(/^\d+$/, "The QR text must be digits only."),
    consent: z.literal(true),
    consent_version: z.literal(AADHAAR_CONSENT_VERSION),
  })
  .strict();
