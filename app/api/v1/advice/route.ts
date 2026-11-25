// POST /api/v1/advice: SEND, HOLD, RAIL or DIVERT for one lot, from the
// newest risk scores and the admin-set road status. Public; nothing is
// stored. The phone runs the same decide() when it is offline (L12).
// Rate limited: 60 requests a minute per IP (section 10).
import { readJson } from "@/src/server/http/body";
import { getDb } from "@/src/server/db";
import { ServiceUnavailableError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { adviceRequest } from "@/src/server/advice/advice.schemas";
import { getLatestRun } from "@/src/server/risk/risk.service";
import { getRoadStatus } from "@/src/server/road-status/road-status.service";
import { decide, type Lot } from "@/src/shared/decide";

export const POST = withApi({ access: "public", rateLimit: "advice" }, async ({ req }) => {
  const lot = (await readJson(req, adviceRequest)) as Lot;
  const [run, road] = await Promise.all([
    getLatestRun(getDb),
    getDb().then(getRoadStatus),
  ]).catch(() => {
    throw new ServiceUnavailableError("The risk scores can't be read right now. Try again soon.");
  });
  const advice = decide(lot, { rows: run.rows, run_at: run.runAt?.toISOString() ?? null }, road);
  return ok(advice, { headers: { "Cache-Control": "no-store" } });
});

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
