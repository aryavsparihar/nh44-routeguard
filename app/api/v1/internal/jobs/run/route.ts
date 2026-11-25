// POST /api/v1/internal/jobs/run: the queue worker (BUILD_PROMPT section 17,
// part 2). pg_cron calls it every minute through pg_net, only while a job is
// waiting, with the X-Jobs-Secret header (the JOBS_SECRET value, kept in
// Supabase Vault). Not for browsers: no Origin check, the secret is the lock.
//   200  { data: { done, retry, dead, runs } }
//   401  wrong or missing secret
//   503  JOBS_SECRET or the database is not set up on this server
import { getWorkerDb } from "@/src/server/db";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { handlers } from "@/src/server/jobs/handlers";
import { checkJobsSecret, JOBS_SECRET_HEADER } from "@/src/server/jobs/secret";
import { dbQueue, runQueue } from "@/src/server/jobs/worker";

export const POST = withApi({ access: "public", checkOrigin: false }, async ({ req, log }) => {
  checkJobsSecret(req.headers.get(JOBS_SECRET_HEADER));
  const summary = await runQueue(dbQueue(getWorkerDb()), handlers, log);
  return ok(summary, { headers: { "Cache-Control": "no-store" } });
});

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
