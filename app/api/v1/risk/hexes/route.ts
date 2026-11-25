// GET /api/v1/risk/hexes?horizon=0|12|24|48: the newest risk score for every
// H3 cell (resolution 8) along NH-44, with each cell's outline. Public.
// Cached like /risk: ETag from the run time and horizon, 304 on a match.
import { getDb } from "@/src/server/db";
import { readQuery } from "@/src/server/http/body";
import { ServiceUnavailableError } from "@/src/server/http/errors";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { cachedHexes, withBoundaries } from "@/src/server/risk/hexes";
import { latestHexRows } from "@/src/server/risk/risk.repository";
import { hexQuery } from "@/src/server/risk/risk.schemas";
import { RISK_CACHE_CONTROL, etagMatches, getLatestRun } from "@/src/server/risk/risk.service";

const UNREACHABLE = "The risk scores can't be read right now. Try again soon.";

export const GET = withApi({ access: "public" }, async ({ req }) => {
  const { horizon } = readQuery(req, hexQuery);
  const run = await getLatestRun(getDb).catch(() => {
    throw new ServiceUnavailableError(UNREACHABLE);
  });
  if (!run.runAt) {
    return list([], { count: 0, next_cursor: null, run_at: null }, { headers: { "Cache-Control": "public, max-age=60" } });
  }
  const runAt = run.runAt.toISOString();
  const etag = `"hex-${run.runAt.getTime()}-${horizon}"`;
  const headers = { "Cache-Control": RISK_CACHE_CONTROL, ETag: etag };
  if (etagMatches(req.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  const features = await cachedHexes(runAt, horizon, async () =>
    withBoundaries(await latestHexRows(await getDb(), horizon)),
  ).catch(() => {
    throw new ServiceUnavailableError(UNREACHABLE);
  });
  return list(features, { count: features.length, next_cursor: null, run_at: runAt }, { headers });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
