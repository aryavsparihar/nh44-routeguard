// POST /api/v1/verify/aadhaar-qr: the optional Aadhaar Secure QR check
// (BUILD_PROMPT section 11). Drivers and agents, behind FEATURE_AADHAAR_QR,
// 5 tries an hour. The phone sends the QR text it scanned; the signature,
// layout and name are checked here, in memory. Only the verdict, the last 4
// digits and the versions are stored. The body is never logged (withApi()
// logs hand-picked fields only) and the service worker never caches /verify.
import { recordAadhaarCheck } from "@/src/server/aadhaar/aadhaar.repository";
import { AADHAAR_CONSENT_VERSION, aadhaarQrBody } from "@/src/server/aadhaar/aadhaar.schemas";
import { aadhaarKeys } from "@/src/server/aadhaar/keys";
import { checkSecureQr } from "@/src/server/aadhaar/secure-qr";
import { getDb } from "@/src/server/db";
import { aadhaarQrEnabled } from "@/src/server/flags";
import { readJson } from "@/src/server/http/body";
import { ConflictError, NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { findUser } from "@/src/server/users/users.repository";

export const POST = withApi(
  { access: ["driver", "agent"], rateLimit: "verification" },
  async ({ req, caller, requestId }) => {
    if (!aadhaarQrEnabled()) throw new NotFoundError("The Aadhaar check is not turned on.");
    const body = await readJson(req, aadhaarQrBody);

    let keys;
    try {
      keys = aadhaarKeys();
    } catch {
      throw new ServiceUnavailableError("The Aadhaar check is not set up on this server.");
    }
    if (keys.length === 0) throw new ServiceUnavailableError("The Aadhaar check is not set up on this server.");

    const db = await getDb();
    const me = await findUser(db, caller!.userId);
    if (!me) throw new ConflictError("Your account has no RouteGuard profile yet. Finish onboarding first.");

    const result = checkSecureQr(body.qr, keys, me.display_name ?? "");
    const level = await recordAadhaarCheck(db, {
      verdict: result.verdict,
      last4: result.verdict === "rejected" ? null : result.last4,
      consentVersion: AADHAAR_CONSENT_VERSION,
      certVersion: result.certVersion,
      requestId,
    });

    return ok(
      {
        verdict: result.verdict,
        reason: result.verdict === "rejected" ? result.reason : null,
        verification_level: level,
        test_key: result.testKey,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  },
);

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
