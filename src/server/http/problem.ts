// Turns an error into an RFC 9457 "problem details" response
// (Content-Type: application/problem+json).
import {
  ApiError,
  BadRequestError,
  MethodNotAllowedError,
  RateLimitError,
  ValidationError,
  type FieldError,
} from "./errors";

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

export type ProblemBody = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  request_id: string;
  errors?: FieldError[];
};

// RFC 9457: "about:blank" means the problem means no more than its status
// code. Clients switch on `status`. We have no public domain for type URLs.
const PROBLEM_TYPE = "about:blank";

export function toProblemResponse(
  error: unknown,
  requestId: string,
  instance: string,
): Response {
  // Anything we didn't throw on purpose is a bug. Never send its message,
  // stack, SQL or library text to the client; the server log has it.
  const known = error instanceof ApiError ? error : null;
  const status = known?.status ?? 500;

  const body: ProblemBody = {
    type: PROBLEM_TYPE,
    title: known?.title ?? "Internal server error",
    status,
    detail:
      known?.message ??
      "Something went wrong on our side. Quote the request id if you report it.",
    instance,
    request_id: requestId,
  };

  if (error instanceof ValidationError || error instanceof BadRequestError) {
    if (error.errors && error.errors.length > 0) body.errors = error.errors;
  }

  const headers = new Headers({
    "Content-Type": PROBLEM_CONTENT_TYPE,
    "X-Request-Id": requestId,
  });
  if (error instanceof MethodNotAllowedError) {
    headers.set("Allow", error.allow.join(", "));
  }
  if (error instanceof RateLimitError) {
    headers.set("Retry-After", String(error.retryAfterSeconds));
  }

  return new Response(JSON.stringify(body), { status, headers });
}
