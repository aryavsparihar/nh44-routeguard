// PATCH  /api/v1/admin/official-updates/{id}: edit. Makes a new version
//        (version + 1, supersedes_id = id) and closes the old one, so the
//        history keeps what was shown before. Returns the new version.
// DELETE /api/v1/admin/official-updates/{id}: soft delete with a reason in
//        the JSON body. The row stays for the history.
// Admin and police only. Both are audited in the same transaction.
import { getDb } from "@/src/server/db";
import { readJson } from "@/src/server/http/body";
import { NotFoundError } from "@/src/server/http/errors";
import { requireCaller } from "@/src/server/http/guards";
import { ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { replaceUpdate, softDeleteUpdate } from "@/src/server/official-updates/official-updates.repository";
import {
  deleteUpdateBody,
  editUpdateBody,
  updateId,
} from "@/src/server/official-updates/official-updates.schemas";

function checkId(id: string): string {
  // A malformed id can't match any row.
  if (!updateId.safeParse(id).success) throw new NotFoundError("No official update with this id.");
  return id;
}

export const PATCH = withApi<{ id: string }>(
  { access: ["police", "admin"] },
  async ({ req, params, caller, requestId }) => {
    const id = checkId(params.id);
    const { reason, ...patch } = await readJson(req, editUpdateBody);
    const row = await replaceUpdate(await getDb(), id, requireCaller(caller).userId, patch, { reason, requestId });
    return ok(row);
  },
);

export const DELETE = withApi<{ id: string }>(
  { access: ["police", "admin"] },
  async ({ req, params, requestId }) => {
    const id = checkId(params.id);
    const { reason } = await readJson(req, deleteUpdateBody);
    const row = await softDeleteUpdate(await getDb(), id, reason, { requestId });
    return ok(row);
  },
);

const notSupported = notAllowed(["PATCH", "DELETE"]);
export { notSupported as GET, notSupported as POST, notSupported as PUT };
