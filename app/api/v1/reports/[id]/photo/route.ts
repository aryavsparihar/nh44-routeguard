// GET /api/v1/reports/{id}/photo: a redirect (302) to a signed link for the
// report's photo, valid for 10 minutes. Public for reports that aren't
// hidden; 404 when there is no photo. The storage path never leaves the
// server, and the link can't be reused after it expires.
import { getDb } from "@/src/server/db";
import { NotFoundError } from "@/src/server/http/errors";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { visiblePhotoPath } from "@/src/server/reports/reports.repository";
import { reportId } from "@/src/server/reports/reports.schemas";
import { signedPhotoUrl } from "@/src/server/reports/storage";

export const GET = withApi<{ id: string }>({ access: "public" }, async ({ params }) => {
  if (!reportId.safeParse(params.id).success) throw new NotFoundError("No report with this id.");
  const path = await visiblePhotoPath(await getDb(), params.id);
  const url = path ? await signedPhotoUrl(path) : null;
  if (!url) throw new NotFoundError("This report has no photo.");
  // Each visitor gets their own link; shared caches must not keep it.
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=300" } });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
