// GET /api/v1/health/ready: readiness. "The server can reach the database,
// and here is how old the risk scores are." 503 problem+json when the
// database can't be reached (or isn't set up). Old data is still a 200 with
// stale: true, because the app keeps working and shows the stale banner.
//
// Used to warm the app up before the demo and by the post-deploy smoke test.
// It is NOT the Container Apps readiness probe: a Supabase hiccup would then
// take every replica out of service (docs/decisions.md, A7).
import { getDb } from "@/src/server/db";
import { latestRunAt } from "@/src/server/health/health.repository";
import { ServiceUnavailableError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { STALE_AFTER_MINUTES, dataAgeMinutes, isStale } from "@/src/shared/freshness";

const UNREACHABLE = "The database is not reachable right now. Try again soon.";

export const GET = withApi({ access: "public" }, async ({ log }) => {
  const db = await getDb().catch(() => {
    throw new ServiceUnavailableError(UNREACHABLE);
  });
  const { runAt, failed } = await latestRunAt(db);
  if (failed) {
    log.warn({ check: "database" }, "readiness check failed");
    throw new ServiceUnavailableError(UNREACHABLE);
  }

  const age = runAt ? dataAgeMinutes(runAt) : null;
  return ok(
    {
      status: "ready",
      database: "ok",
      last_run_at: runAt,
      data_age_minutes: age,
      stale: isStale(age),
      stale_after_minutes: STALE_AFTER_MINUTES,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
