// GET /api/v1/risk?horizon=0|12|24|48&zone=1..6: the newest risk scores for
// each zone. Public. Without horizon or zone it returns every row of the run
// (6 zones x 4 horizons), which is what the map and the 48 h strip load.
//
// Caching (BUILD_PROMPT section 17): ETag = the run time, 304 when the
// client already has it, Cache-Control for an hourly update, and a 60 s
// in-memory copy per server instance (src/server/risk/risk.service.ts).
import { getDb } from "@/src/server/db";
import { readQuery } from "@/src/server/http/body";
import { ServiceUnavailableError } from "@/src/server/http/errors";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { riskQuery } from "@/src/server/risk/risk.schemas";
import {
  RISK_CACHE_CONTROL,
  etagMatches,
  getLatestRun,
  riskEtag,
} from "@/src/server/risk/risk.service";
import type { RiskMeta } from "@/src/shared/risk";

const UNREACHABLE = "The risk scores can't be read right now. Try again soon.";

export const GET = withApi({ access: "public" }, async ({ req }) => {
  const query = readQuery(req, riskQuery);
  const run = await getLatestRun(getDb).catch(() => {
    throw new ServiceUnavailableError(UNREACHABLE);
  });

  const headers: Record<string, string> = { "Cache-Control": RISK_CACHE_CONTROL };
  if (run.runAt) {
    const etag = riskEtag(run.runAt);
    headers.ETag = etag;
    if (etagMatches(req.headers.get("if-none-match"), etag)) {
      return new Response(null, { status: 304, headers });
    }
  } else {
    // No run yet: don't let caches keep the empty answer for long.
    headers["Cache-Control"] = "public, max-age=60";
  }

  const rows = run.rows.filter(
    (row) =>
      (query.horizon === undefined || row.horizon_hours === query.horizon) &&
      (query.zone === undefined || row.zone_id === query.zone),
  );
  const meta: RiskMeta = {
    count: rows.length,
    next_cursor: null,
    run_at: run.runAt?.toISOString() ?? null,
    model_version: run.modelVersion,
  };
  return list(rows, meta, { headers });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
