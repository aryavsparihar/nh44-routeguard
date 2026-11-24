import { ClerkAPIResponseError } from "@clerk/nextjs/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";

const api = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUserMetadata: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: api }),
}));

const { clerkUserExists, setClerkRole } = await import("./users");

function clerkError(status: number) {
  return new ClerkAPIResponseError("Clerk said no", { data: [], status });
}

beforeEach(() => vi.clearAllMocks());

describe("clerkUserExists", () => {
  it("is true when Clerk finds the user", async () => {
    api.getUser.mockResolvedValue({ id: "user_t1" });
    expect(await clerkUserExists("user_t1")).toBe(true);
  });

  it("is false on a Clerk 404", async () => {
    api.getUser.mockRejectedValue(clerkError(404));
    expect(await clerkUserExists("user_t1")).toBe(false);
  });

  it("is a 503 for any other failure", async () => {
    api.getUser.mockRejectedValue(clerkError(500));
    await expect(clerkUserExists("user_t1")).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe("setClerkRole", () => {
  it("writes only publicMetadata.role", async () => {
    api.updateUserMetadata.mockResolvedValue({});
    await setClerkRole("user_t1", "police");
    expect(api.updateUserMetadata).toHaveBeenCalledWith("user_t1", { publicMetadata: { role: "police" } });
  });

  it("is a 404 when Clerk has no such user", async () => {
    api.updateUserMetadata.mockRejectedValue(clerkError(404));
    await expect(setClerkRole("user_t1", "police")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("is a 503 when Clerk can't be reached", async () => {
    api.updateUserMetadata.mockRejectedValue(new TypeError("fetch failed"));
    await expect(setClerkRole("user_t1", "police")).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});
