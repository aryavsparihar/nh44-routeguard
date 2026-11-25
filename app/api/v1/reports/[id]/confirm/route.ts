// POST /api/v1/reports/{id}/confirm: "I see it too". Verified drivers,
// agents, police and admins, once per person, never on your own report. The
// body may carry where you are now ({ lat, lng }); only the distance to the
// report is kept. Two verified people within 2 km and 3 h, or one police or
// admin, make an unconfirmed report confirmed (section 9). A police or
// admin confirmation is written to the audit log (report.official_confirm).
// Rate limited: 30 an hour per user.
import { getDb } from "@/src/server/db";
import { reportsWriteEnabled } from "@/src/server/flags";
import { readJson } from "@/src/server/http/body";
import { NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { confirmReport } from "@/src/server/reports/reports.repository";
import { confirmBody, reportId } from "@/src/server/reports/reports.schemas";

export const POST = withApi<{ id: string }>(
  { access: ["driver", "agent", "police", "admin"], rateLimit: "confirmation" },
  async ({ req, params, requestId }) => {
    if (!reportsWriteEnabled()) throw new ServiceUnavailableError("Reporting is paused for now.");
    if (!reportId.safeParse(params.id).success) throw new NotFoundError("No report with this id.");
    const at = await readJson(req, confirmBody);
    return ok(await confirmReport(await getDb(), params.id, at, requestId));
  },
);

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
