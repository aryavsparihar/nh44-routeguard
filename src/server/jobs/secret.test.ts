import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthError, ServiceUnavailableError } from "@/src/server/http/errors";
import { checkJobsSecret, jobsSecretSet } from "./secret";

vi.mock("server-only", () => ({}));

const SECRET = "s".repeat(40);

afterEach(() => vi.unstubAllEnvs());

describe("checkJobsSecret", () => {
  it("is 503 while JOBS_SECRET is unset or too short", () => {
    vi.stubEnv("JOBS_SECRET", "");
    expect(jobsSecretSet()).toBe(false);
    expect(() => checkJobsSecret(SECRET)).toThrow(ServiceUnavailableError);
    vi.stubEnv("JOBS_SECRET", "short");
    expect(() => checkJobsSecret("short")).toThrow(ServiceUnavailableError);
  });

  it("is 401 for a missing or wrong secret", () => {
    vi.stubEnv("JOBS_SECRET", SECRET);
    expect(() => checkJobsSecret(null)).toThrow(AuthError);
    expect(() => checkJobsSecret("")).toThrow(AuthError);
    expect(() => checkJobsSecret(SECRET.slice(1))).toThrow(AuthError);
    expect(() => checkJobsSecret(`${SECRET}x`)).toThrow(AuthError);
  });

  it("passes the right secret", () => {
    vi.stubEnv("JOBS_SECRET", SECRET);
    expect(jobsSecretSet()).toBe(true);
    expect(() => checkJobsSecret(SECRET)).not.toThrow();
  });
});
