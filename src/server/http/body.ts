// Reads and validates request input. Route code gets back typed, checked
// data or an ApiError is thrown (and withApi() turns it into problem+json).
import type { z } from "zod";
import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
  type FieldError,
} from "./errors";

export const MAX_JSON_BYTES = 32 * 1024; // 32 KB, BUILD_PROMPT section 6

// zod issues → [{ path: "shipment.tonnes", message }]
export function toFieldErrors(issues: z.core.$ZodIssue[]): FieldError[] {
  const out: FieldError[] = [];
  for (const issue of issues) {
    const parent = issue.path.map(String).join(".");
    if (issue.code === "unrecognized_keys") {
      // .strict() reports all extra keys in one issue; list each field.
      for (const key of issue.keys) {
        out.push({ path: parent ? `${parent}.${key}` : key, message: "Unknown field." });
      }
    } else {
      out.push({ path: parent, message: issue.message });
    }
  }
  return out;
}

// Reads the body as text, but stops as soon as it passes maxBytes, so a huge
// body can't fill the server's memory. Content-Length alone can't be trusted.
async function readTextWithLimit(req: Request, maxBytes: number): Promise<string> {
  return new TextDecoder().decode(await readBytesWithLimit(req, maxBytes));
}

async function readBytesWithLimit(req: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PayloadTooLargeError(maxBytes);
  }
  if (!req.body) return new Uint8Array();

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError(maxBytes);
    }
    chunks.push(value);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

// For JSON bodies:
//   wrong Content-Type → 415, too big → 413, not JSON → 400, breaks the
//   schema → 422.
export async function readJson<Schema extends z.ZodType>(
  req: Request,
  schema: Schema,
  maxBytes: number = MAX_JSON_BYTES,
): Promise<z.output<Schema>> {
  const contentType = req.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new UnsupportedMediaTypeError("application/json");
  }

  const text = await readTextWithLimit(req, maxBytes);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BadRequestError("The body is not valid JSON.");
  }

  const result = schema.safeParse(json);
  if (!result.success) throw new ValidationError(toFieldErrors(result.error.issues));
  return result.data;
}

// For query strings (?zone=3&horizon=24). Values arrive as text, so number
// fields in the schema use z.coerce.number(). A bad query is a 400 (section 6:
// "400: malformed JSON or query"), with the same field list as a 422.
export function readQuery<Schema extends z.ZodType>(
  req: Request,
  schema: Schema,
): z.output<Schema> {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new BadRequestError(
      "The query string is not valid.",
      toFieldErrors(result.error.issues),
    );
  }
  return result.data;
}

// For multipart/form-data bodies (a report with a photo): wrong type → 415,
// over maxBytes → 413 (counted while reading), unreadable → 400.
export async function readMultipart(req: Request, maxBytes: number): Promise<FormData> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "multipart/form-data") {
    throw new UnsupportedMediaTypeError("multipart/form-data");
  }
  const bytes = await readBytesWithLimit(req, maxBytes);
  try {
    return await new Response(bytes, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw new BadRequestError("The form could not be read.");
  }
}
