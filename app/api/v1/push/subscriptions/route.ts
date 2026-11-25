// Web Push alerts for the signed-in user's browsers (BUILD_PROMPT WP-B B6).
// GET    /api/v1/push/subscriptions: your browsers with alerts on, and their zones
// POST   /api/v1/push/subscriptions: turn alerts on in this browser (or change
//        its zones or language). Body: PushSubscription.toJSON()'s endpoint and
//        keys, plus zones and language. 201, or 200 when it was already on.
//        Rate limited with DELETE: 20 changes an hour per user.
// DELETE /api/v1/push/subscriptions: turn alerts off in this browser. Body:
//        { endpoint }. 204 either way (nothing to say whether it was yours).
// 503 when push isn't set up on this server (no VAPID keys or FEATURE_PUSH=false).
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { ServiceUnavailableError } from "@/src/server/http/errors";
import { created, list, noContent, ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { pushConfig } from "@/src/server/push/config";
import { deleteSubscription, listMySubscriptions, saveSubscription } from "@/src/server/push/push.repository";
import { subscriptionBody, unsubscribeBody } from "@/src/server/push/push.schemas";

function requirePush() {
  if (!pushConfig()) throw new ServiceUnavailableError("Alerts are not set up on this server.");
}

export const GET = withApi({ access: "signed-in" }, async () => {
  const rows = await listMySubscriptions(await getDb());
  return list(rows, { count: rows.length, next_cursor: null });
});

export const POST = withApi({ access: "signed-in", rateLimit: "push" }, async ({ req }) => {
  requirePush();
  const input = await readJson(req, subscriptionBody);
  const db = await getDb();
  const before = (await listMySubscriptions(db)).some((s) => s.endpoint === input.endpoint);
  const saved = await saveSubscription(db, input);
  const body = { id: saved.id, zones: [...new Set(input.zones)].sort((a, b) => a - b), language: input.language };
  return before ? ok(body) : created(body, "/api/v1/push/subscriptions");
});

export const DELETE = withApi({ access: "signed-in", rateLimit: "push" }, async ({ req }) => {
  const { endpoint } = await readJson(req, unsubscribeBody);
  await deleteSubscription(await getDb(), endpoint);
  return noContent();
});

const notSupported = notAllowed(["GET", "POST", "DELETE"]);
export { notSupported as PUT, notSupported as PATCH };
