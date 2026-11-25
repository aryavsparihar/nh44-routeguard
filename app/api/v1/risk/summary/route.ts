// GET /api/v1/risk/summary?lang=en|hi|ur: the newest risk scores as a few
// lines of plain text, under 5 KB, for a weak connection (PPT feature 7).
// Public, cached like /api/v1/risk.
import { getDb } from "@/src/server/db";
import { readQuery } from "@/src/server/http/body";
import { ServiceUnavailableError } from "@/src/server/http/errors";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { summaryQuery } from "@/src/server/risk/risk.schemas";
import {
  RISK_CACHE_CONTROL,
  etagMatches,
  getLatestRun,
  riskEtag,
} from "@/src/server/risk/risk.service";
import { riskSummary } from "@/src/server/risk/summary";

export const GET = withApi({ access: "public" }, async ({ req }) => {
  const { lang } = readQuery(req, summaryQuery);
  const run = await getLatestRun(getDb).catch(() => {
    throw new ServiceUnavailableError("The risk scores can't be read right now. Try again soon.");
  });

  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Language": lang,
    "Cache-Control": run.runAt ? RISK_CACHE_CONTROL : "public, max-age=60",
  };
  if (run.runAt) {
    // One ETag per run and language.
    const etag = riskEtag(run.runAt).replace(/"$/, `-${lang}"`);
    headers.ETag = etag;
    if (etagMatches(req.headers.get("if-none-match"), etag)) {
      return new Response(null, { status: 304, headers });
    }
  }
  return new Response(riskSummary(run, lang), { status: 200, headers });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
