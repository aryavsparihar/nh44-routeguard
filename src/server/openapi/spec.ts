// The OpenAPI 3.1 document for /api/v1 (GET /api/v1/openapi.json, shown at
// /api/docs). Built from OPERATIONS (operations.ts): request schemas come from
// the routes' own zod schemas through zod 4's z.toJSONSchema, which writes the
// JSON Schema 2020-12 that OpenAPI 3.1 uses.
import { z } from "zod";
import { RATE_LIMITS } from "@/src/server/http/rate-limit";
import { OPERATIONS, type Access, type Answer, type Operation } from "./operations";

type Json = Record<string, unknown>;

// Titles exactly as src/server/http/errors.ts sends them.
const TITLES: Record<number, string> = {
  400: "Bad request",
  401: "Not signed in",
  403: "Forbidden",
  404: "Not found",
  405: "Method not allowed",
  409: "Conflict",
  413: "Payload too large",
  415: "Unsupported media type",
  422: "Invalid input",
  429: "Too many requests",
  500: "Internal server error",
  503: "Service unavailable",
};

const DEFAULT_DETAIL: Record<number, string> = {
  400: "The body is not valid JSON.",
  401: "Sign in first.",
  403: "Your role can't do this, or a write came without our Origin header.",
  404: "Not found.",
  413: "The body must be at most 32768 bytes.",
  415: "Send the body as application/json.",
  422: "Some fields are not valid.",
  429: "Try again in 3600 seconds.",
  500: "Something went wrong on our side. Quote the request id if you report it.",
  503: "Service unavailable.",
};

function schema(s: z.ZodType): Json {
  const json = z.toJSONSchema(s, { io: "input", unrepresentable: "any" }) as Json;
  delete json.$schema;
  return json;
}

function problemExample(status: number, detail: string, path: string): Json {
  const body: Json = {
    type: "about:blank",
    title: TITLES[status] ?? "Error",
    status,
    detail,
    instance: path.replace(/\{[^}]+\}/g, "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b"),
    request_id: "b7c4e1f0a2d3",
  };
  if (status === 422) body.errors = [{ path: "tonnes", message: "Too big: expected number to be <=40" }];
  if (status === 400 && detail.startsWith("The query string")) body.errors = [{ path: "zone", message: "Invalid option" }];
  return body;
}

function accessText(access: Access): string {
  if (access === "public") return "Public.";
  if (access === "signed-in") return "Any signed-in user.";
  return `Signed in as: ${access.join(", ")}.`;
}

function limitText(name: Operation["rateLimit"]): string {
  if (!name) return "";
  const l: { limit: number; windowSeconds: number; per: string } = RATE_LIMITS[name];
  const window = l.windowSeconds === 60 ? "a minute" : l.windowSeconds === 3600 ? "an hour" : `${l.windowSeconds} s`;
  return ` Rate limited: ${l.limit} ${window} per ${l.per === "ip" ? "IP address" : "user"} (429 with Retry-After).`;
}

// Every error status this operation can answer, with its text.
export function errorsFor(op: Operation): Record<number, string> {
  const out: Record<number, string> = {};
  const writes = op.method !== "get";
  if (writes && op.path !== "/api/v1/openapi.json") out[403] = "A write must carry our Origin header (CSRF check).";
  if (op.access !== "public") {
    out[401] = DEFAULT_DETAIL[401];
    if (op.access !== "signed-in") out[403] = "Your role can't do this.";
  }
  if (op.body) {
    out[400] = DEFAULT_DETAIL[400];
    out[413] = DEFAULT_DETAIL[413];
    out[415] = DEFAULT_DETAIL[415];
  }
  // A bad query string is a 400 with the same field list (section 6).
  if (op.query) out[400] = op.body ? DEFAULT_DETAIL[400] : "The query string is not valid.";
  if (op.body || op.multipart) out[422] = DEFAULT_DETAIL[422];
  if (op.params) out[404] = "No such item (an id in the wrong format counts as not found).";
  if (op.rateLimit) {
    const l = RATE_LIMITS[op.rateLimit];
    out[429] = `Try again in ${l.windowSeconds} seconds.`;
  }
  Object.assign(out, op.errors ?? {});
  out[500] = DEFAULT_DETAIL[500];
  return out;
}

function successContent(answer: Answer): Json | undefined {
  const envelope = answer.envelope ?? "data";
  if (envelope === "none") {
    if (answer.example === undefined) {
      if (answer.contentType) return { [answer.contentType]: { schema: { type: "string", format: "binary" } } };
      return undefined;
    }
    return { [answer.contentType ?? "application/json"]: { example: answer.example } };
  }
  const example = envelope === "list" ? { data: answer.example, meta: answer.meta } : { data: answer.example };
  const wrapper =
    envelope === "list"
      ? { $ref: "#/components/schemas/ListEnvelope" }
      : { $ref: "#/components/schemas/DataEnvelope" };
  return { "application/json": { schema: wrapper, example } };
}

