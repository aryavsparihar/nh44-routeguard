// POST /api/v1/me/onboarding: a signed-in user picks grower, trader, agent or
// driver, once (BUILD_PROMPT section 8). police and admin give 422; changing
// the role later needs an admin (PATCH /api/v1/admin/users/{id}/role).
//
// 201 the first time. 200 if an earlier attempt with the same role stopped
// halfway (it finishes the job). The new role is in the session token only
// after it refreshes, so the client calls getToken({ skipCache: true }).
//
// Rate limited: 5 role attempts an hour per user (section 10).
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { requireCaller } from "@/src/server/http/guards";
import { created, ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { onboardingBody } from "@/src/server/users/users.schemas";
import { onboard } from "@/src/server/users/users.service";

export const POST = withApi({ access: "signed-in", rateLimit: "role" }, async ({ req, caller }) => {
  const input = await readJson(req, onboardingBody);
  const result = await onboard(await getDb(), requireCaller(caller), input);
  const data = { ...result.me, token_refresh_needed: true };
  return result.created ? created(data, "/api/v1/me") : ok(data);
});

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
