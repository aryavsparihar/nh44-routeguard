// GET  /api/v1/agents/invites: the agent's invite codes, newest first, with
//      who used each one.
// POST /api/v1/agents/invites: a new 8-character code a driver types to join
//      this agent's fleet. { days?: 1..30 (default 7) } → 201 { code, expires_at }.
//      At most 20 open codes at a time (429).
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { created, list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { createInviteBody } from "@/src/server/fleet/fleet.schemas";
import { createInvite, listInvites } from "@/src/server/fleet/fleet.repository";

export const GET = withApi({ access: ["agent"] }, async () => {
  const rows = await listInvites(await getDb());
  return list(rows, { count: rows.length, next_cursor: null });
});

export const POST = withApi({ access: ["agent"] }, async ({ req }) => {
  const { days } = await readJson(req, createInviteBody);
  const invite = await createInvite(await getDb(), days);
  return created(invite, "/api/v1/agents/invites");
});

const notSupported = notAllowed(["GET", "POST"]);
export { notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
