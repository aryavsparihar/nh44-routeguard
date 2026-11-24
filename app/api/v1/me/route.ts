// GET /api/v1/me: the signed-in user's profile and role.
// onboarded is false until they pick a role with POST /api/v1/me/onboarding.
import { getDb } from "@/src/server/db";
import { requireCaller } from "@/src/server/http/guards";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { getMe } from "@/src/server/users/users.service";

export const GET = withApi({ access: "signed-in" }, async ({ caller }) => {
  const me = await getMe(await getDb(), requireCaller(caller));
  return ok(me);
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