function operationObject(op: Operation): Json {
  const parameters: Json[] = [];
  for (const [name, s] of Object.entries(op.params ?? {})) {
    parameters.push({ name, in: "path", required: true, schema: schema(s) });
  }
  if (op.query) {
    const q = schema(op.query) as { properties?: Record<string, Json>; required?: string[] };
    for (const [name, s] of Object.entries(q.properties ?? {})) {
      parameters.push({ name, in: "query", required: (q.required ?? []).includes(name) && !("default" in s), schema: s });
    }
  }
  for (const h of op.headers ?? []) {
    parameters.push({ name: h.name, in: "header", required: h.required, description: h.description, schema: schema(h.schema) });
  }

  const responses: Json = {};
  for (const [status, answer] of Object.entries(op.success)) {
    const headers = Object.fromEntries(
      Object.entries(answer.headers ?? {}).map(([name, description]) => [name, { description, schema: { type: "string" } }]),
    );
    const content = successContent(answer);
    responses[status] = {
      description: answer.description,
      ...(Object.keys(headers).length ? { headers } : {}),
      ...(content ? { content } : {}),
    };
  }
  for (const [status, detail] of Object.entries(errorsFor(op))) {
    const code = Number(status);
    responses[status] = {
      description: `${TITLES[code] ?? "Error"}: ${detail}`,
      ...(code === 429 ? { headers: { "Retry-After": { description: "Seconds to wait.", schema: { type: "integer" } } } } : {}),
      content: {
        "application/problem+json": {
          schema: { $ref: "#/components/schemas/Problem" },
          example: problemExample(code, detail, op.path),
        },
      },
    };
  }

  let requestBody: Json | undefined;
  if (op.body) {
    requestBody = {
      required: true,
      content: { "application/json": { schema: schema(op.body), ...(op.bodyExample !== undefined ? { example: op.bodyExample } : {}) } },
    };
  } else if (op.multipart) {
    const fields = schema(op.multipart) as { properties: Json; required?: string[] };
    requestBody = {
      required: true,
      content: {
        "multipart/form-data": {
          schema: {
            type: "object",
            properties: {
              ...fields.properties,
              photo: { type: "string", format: "binary", description: "JPEG, PNG or WebP, at most 5 MB." },
            },
            required: fields.required ?? [],
          },
        },
      },
    };
  }

  const security =
    op.access === "public" ? [] : [{ clerkSession: [] }, { bearer: [] }];

  return {
    tags: [op.tag],
    summary: op.summary,
    description: `${op.description ? `${op.description} ` : ""}${accessText(op.access)}${limitText(op.rateLimit)}`,
    operationId: `${op.method}_${op.path.replace(/^\/api\/v1\//, "").replace(/[^a-z0-9]+/gi, "_").replace(/_$/, "")}`,
    ...(parameters.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
    security,
  };
}

export function buildOpenApi(version = "1.0.0"): Json {
  const paths: Record<string, Json> = {};
  for (const op of OPERATIONS) {
    paths[op.path] ??= {};
    paths[op.path][op.method] = operationObject(op);
  }
  const tags = [...new Set(OPERATIONS.map((o) => o.tag))].map((name) => ({ name }));
  return {
    openapi: "3.1.0",
    info: {
      title: "RouteGuard NH-44 API",
      version,
      summary: "Closure risk for NH-44 (Jammu–Srinagar) and dispatch advice for apple trucks.",
      description: [
        "RouteGuard is advisory and not an official police service.",
        "",
        "Every answer is JSON: `{ data }`, or `{ data, meta }` for lists. Errors are RFC 9457 problem details (`application/problem+json`) with a `request_id`; validation errors list each field in `errors`.",
        "",
        "Signed-in endpoints take Clerk's session cookie (`__session`) from the browser, or the same token as `Authorization: Bearer <token>`. Writes (POST, PATCH, DELETE) must send `Origin` with this site's address.",
        "",
        "The examples show the shape of each answer. Their ids, names and times are made up; the zone and the past closure are real rows from the repository.",
      ].join("\n"),
      license: { name: "MIT" },
    },
    servers: [{ url: "/", description: "This server" }],
    tags,
    paths,
    components: {
      securitySchemes: {
        clerkSession: { type: "apiKey", in: "cookie", name: "__session", description: "Clerk's session cookie (set by signing in on /sign-in)." },
        bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "A Clerk session token." },
      },
      schemas: {
        Problem: {
          type: "object",
          required: ["type", "title", "status", "detail", "instance", "request_id"],
          properties: {
            type: { type: "string", const: "about:blank" },
            title: { type: "string" },
            status: { type: "integer" },
            detail: { type: "string" },
            instance: { type: "string", description: "The path that was asked for." },
            request_id: { type: "string", description: "Also in the X-Request-Id header and our logs." },
            errors: {
              type: "array",
              items: {
                type: "object",
                required: ["path", "message"],
                properties: { path: { type: "string" }, message: { type: "string" } },
              },
            },
          },
        },
        DataEnvelope: { type: "object", required: ["data"], properties: { data: {} } },
        ListEnvelope: {
          type: "object",
          required: ["data", "meta"],
          properties: {
            data: { type: "array", items: {} },
            meta: {
              type: "object",
              required: ["count", "next_cursor"],
              properties: { count: { type: "integer" }, next_cursor: { type: ["string", "null"] } },
            },
          },
        },
      },
    },
  };
}

// GET /api/v1/openapi.json and its alias /api/openapi.json. Built once per
// server; it only changes with a deploy.
let served: string | null = null;
export function openApiResponse(version: string): Response {
  served ??= JSON.stringify(buildOpenApi(version));
  return new Response(served, {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
