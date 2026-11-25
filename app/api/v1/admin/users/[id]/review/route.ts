// POST /api/v1/admin/users/{id}/review: TCU approves or rejects an account
// that is waiting (decision + audit row in the tcu_review_user database
// function). On approval the role is put into Clerk, so it reaches the
// person's session token within about a minute. A rejection needs a reason.
//
// Rate limited: 120 decisions an hour per TCU account ("review" in
// rate-limit.ts). The 5-an-hour role limit would be too few for a queue.
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { NotFoundError } from "@/src/server/http/errors";
import { requireCaller } from "@/src/server/http/guards";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { clerkUserId, reviewBody } from "@/src/server/users/users.schemas";
import { reviewUser } from "@/src/server/users/users.service";

export const POST = withApi<{ id: string }>(
  { access: ["admin"], rateLimit: "review" },
  async ({ req, params, caller, requestId }) => {
    if (!clerkUserId.safeParse(params.id).success) {
      throw new NotFoundError("No user with this id.");
    }
    const input = await readJson(req, reviewBody);
    const result = await reviewUser(await getDb(), requireCaller(caller), params.id, input, requestId);
    return ok(result);
  },
);

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
