// GET    /api/v1/me: the signed-in user's profile and role. onboarded is
//        false until they pick a role with POST /api/v1/me/onboarding.
// PATCH  /api/v1/me: change display_name, language or location_consent.
//        Turning location_consent on records the privacy notice version.
// DELETE /api/v1/me: delete your account. Body { "confirm": "DELETE" }.
//        Your profile, shipments, invites, confirmations and photos go; your
//        road reports stay in the history without your user id. Police and
//        admin accounts are removed by an admin (409). → 204.
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { requireCaller } from "@/src/server/http/guards";
import { noContent, ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { deleteMeBody, patchMeBody } from "@/src/server/users/users.schemas";
import { deleteMe, getMe, updateMe } from "@/src/server/users/users.service";

export const GET = withApi({ access: "signed-in" }, async ({ caller }) => {
  const me = await getMe(await getDb(), requireCaller(caller));
  return ok(me);
});

export const PATCH = withApi({ access: "signed-in" }, async ({ req, caller }) => {
  const input = await readJson(req, patchMeBody);
  return ok(await updateMe(await getDb(), requireCaller(caller), input));
});

export const DELETE = withApi({ access: "signed-in", rateLimit: "role" }, async ({ req, caller, requestId, log }) => {
  await readJson(req, deleteMeBody);
  await deleteMe(await getDb(), requireCaller(caller), requestId, log);
  return noContent();
});

const notSupported = notAllowed(["GET", "PATCH", "DELETE"]);
export { notSupported as POST, notSupported as PUT };
