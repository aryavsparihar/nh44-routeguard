// PATCH /api/v1/admin/users/{id}/role: an admin sets any user's role,
// including police and admin, with a written reason (BUILD_PROMPT sections 8
// and 10). The change and its audit_log row are written together by the
// admin_set_role database function; then Clerk is updated so the role
// reaches the user's session token (within about a minute).
//
// TODO(rate-limit): 5 role attempts per user per hour (section 10) once the
// shared rate limiter exists (section 17).
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { NotFoundError } from "@/src/server/http/errors";
import { requireCaller } from "@/src/server/http/guards";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { clerkUserId, roleChangeBody } from "@/src/server/users/users.schemas";
import { changeRole } from "@/src/server/users/users.service";

export const PATCH = withApi<{ id: string }>(
  { access: ["admin"] },
  async ({ req, params, caller, requestId }) => {
    // A malformed id can't belong to any user.
    if (!clerkUserId.safeParse(params.id).success) {
      throw new NotFoundError("No user with this id.");
    }
    const input = await readJson(req, roleChangeBody);
    const result = await changeRole(await getDb(), requireCaller(caller), params.id, input, requestId);
    return ok({ ...result, token_refresh_needed: true });
  },
);

const notSupported = notAllowed(["PATCH"]);
export { notSupported as GET, notSupported as POST, notSupported as PUT, notSupported as DELETE };
