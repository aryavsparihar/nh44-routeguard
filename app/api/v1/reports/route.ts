// GET  /api/v1/reports?zone=&status=: road reports on the map right now
//      (unconfirmed or confirmed, not expired, not hidden). Public. No user ids.
// POST /api/v1/reports: a new road report from a driver, agent, police or
//      admin. multipart/form-data: hazard_type, lat, lng, note (optional),
//      photo (optional, JPEG/PNG/WebP up to 5 MB). Needs an Idempotency-Key
//      header (a UUID made once per report): sending it again returns the
//      first answer instead of a second report.
//        201  a new report (Location: /api/v1/reports/{id})
//        200  the same report again, or merged into an earlier one nearby
//             (same hazard within 500 m and 60 min counts as a confirmation)
//      Rate limited: 10 an hour per user. FEATURE_REPORTS_WRITE=false → 503.
import { getDb } from "@/src/server/db";
import { reportsWriteEnabled } from "@/src/server/flags";
import { readMultipart, readQuery, toFieldErrors } from "@/src/server/http/body";
import { BadRequestError, PayloadTooLargeError, ServiceUnavailableError, ValidationError } from "@/src/server/http/errors";
import { requireCaller } from "@/src/server/http/guards";
import { created, list, ok } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { maskNote } from "@/src/server/reports/mask";
import { cleanPhoto, PhotoError } from "@/src/server/reports/photo";
import { listActiveReports, submitReport } from "@/src/server/reports/reports.repository";
import { idempotencyKey, publicReportsQuery, reportFields } from "@/src/server/reports/reports.schemas";
import { REPORT_RULES } from "@/src/server/reports/rules";
import { photoPath, removePhoto, uploadPhoto } from "@/src/server/reports/storage";
import { nearestOnRoad } from "@/src/shared/corridor";

export const GET = withApi({ access: "public" }, async ({ req }) => {
  const { zone, status } = readQuery(req, publicReportsQuery);
  const rows = await listActiveReports(await getDb(), { zone, status });
  return list(rows, { count: rows.length, next_cursor: null }, {
    headers: { "Cache-Control": "public, max-age=30" },
  });
});

// The photo plus the text fields and the form's own boundaries.
const MAX_FORM_BYTES = REPORT_RULES.photo.max_bytes + 64 * 1024;

export const POST = withApi(
  { access: ["driver", "agent", "police", "admin"], rateLimit: "report" },
  async ({ req, caller, log }) => {
    if (!reportsWriteEnabled()) throw new ServiceUnavailableError("Reporting is paused for now.");
    const { userId } = requireCaller(caller);

    const key = idempotencyKey.safeParse(req.headers.get("idempotency-key"));
    if (!key.success) {
      throw new BadRequestError("Send an Idempotency-Key header: a UUID made once for this report.", [
        { path: "Idempotency-Key", message: "Must be a UUID." },
      ]);
    }
    const clientId = key.data;

    const form = await readMultipart(req, MAX_FORM_BYTES);
    const fields: Record<string, string> = {};
    let photo: File | null = null;
    for (const [name, value] of form.entries()) {
      if (name === "photo" && typeof value !== "string") photo = value;
      else if (typeof value === "string") fields[name] = value;
      else throw new ValidationError([{ path: name, message: "Only the photo field can be a file." }]);
    }
    const parsed = reportFields.safeParse(fields);
    if (!parsed.success) throw new ValidationError(toFieldErrors(parsed.error.issues));
    const input = parsed.data;

    let path: string | null = null;
    if (photo && photo.size > 0) {
      let webp: Buffer;
      try {
        webp = await cleanPhoto(new Uint8Array(await photo.arrayBuffer()));
      } catch (err) {
        if (err instanceof PhotoError && err.message === "too_big") throw new PayloadTooLargeError(REPORT_RULES.photo.max_bytes);
        throw new ValidationError([{ path: "photo", message: "Send a JPEG, PNG or WebP photo." }]);
      }
      path = photoPath(userId, clientId);
      await uploadPhoto(path, webp);
    }

    const removeUploaded = async () => {
      if (!path) return;
      await removePhoto(path).catch(() => log.warn("could not remove an unused report photo"));
    };

    let result;
    try {
      result = await submitReport(await getDb(), {
        clientId,
        hazard: input.hazard_type,
        lat: input.lat,
        lng: input.lng,
        zoneId: nearestOnRoad(input.lat, input.lng).zone,
        note: input.note ? maskNote(input.note) : null,
        photoPath: path,
      });
    } catch (err) {
      await removeUploaded();
      throw err;
    }

    if (result.outcome === "merged") await removeUploaded();
    const body = { id: result.id, status: result.status, outcome: result.outcome };
    return result.outcome === "created" ? created(body, `/api/v1/reports/${result.id}`) : ok(body);
  },
);

const notSupported = notAllowed(["GET", "POST"]);
export { notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
