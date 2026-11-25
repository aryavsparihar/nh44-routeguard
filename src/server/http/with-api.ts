import "server-only";
import type { NextRequest } from "next/server";
import type { Logger } from "pino";
import { getCaller, type Caller } from "./caller";
import { MethodNotAllowedError } from "./errors";
import { checkOrigin, requireAccess, type Access } from "./guards";
import { hashUserId, logger } from "./logger";
import { toProblemResponse } from "./problem";
import { checkRateLimit, type RateLimitName } from "./rate-limit";
import { getRequestId } from "./request-id";

type Params = Record<string, string | string[]>;

export type ApiOptions = {
  access: Access;
  // Leave on. Only turn off for server-to-server routes that prove who they
  // are another way (the queue worker uses a JOBS_SECRET header).
  checkOrigin?: boolean;
  // A shared limit from RATE_LIMITS (rate-limit.ts), checked after access.
  rateLimit?: RateLimitName;
};

export type ApiContext<P extends Params> = {
  req: NextRequest;
  params: P;
  caller: Caller | null;
  requestId: string;
  log: Logger; // already tagged with the request id
};

// Wraps every API route handler. In order, it:
//   1. gives the request an id,
//   2. checks Origin on writes (CSRF),
//   3. finds the caller and checks their access,
//   4. checks the route's rate limit, if it has one (429),
//   5. runs the handler,
//   6. turns any thrown error into problem+json,
//   7. adds X-Request-Id (and no-store on non-public routes),
//   8. writes one log line.
//
// Usage in app/api/v1/.../route.ts:
//   export const GET = withApi({ access: "public" }, async ({ req }) => ok(...));
export function withApi<P extends Params = Params>(
  options: ApiOptions,
  handler: (ctx: ApiContext<P>) => Promise<Response>,
) {
  return async function apiHandler(
    req: NextRequest,
    context: { params: Promise<P> },
  ): Promise<Response> {
    const started = performance.now();
    const requestId = getRequestId(req.headers);
    // Path only. Query strings are never logged (they can hold personal data).
    const path = new URL(req.url).pathname;
    const log = logger.child({ request_id: requestId });

    let caller: Caller | null = null;
    let response: Response;
    let unexpected: unknown = null;

    try {
      if (options.checkOrigin !== false) checkOrigin(req);
      caller = await getCaller();
      requireAccess(caller, options.access);
      if (options.rateLimit) {
        await checkRateLimit(options.rateLimit, caller, req.headers, (err) =>
          log.warn({ err: { name: (err as Error)?.name }, limit: options.rateLimit }, "rate limit store failed; request allowed"),
        );
      }
      const params = await context.params;
      response = await handler({ req, params, caller, requestId, log });
    } catch (error) {
      response = toProblemResponse(error, requestId, path);
      if (response.status >= 500) unexpected = error;
    }

    // Copy into a new Response so the headers are always writable.
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", requestId);
    if (options.access !== "public" && !headers.has("Cache-Control")) {
      headers.set("Cache-Control", "no-store");
    }
    const final = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    const line = {
      method: req.method,
      route: path,
      status: final.status,
      duration_ms: Math.round(performance.now() - started),
      user: caller ? hashUserId(caller.userId) : null,
      role: caller?.role ?? null,
    };
    if (unexpected) {
      // The stack stays here on the server. The client only saw a generic 500.
      log.error({ ...line, err: unexpected }, "request failed");
    } else {
      log.info(line, "request");
    }

    return final;
  };
}

// Route files export this for the methods they don't support, so the client
// gets a JSON 405 with an Allow header instead of Next's plain-text one:
//   const notSupported = notAllowed(["GET"]);
//   export { notSupported as POST, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
// HEAD is added for you whenever GET is allowed (Next answers HEAD from GET).
export function notAllowed(allowed: string[]) {
  const allow = allowed.includes("GET") && !allowed.includes("HEAD")
    ? [...allowed, "HEAD"]
    : allowed;
  return withApi({ access: "public", checkOrigin: false }, async () => {
    throw new MethodNotAllowedError(allow);
  });
}
