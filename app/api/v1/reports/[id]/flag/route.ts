// POST /api/v1/reports/{id}/flag: "this is wrong", with a reason. Any
// signed-in user, once per report. Three flags from different people hide an
// unconfirmed report until an admin looks at it (section 9).
import { getDb } from "@/src/server/db";
import { reportsWriteEnabled } from "@/src/server/flags";
import { readJson } from "@/src/server/http/body";
import { NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { flagReport } from "@/src/server/reports/reports.repository";
import { flagBody, reportId } from "@/src/server/reports/reports.schemas";

export const POST = withApi<{ id: string }>(
  { access: "signed-in", rateLimit: "confirmation" },
  async ({ req, params }) => {
    if (!reportsWriteEnabled()) throw new ServiceUnavailableError("Reporting is paused for now.");
    if (!reportId.safeParse(params.id).success) throw new NotFoundError("No report with this id.");
    const { reason } = await readJson(req, flagBody);
    return ok(await flagReport(await getDb(), params.id, reason));
  },
);

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
