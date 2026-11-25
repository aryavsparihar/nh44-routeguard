// PATCH /api/v1/admin/reports/{id}: hide, resolve or restore a report, with
// a reason. Audited in the same transaction. Admin only (section 7).
//   hide     off the map (spam, people in the photo, wrong place)
//   resolve  the road is clear again
//   restore  back to unconfirmed, after flags hid it by mistake
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { NotFoundError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { moderateReport } from "@/src/server/reports/reports.repository";
import { moderateBody, reportId } from "@/src/server/reports/reports.schemas";

export const PATCH = withApi<{ id: string }>({ access: ["admin"] }, async ({ req, params, requestId }) => {
  if (!reportId.safeParse(params.id).success) throw new NotFoundError("No report with this id.");
  const input = await readJson(req, moderateBody);
  return ok(await moderateReport(await getDb(), params.id, input, requestId));
});

const notSupported = notAllowed(["PATCH"]);
export { notSupported as GET, notSupported as POST, notSupported as PUT, notSupported as DELETE };
