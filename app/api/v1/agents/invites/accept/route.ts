// POST /api/v1/agents/invites/accept: a driver joins an agent's fleet with
// the code the agent gave them. { code } → 200 { agent_id, outcome }, where
// outcome is "joined" or "repeat" (already joined with this code).
//   404 unknown code · 409 used by someone else or expired
// Rate limited with the verification limit (5 an hour), so codes can't be guessed.
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { acceptInviteBody } from "@/src/server/fleet/fleet.schemas";
import { acceptInvite } from "@/src/server/fleet/fleet.repository";

export const POST = withApi({ access: ["driver"], rateLimit: "verification" }, async ({ req }) => {
  const { code } = await readJson(req, acceptInviteBody);
  return ok(await acceptInvite(await getDb(), code));
});

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
