// GET /api/v1/risk/replays/{id}?horizon=0|12|24|48: one past storm, scored
// like the live map: the zone rows (every horizon, like GET /api/v1/risk)
// and every H3 cell at one horizon with its outline (like
// GET /api/v1/risk/hexes). Public. Never mixed with the live scores.
import { readQuery } from "@/src/server/http/body";
import { NotFoundError } from "@/src/server/http/errors";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { REPLAY_CACHE_CONTROL, getReplay } from "@/src/server/risk/replays";
import { hexQuery, replayId } from "@/src/server/risk/risk.schemas";

const NOT_FOUND = "No past storm with this id.";

export const GET = withApi<{ id: string }>({ access: "public" }, async ({ req, params }) => {
  if (!replayId.safeParse(params.id).success) throw new NotFoundError(NOT_FOUND);
  const { horizon } = readQuery(req, hexQuery);
  const replay = getReplay(params.id, horizon);
  if (!replay) throw new NotFoundError(NOT_FOUND);
  return ok(replay, { headers: { "Cache-Control": REPLAY_CACHE_CONTROL } });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
