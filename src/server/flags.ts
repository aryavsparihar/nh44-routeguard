import "server-only";

// Switches an admin can flip in the server's environment without a deploy
// of new code (BUILD_PROMPT section 10).

// FEATURE_REPORTS_WRITE=false pauses new reports, confirmations and flags if
// posting gets spammed. Anything else (or unset) leaves it on.
export function reportsWriteEnabled(): boolean {
  return process.env.FEATURE_REPORTS_WRITE?.trim().toLowerCase() !== "false";
}
