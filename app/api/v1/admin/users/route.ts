// GET /api/v1/admin/users?approval=pending: the accounts waiting for TCU
// (or, with approval=rejected, the ones TCU turned down), oldest first, with
// each sign-in email so TCU knows who is asking. TCU only.
import { getDb } from "@/src/server/db";
import { readQuery } from "@/src/server/http/body";
import { list } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { usersListQuery } from "@/src/server/users/users.schemas";
import { listForReview } from "@/src/server/users/users.service";

export const GET = withApi({ access: ["admin"] }, async ({ req }) => {
  const query = readQuery(req, usersListQuery);
  const rows = await listForReview(await getDb(), query.approval);
  return list(rows, { count: rows.length, next_cursor: null });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
