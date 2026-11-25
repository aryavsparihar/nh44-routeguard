import "server-only";

// Switches an admin can flip in the server's environment without a deploy
// of new code (BUILD_PROMPT section 10).

// FEATURE_REPORTS_WRITE=false pauses new reports, confirmations and flags if
// posting gets spammed. Anything else (or unset) leaves it on.
export function reportsWriteEnabled(): boolean {
  return process.env.FEATURE_REPORTS_WRITE?.trim().toLowerCase() !== "false";
}

// FEATURE_AADHAAR_QR=true turns on the optional Aadhaar Secure QR check
// (BUILD_PROMPT section 11). Off by default: the route answers 404.
export function aadhaarQrEnabled(): boolean {
  return process.env.FEATURE_AADHAAR_QR?.trim().toLowerCase() === "true";
}

// AADHAAR_ALLOW_TEST_CERT=true also accepts our demo key (config/uidai,
// test entries); the result then says "Demo check (test key)". Never in
// production use.
export function aadhaarTestCertAllowed(): boolean {
  return process.env.AADHAAR_ALLOW_TEST_CERT?.trim().toLowerCase() === "true";
}
