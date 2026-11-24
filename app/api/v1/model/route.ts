// GET /api/v1/model: the model card and the backtest results (BUILD_PROMPT
// section 6, P1). Public. Both come from files in the repo, so they only
// change with a deploy; caching for 5 minutes is safe.
import { modelCard } from "@/src/server/model/model-card";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";

export const GET = withApi({ access: "public" }, async () =>
  ok(modelCard(), { headers: { "Cache-Control": "public, max-age=300" } }),
);

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
