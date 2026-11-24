import { describe, expect, it } from "vitest";
import {
  AuthError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  MethodNotAllowedError,
  NotFoundError,
  PayloadTooLargeError,
  RateLimitError,
  ServiceUnavailableError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "./errors";
import { PROBLEM_CONTENT_TYPE, toProblemResponse } from "./problem";

const REQUEST_ID = "3f1c3c1e-2b9a-4b7e-9a51-6f0d2f6b7a10";

describe("toProblemResponse", () => {
  it.each([
    [new BadRequestError(), 400],
    [new AuthError(), 401],
    [new ForbiddenError(), 403],
    [new NotFoundError(), 404],
    [new MethodNotAllowedError(["GET"]), 405],
    [new ConflictError(), 409],
    [new PayloadTooLargeError(32_768), 413],
    [new UnsupportedMediaTypeError("application/json"), 415],
    [new ValidationError([{ path: "tonnes", message: "Too big" }]), 422],
    [new RateLimitError(30), 429],
    [new ServiceUnavailableError(), 503],
  ])("maps %o to status %i with a problem body", async (error, status) => {
    const res = toProblemResponse(error, REQUEST_ID, "/api/v1/x");
    expect(res.status).toBe(status);
    expect(res.headers.get("Content-Type")).toBe(PROBLEM_CONTENT_TYPE);
    expect(res.headers.get("X-Request-Id")).toBe(REQUEST_ID);

    const body = await res.json();
    expect(body).toMatchObject({
      type: "about:blank",
      status,
      instance: "/api/v1/x",
      request_id: REQUEST_ID,
    });
    expect(typeof body.title).toBe("string");
    expect(typeof body.detail).toBe("string");
  });

  it("lists field errors on 422", async () => {
    const error = new ValidationError([{ path: "truck", message: "Bad format" }]);
    const body = await toProblemResponse(error, REQUEST_ID, "/x").json();
    expect(body.errors).toEqual([{ path: "truck", message: "Bad format" }]);
  });

  it("sets Allow on 405 and Retry-After on 429", () => {
    const res405 = toProblemResponse(new MethodNotAllowedError(["GET", "HEAD"]), REQUEST_ID, "/x");
    expect(res405.headers.get("Allow")).toBe("GET, HEAD");

    const res429 = toProblemResponse(new RateLimitError(42), REQUEST_ID, "/x");
    expect(res429.headers.get("Retry-After")).toBe("42");
  });

  it("hides the message of unknown errors behind a generic 500", async () => {
    const leak = new Error('relation "users" does not exist at line 1: SELECT secret');
    const res = toProblemResponse(leak, REQUEST_ID, "/x");
    expect(res.status).toBe(500);

    const text = await res.text();
    expect(text).not.toContain("relation");
    expect(text).not.toContain("SELECT");
    expect(text).not.toContain("at line");
    expect(JSON.parse(text).request_id).toBe(REQUEST_ID);
  });

  it("treats thrown non-Error values as 500 too", async () => {
    const res = toProblemResponse("boom", REQUEST_ID, "/x");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("boom");
  });
});
