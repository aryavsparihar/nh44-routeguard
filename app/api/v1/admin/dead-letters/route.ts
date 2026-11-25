// GET /api/v1/admin/dead-letters: queue jobs that failed 5 times, with the
// last error, newest first, 50 a page. Admin only. Read-only: a job that
// should run again is fixed and re-done by hand (docs/runbook.md).
import { getDb } from "@/src/server/db";
import { readQuery } from "@/src/server/http/body";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { listDeadLetters } from "@/src/server/jobs/dead-letters.repository";
import { deadLettersQuery } from "@/src/server/jobs/jobs.schemas";

export const GET = withApi({ access: ["admin"] }, async ({ req }) => {
  const { limit, cursor } = readQuery(req, deadLettersQuery);
  const rows = await listDeadLetters(await getDb(), { limit, before: cursor });
  const page = rows.slice(0, limit);
  const next = rows.length > limit ? String(page[page.length - 1].id) : null;
  return list(page, { count: page.length, next_cursor: next });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
