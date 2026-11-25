// PATCH /api/v1/admin/road-status: an admin sets Mughal Road (open for light
// trucks?) or the parcel train (running?) with the link that says so. The
// advice (POST /api/v1/advice) reads it on the next request. Audited.
// Admin only. The public read is GET /api/v1/road-status.
//
// TODO(rate-limit): admin writes (section 10) once the shared limiter exists.
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { requireCaller } from "@/src/server/http/guards";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { setRoadStatus } from "@/src/server/road-status/road-status.repository";
import { roadStatusBody } from "@/src/server/road-status/road-status.schemas";

export const PATCH = withApi({ access: ["admin"] }, async ({ req, caller, requestId }) => {
  const input = await readJson(req, roadStatusBody);
  const row = await setRoadStatus(await getDb(), requireCaller(caller).userId, input, requestId);
  return ok(row);
});

const notSupported = notAllowed(["PATCH"]);
export { notSupported as GET, notSupported as POST, notSupported as PUT, notSupported as DELETE };
