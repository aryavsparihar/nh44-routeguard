// Errors that API code throws on purpose. withApi() turns each one into a
// problem+json response with the right status code. Anything else that is
// thrown counts as a bug and becomes a generic 500.

export type FieldError = { path: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly title: string;

  constructor(status: number, title: string, detail?: string) {
    // detail is shown to the client, so keep it short and safe.
    super(detail ?? title);
    this.name = new.target.name;
    this.status = status;
    this.title = title;
  }
}

// 400: the JSON or the query string can't be read.
export class BadRequestError extends ApiError {
  readonly errors?: FieldError[];

  constructor(detail = "The request could not be read.", errors?: FieldError[]) {
    super(400, "Bad request", detail);
    this.errors = errors;
  }
}

// 401: not signed in.
export class AuthError extends ApiError {
  constructor(detail = "Sign in to use this.") {
    super(401, "Not signed in", detail);
  }
}

// 403: signed in, but not allowed (wrong role, someone else's row, bad Origin).
export class ForbiddenError extends ApiError {
  constructor(detail = "You don't have access to this.") {
    super(403, "Forbidden", detail);
  }
}

// 404: unknown id or path.
export class NotFoundError extends ApiError {
  constructor(detail = "Nothing was found here.") {
    super(404, "Not found", detail);
  }
}

// 405: the path exists but not with this method.
export class MethodNotAllowedError extends ApiError {
  readonly allow: string[];

  constructor(allow: string[]) {
    super(405, "Method not allowed", `Use ${allow.join(" or ")}.`);
    this.allow = allow;
  }
}

// 409: clashes with something that already exists.
export class ConflictError extends ApiError {
  constructor(detail = "This clashes with something that already exists.") {
    super(409, "Conflict", detail);
  }
}

// 413: body or photo too big.
export class PayloadTooLargeError extends ApiError {
  constructor(maxBytes: number) {
    super(413, "Payload too large", `The body must be at most ${maxBytes} bytes.`);
  }
}

// 415: wrong Content-Type.
export class UnsupportedMediaTypeError extends ApiError {
  constructor(expected: string) {
    super(415, "Unsupported media type", `Send the body as ${expected}.`);
  }
}

// 422: valid JSON that breaks the rules (zod).
export class ValidationError extends ApiError {
  readonly errors: FieldError[];

  constructor(errors: FieldError[]) {
    super(422, "Invalid input", "Some fields are not valid.");
    this.errors = errors;
  }
}

// 429: too many requests.
export class RateLimitError extends ApiError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(429, "Too many requests", `Try again in ${retryAfterSeconds} seconds.`);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// 503: the database (or another service we need) is not reachable.
export class ServiceUnavailableError extends ApiError {
  constructor(detail = "A service we depend on is not reachable. Try again soon.") {
    super(503, "Service unavailable", detail);
  }
}
