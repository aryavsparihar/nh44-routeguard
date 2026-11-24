import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_JSON_BYTES, readJson, readQuery } from "./body";
import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "./errors";

const schema = z.object({ tonnes: z.number().min(0.1).max(40) }).strict();

function post(body: string | ReadableStream, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
    // Needed by Node's fetch when the body is a stream.
    ...(typeof body === "string" ? {} : { duplex: "half" }),
  } as RequestInit);
}

describe("readJson", () => {
  it("returns parsed, checked data", async () => {
    await expect(readJson(post('{"tonnes": 12}'), schema)).resolves.toEqual({ tonnes: 12 });
  });

  it("accepts a charset on the content type", async () => {
    const req = post('{"tonnes": 1}', { "content-type": "application/json; charset=utf-8" });
    await expect(readJson(req, schema)).resolves.toEqual({ tonnes: 1 });
  });

  it("415 when the content type is not JSON", async () => {
    const req = post('{"tonnes": 12}', { "content-type": "text/plain" });
    await expect(readJson(req, schema)).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
  });

  it("413 when Content-Length says it is too big", async () => {
    const req = post('{"tonnes": 12}', { "content-length": String(MAX_JSON_BYTES + 1) });
    await expect(readJson(req, schema)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("413 when the real body is too big, even without Content-Length", async () => {
    const big = new TextEncoder().encode(`{"x":"${"a".repeat(MAX_JSON_BYTES)}"}`);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(big);
        controller.close();
      },
    });
    await expect(readJson(post(stream), schema)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("400 for malformed JSON", async () => {
    await expect(readJson(post("{tonnes: 12"), schema)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("422 with field paths when the rules are broken", async () => {
    const error = await readJson(post('{"tonnes": 99}'), schema).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.errors[0].path).toBe("tonnes");
  });

  it("422 for unknown fields (.strict())", async () => {
    const error = await readJson(post('{"tonnes": 5, "role": "admin"}'), schema).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.errors).toEqual([{ path: "role", message: "Unknown field." }]);
  });
});

describe("readQuery", () => {
  const query = z.object({ zone: z.coerce.number().int().min(1).max(6) }).strict();

  it("returns typed values", () => {
    const req = new Request("http://localhost/api/v1/risk?zone=3");
    expect(readQuery(req, query)).toEqual({ zone: 3 });
  });

  it("400 with field paths for a bad value", () => {
    const req = new Request("http://localhost/api/v1/risk?zone=9");
    const error = (() => {
      try {
        readQuery(req, query);
      } catch (e) {
        return e as BadRequestError;
      }
    })();
    expect(error).toBeInstanceOf(BadRequestError);
    expect(error?.errors?.[0].path).toBe("zone");
  });
});
