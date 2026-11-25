// GET /api/v1/reports/{id}/photo: the report's photo (WebP, EXIF removed).
// Public for reports that aren't hidden; 404 when there is no photo. The
// server reads it from private Storage and sends the bytes itself, so the
// storage path (which holds the reporter's user id) never leaves the server.
import { getDb } from "@/src/server/db";
import { NotFoundError } from "@/src/server/http/errors";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { visiblePhotoPath } from "@/src/server/reports/reports.repository";
import { reportId } from "@/src/server/reports/reports.schemas";
import { readPhoto } from "@/src/server/reports/storage";

export const GET = withApi<{ id: string }>({ access: "public" }, async ({ params }) => {
  if (!reportId.safeParse(params.id).success) throw new NotFoundError("No report with this id.");
  const path = await visiblePhotoPath(await getDb(), params.id);
  const bytes = path ? await readPhoto(path) : null;
  if (!bytes) throw new NotFoundError("This report has no photo.");
  // private: a moderator can hide the report, so shared caches must not keep it.
  return new Response(bytes as Uint8Array<ArrayBuffer>, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});

const notSupported = notAllowed(["GET"]);
export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
