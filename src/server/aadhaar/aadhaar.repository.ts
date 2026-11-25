import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { DbError } from "@/src/server/http/db-errors";
import { ConflictError, ForbiddenError } from "@/src/server/http/errors";

// Stores the result of one check through private.record_aadhaar_check():
// verdict, last 4 digits, consent and certificate versions. Nothing else.
export async function recordAadhaarCheck(
  db: Db,
  r: { verdict: string; last4: string | null; consentVersion: string; certVersion: string | null; requestId: string },
): Promise<string> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ verification_level: string }>(
        sql`select * from private.record_aadhaar_check(${r.verdict}::text, ${r.last4}::text, ${r.consentVersion}::text, ${r.certVersion}::text, ${r.requestId}::text)`,
      ),
    );
    return rows[0].verification_level;
  } catch (err) {
    if (err instanceof DbError && err.code === "42501") throw new ForbiddenError("Only drivers and agents use this check.");
    if (err instanceof DbError && err.code === "P0002") {
      throw new ConflictError("Your account has no RouteGuard profile yet. Finish onboarding first.");
    }
    throw err;
  }
}
