// GET /api/v1/risk/replays: past storms the map can replay (jobs/replay.py),
// for demos on a dry day. Public. Static: the list changes only with a build.
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { REPLAY_CACHE_CONTROL, REPLAY_META, listReplays } from "@/src/server/risk/replays";

export const GET = withApi({ access: "public" }, async () => {
  const events = listReplays();
  return list(
    events,
    { count: events.length, next_cursor: null, ...REPLAY_META },
    { headers: { "Cache-Control": REPLAY_CACHE_CONTROL } },
  );
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
