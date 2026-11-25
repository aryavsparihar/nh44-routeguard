// Tests for GET /api/v1/me, POST /api/v1/me/onboarding,
// PATCH /api/v1/admin/users/{id}/role and TCU's approvals
// (GET /api/v1/admin/users, POST /api/v1/admin/users/{id}/review). Clerk and the database are faked;
// the database rules themselves are tested in supabase/tests/rls.test.sql.
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Caller } from "@/src/server/http/caller";
import { NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";

let fakeCaller: Caller | null = null;
vi.mock("@/src/server/http/caller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/server/http/caller")>()),
  getCaller: async () => fakeCaller,
}));

vi.mock("@/src/server/db", () => ({ getDb: async () => ({}) }));

const clerk = vi.hoisted(() => ({
  clerkUserExists: vi.fn<(id: string) => Promise<boolean>>(),
  setClerkRole: vi.fn<(id: string, role: string) => Promise<void>>(),
  deleteClerkUser: vi.fn<(id: string) => Promise<void>>(),
  clerkEmails: vi.fn<(ids: string[]) => Promise<Record<string, string>>>(),
}));
vi.mock("@/src/server/clerk/users", () => clerk);

const repo = vi.hoisted(() => ({
  findUser: vi.fn(),
  insertOwnUser: vi.fn(),
  adminSetRole: vi.fn(),
  updateOwnUser: vi.fn(),
  deleteOwnAccount: vi.fn(),
  listUsersByApproval: vi.fn(),
  tcuReviewUser: vi.fn(),
}));
vi.mock("@/src/server/users/users.repository", () => repo);

const storage = vi.hoisted(() => ({ removePhoto: vi.fn<(path: string) => Promise<void>>() }));
vi.mock("@/src/server/reports/storage", () => storage);
vi.mock("@/src/server/http/rate-limit.store", () => ({
  hitBucket: async () => ({ allowed: true, hits: 1, retryAfterSeconds: 0 }),
}));

const { GET: getMe, PATCH: patchMe, DELETE: deleteMe } = await import("@/app/api/v1/me/route");
const { POST: postOnboarding } = await import("@/app/api/v1/me/onboarding/route");
const { PATCH: patchRole } = await import("@/app/api/v1/admin/users/[id]/role/route");
const { GET: listUsers } = await import("@/app/api/v1/admin/users/route");
const { POST: postReview } = await import("@/app/api/v1/admin/users/[id]/review/route");

const DRIVER_ROW = {
  id: "user_new1",
  role: "driver",
  display_name: "Test driver",
  language: "en",
  verification_level: "email",
  location_consent: false,
  consent_version: null,
  agent_id: null,
  approval: "approved",
  review_note: null,
};

function jsonRequest(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const noParams = { params: Promise.resolve({}) };
const target = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  fakeCaller = null;
  vi.clearAllMocks();
  clerk.clerkUserExists.mockResolvedValue(true);
  clerk.setClerkRole.mockResolvedValue(undefined);
});

describe("GET /api/v1/me", () => {
  it("is 401 when signed out", async () => {
    const res = await getMe(jsonRequest("GET", "/api/v1/me"), noParams);
    expect(res.status).toBe(401);
  });

  it("says onboarded: false before the user picks a role", async () => {
    fakeCaller = { userId: "user_new1", role: null };
    repo.findUser.mockResolvedValue(null);

    const res = await getMe(jsonRequest("GET", "/api/v1/me"), noParams);

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).data).toEqual({
      id: "user_new1",
      role: null,
      display_name: null,
      language: null,
      verification_level: null,
      location_consent: false,
      consent_version: null,
      agent_id: null,
      approval: null,
      review_note: null,
      onboarded: false,
    });
  });

  it("returns the profile once onboarded", async () => {
    fakeCaller = { userId: "user_new1", role: "driver" };
    repo.findUser.mockResolvedValue(DRIVER_ROW);

    const res = await getMe(jsonRequest("GET", "/api/v1/me"), noParams);

    expect((await res.json()).data).toEqual({ ...DRIVER_ROW, onboarded: true });
  });
});

describe("POST /api/v1/me/onboarding", () => {
  const path = "/api/v1/me/onboarding";

  it("is 401 when signed out", async () => {
    const res = await postOnboarding(jsonRequest("POST", path, { role: "driver" }), noParams);
    expect(res.status).toBe(401);
  });

  it.each(["police", "admin", "pilot"])("refuses the role %s with 422", async (role) => {
    fakeCaller = { userId: "user_new1", role: null };
    const res = await postOnboarding(jsonRequest("POST", path, { role }), noParams);

    expect(res.status).toBe(422);
    expect(repo.insertOwnUser).not.toHaveBeenCalled();
    expect(clerk.setClerkRole).not.toHaveBeenCalled();
  });

  it("refuses unknown fields with 422", async () => {
    fakeCaller = { userId: "user_new1", role: null };
    const res = await postOnboarding(
      jsonRequest("POST", path, { role: "driver", verification_level: "official" }),
      noParams,
    );
    expect(res.status).toBe(422);
  });

  it("is 409 when the token already has a role", async () => {
    fakeCaller = { userId: "user_new1", role: "grower" };
    const res = await postOnboarding(jsonRequest("POST", path, { role: "driver" }), noParams);

    expect(res.status).toBe(409);
    expect(repo.insertOwnUser).not.toHaveBeenCalled();
  });

  it("saves the request (waiting for TCU), leaves Clerk alone, and answers 201", async () => {
    fakeCaller = { userId: "user_new1", role: null };
    repo.insertOwnUser.mockResolvedValue("created");
    repo.findUser.mockResolvedValue({ ...DRIVER_ROW, approval: "pending" });

    const res = await postOnboarding(
      jsonRequest("POST", path, { role: "driver", display_name: "  Test driver ", language: "ur" }),
      noParams,
    );

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe("/api/v1/me");
    expect(repo.insertOwnUser).toHaveBeenCalledWith({}, {
      id: "user_new1",
      role: "driver",
      display_name: "Test driver",
      language: "ur",
    });
    // No role in the token until TCU approves.
    expect(clerk.setClerkRole).not.toHaveBeenCalled();
    expect((await res.json()).data).toMatchObject({ role: "driver", approval: "pending", onboarded: true });
  });

  it("answers 200 to the same request again, still without Clerk", async () => {
    fakeCaller = { userId: "user_new1", role: null };
    repo.insertOwnUser.mockResolvedValue("exists");
    repo.findUser.mockResolvedValue({ ...DRIVER_ROW, approval: "pending" });

    const res = await postOnboarding(jsonRequest("POST", path, { role: "driver" }), noParams);

    expect(res.status).toBe(200);
    expect(clerk.setClerkRole).not.toHaveBeenCalled();
  });

  it("is 409 when a row exists with a different role", async () => {
    fakeCaller = { userId: "user_new1", role: null };
    repo.insertOwnUser.mockResolvedValue("exists");
    repo.findUser.mockResolvedValue(DRIVER_ROW);

    const res = await postOnboarding(jsonRequest("POST", path, { role: "agent" }), noParams);

    expect(res.status).toBe(409);
    expect(clerk.setClerkRole).not.toHaveBeenCalled();
  });

  it("works while Clerk is down, since it doesn't call Clerk", async () => {
    fakeCaller = { userId: "user_new1", role: null };
    repo.insertOwnUser.mockResolvedValue("created");
    repo.findUser.mockResolvedValue({ ...DRIVER_ROW, approval: "pending" });
    clerk.setClerkRole.mockRejectedValue(new ServiceUnavailableError());

    const res = await postOnboarding(jsonRequest("POST", path, { role: "driver" }), noParams);

    expect(res.status).toBe(201);
  });
});

describe("PATCH /api/v1/admin/users/{id}/role", () => {
  const path = "/api/v1/admin/users/user_target1/role";
  const goodBody = { role: "agent", reason: "Now runs his own trucks" };

  beforeEach(() => {
    fakeCaller = { userId: "user_admin1", role: "admin" };
    repo.adminSetRole.mockResolvedValue("grower");
  });

  it("is 401 when signed out", async () => {
    fakeCaller = null;
    const res = await patchRole(jsonRequest("PATCH", path, goodBody), target("user_target1"));
    expect(res.status).toBe(401);
  });

  it("is 403 for anyone who isn't an admin", async () => {
    fakeCaller = { userId: "user_grower1", role: "grower" };
    const res = await patchRole(jsonRequest("PATCH", path, goodBody), target("user_target1"));

    expect(res.status).toBe(403);
    expect(repo.adminSetRole).not.toHaveBeenCalled();
  });

  it("is 422 without a reason", async () => {
    const res = await patchRole(jsonRequest("PATCH", path, { role: "agent" }), target("user_target1"));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.errors).toEqual([expect.objectContaining({ path: "reason" })]);
  });

  it.each(["police", "admin"])("refuses to give %s (TCU is the only admin) with 422", async (role) => {
    const res = await patchRole(jsonRequest("PATCH", path, { role, reason: "x" }), target("user_target1"));

    expect(res.status).toBe(422);
    expect(repo.adminSetRole).not.toHaveBeenCalled();
  });

  it("is 404 for an id that isn't a Clerk id", async () => {
    const res = await patchRole(jsonRequest("PATCH", path, goodBody), target("1 or 1=1"));
    expect(res.status).toBe(404);
  });

  it("is 404 when Clerk has no such user", async () => {
    clerk.clerkUserExists.mockResolvedValue(false);
    const res = await patchRole(jsonRequest("PATCH", path, goodBody), target("user_target1"));

    expect(res.status).toBe(404);
    expect(repo.adminSetRole).not.toHaveBeenCalled();
  });

  it("is 409 when an admin tries to change their own role", async () => {
    const res = await patchRole(jsonRequest("PATCH", path, goodBody), target("user_admin1"));
    expect(res.status).toBe(409);
  });

  it("saves and audits in the database first, then updates Clerk", async () => {
    const res = await patchRole(jsonRequest("PATCH", path, goodBody), target("user_target1"));
    const requestId = res.headers.get("X-Request-Id");

    expect(res.status).toBe(200);
    expect(repo.adminSetRole).toHaveBeenCalledWith({}, {
      targetId: "user_target1",
      role: "agent",
      reason: "Now runs his own trucks",
      requestId,
    });
    expect(clerk.setClerkRole).toHaveBeenCalledWith("user_target1", "agent");
    expect(repo.adminSetRole.mock.invocationCallOrder[0]).toBeLessThan(
      clerk.setClerkRole.mock.invocationCallOrder[0],
    );
    expect((await res.json()).data).toEqual({
      id: "user_target1",
      old_role: "grower",
      role: "agent",
      token_refresh_needed: true,
    });
  });

  it("is 503 with 'send it again' when Clerk fails after the database write", async () => {
    clerk.setClerkRole.mockRejectedValue(new ServiceUnavailableError());
    const res = await patchRole(jsonRequest("PATCH", path, goodBody), target("user_target1"));

    expect(res.status).toBe(503);
    expect((await res.json()).detail).toMatch(/saved.*again/);
  });

  it("passes a Clerk 404 during the update through as 404", async () => {
    clerk.setClerkRole.mockRejectedValue(new NotFoundError("No user with this id."));
    const res = await patchRole(jsonRequest("PATCH", path, goodBody), target("user_target1"));
    expect(res.status).toBe(404);
  });

  it("answers GET with 405", async () => {
    const { GET } = await import("@/app/api/v1/admin/users/[id]/role/route");
    const res = await GET(jsonRequest("GET", path), target("user_target1"));

    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("PATCH");
  });
});

describe("GET /api/v1/admin/users", () => {
  const path = "/api/v1/admin/users";
  const ROW = {
    id: "user_wait1",
    role: "driver",
    display_name: "Waiting driver",
    verification_level: "email",
    approval: "pending",
    review_note: null,
    reviewed_at: null,
    created_at: new Date("2026-11-26T05:00:00Z"),
  };

  it("is 403 for anyone but TCU", async () => {
    fakeCaller = { userId: "user_d1", role: "driver" };
    const res = await listUsers(jsonRequest("GET", path), noParams);
    expect(res.status).toBe(403);
  });

  it("lists waiting accounts with their sign-in email", async () => {
    fakeCaller = { userId: "user_admin1", role: "admin" };
    repo.listUsersByApproval.mockResolvedValue([ROW]);
    clerk.clerkEmails.mockResolvedValue({ user_wait1: "wait@example.com" });

    const res = await listUsers(jsonRequest("GET", path), noParams);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(repo.listUsersByApproval).toHaveBeenCalledWith({}, "pending");
    expect(body.data[0]).toMatchObject({ id: "user_wait1", email: "wait@example.com", approval: "pending" });
    expect(body.meta).toEqual({ count: 1, next_cursor: null });
  });

  it("is 400 for an unknown approval filter", async () => {
    fakeCaller = { userId: "user_admin1", role: "admin" };
    const res = await listUsers(jsonRequest("GET", `${path}?approval=approved`), noParams);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/admin/users/{id}/review", () => {
  const path = "/api/v1/admin/users/user_wait1/review";

  beforeEach(() => {
    fakeCaller = { userId: "user_admin1", role: "admin" };
    repo.tcuReviewUser.mockResolvedValue("driver");
  });

  it("is 403 for anyone but TCU", async () => {
    fakeCaller = { userId: "user_d1", role: "driver" };
    const res = await postReview(jsonRequest("POST", path, { decision: "approved" }), target("user_wait1"));

    expect(res.status).toBe(403);
    expect(repo.tcuReviewUser).not.toHaveBeenCalled();
  });

  it("approves in the database first, then puts the role into Clerk", async () => {
    const res = await postReview(jsonRequest("POST", path, { decision: "approved" }), target("user_wait1"));

    expect(res.status).toBe(200);
    expect(repo.tcuReviewUser).toHaveBeenCalledWith({}, {
      targetId: "user_wait1",
      decision: "approved",
      note: null,
      requestId: res.headers.get("X-Request-Id"),
    });
    expect(clerk.setClerkRole).toHaveBeenCalledWith("user_wait1", "driver");
    expect(repo.tcuReviewUser.mock.invocationCallOrder[0]).toBeLessThan(clerk.setClerkRole.mock.invocationCallOrder[0]);
    expect((await res.json()).data).toEqual({ id: "user_wait1", approval: "approved", role: "driver" });
  });

  it("needs a reason to turn someone down, and then leaves Clerk alone", async () => {
    const bad = await postReview(jsonRequest("POST", path, { decision: "rejected" }), target("user_wait1"));
    expect(bad.status).toBe(422);
    expect((await bad.json()).errors).toEqual([expect.objectContaining({ path: "note" })]);

    const res = await postReview(
      jsonRequest("POST", path, { decision: "rejected", note: "Could not confirm the company" }),
      target("user_wait1"),
    );
    expect(res.status).toBe(200);
    expect(clerk.setClerkRole).not.toHaveBeenCalled();
  });

  it("is 409 when TCU reviews its own account", async () => {
    const res = await postReview(jsonRequest("POST", path, { decision: "approved" }), target("user_admin1"));
    expect(res.status).toBe(409);
  });

  it("is 503 with 'send it again' when Clerk fails after the approval", async () => {
    clerk.setClerkRole.mockRejectedValue(new ServiceUnavailableError());
    const res = await postReview(jsonRequest("POST", path, { decision: "approved" }), target("user_wait1"));

    expect(res.status).toBe(503);
    expect((await res.json()).detail).toMatch(/again/);
  });

  it("refuses unknown fields and bad decisions with 422", async () => {
    for (const body of [{ decision: "maybe" }, { decision: "approved", role: "admin" }]) {
      const res = await postReview(jsonRequest("POST", path, body), target("user_wait1"));
      expect(res.status).toBe(422);
    }
  });
});

describe("PATCH /api/v1/me", () => {
  const patch = (body: unknown) => patchMe(jsonRequest("PATCH", "/api/v1/me", body), noParams);

  it("is 401 signed out and 422 for an empty or unknown change", async () => {
    expect((await patch({ language: "hi" })).status).toBe(401);
    fakeCaller = { userId: "user_new1", role: "driver" };
    expect((await patch({})).status).toBe(422);
    expect((await patch({ role: "admin" })).status).toBe(422);
    expect((await patch({ consent_version: "1999-01-01" })).status).toBe(422);
    expect((await patch({ language: "fr" })).status).toBe(422);
    expect(repo.updateOwnUser).not.toHaveBeenCalled();
  });

  it("records the privacy notice version when location sharing goes on", async () => {
    fakeCaller = { userId: "user_new1", role: "driver" };
    repo.updateOwnUser.mockResolvedValue(true);
    repo.findUser.mockResolvedValue({ ...DRIVER_ROW, location_consent: true });
    const res = await patch({ location_consent: true, display_name: "  Bashir  " });
    expect(res.status).toBe(200);
    const [, id, change] = repo.updateOwnUser.mock.calls[0];
    expect(id).toBe("user_new1");
    expect(change).toEqual({ location_consent: true, consent_version: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), display_name: "Bashir" });
  });

  it("turning sharing off keeps the old version; null clears the name", async () => {
    fakeCaller = { userId: "user_new1", role: "driver" };
    repo.updateOwnUser.mockResolvedValue(true);
    repo.findUser.mockResolvedValue(DRIVER_ROW);
    await patch({ location_consent: false, display_name: null });
    expect(repo.updateOwnUser.mock.calls[0][2]).toEqual({ location_consent: false, display_name: null });
  });

  it("is 409 before onboarding", async () => {
    fakeCaller = { userId: "user_new1", role: null };
    repo.updateOwnUser.mockResolvedValue(false);
    expect((await patch({ language: "ur" })).status).toBe(409);
  });
});

describe("DELETE /api/v1/me", () => {
  const del = (body: unknown) => deleteMe(jsonRequest("DELETE", "/api/v1/me", body), noParams);

  it("needs the confirm word", async () => {
    fakeCaller = { userId: "user_new1", role: "driver" };
    expect((await del({})).status).toBe(422);
    expect((await del({ confirm: "yes" })).status).toBe(422);
    expect(repo.deleteOwnAccount).not.toHaveBeenCalled();
  });

  it("deletes the data, then the photos, then the Clerk account", async () => {
    fakeCaller = { userId: "user_new1", role: "driver" };
    const order: string[] = [];
    repo.deleteOwnAccount.mockImplementation(async () => {
      order.push("db");
      return ["user_new1/a.webp", "user_new1/b.webp"];
    });
    storage.removePhoto.mockImplementation(async (p) => void order.push(`photo ${p}`));
    clerk.deleteClerkUser.mockImplementation(async () => void order.push("clerk"));
    const res = await del({ confirm: "DELETE" });
    expect(res.status).toBe(204);
    expect(order).toEqual(["db", "photo user_new1/a.webp", "photo user_new1/b.webp", "clerk"]);
    expect(clerk.deleteClerkUser).toHaveBeenCalledWith("user_new1");
    expect(repo.deleteOwnAccount.mock.calls[0][2]).toBe(res.headers.get("X-Request-Id"));
  });

  it("still deletes the account when a photo can't be removed", async () => {
    fakeCaller = { userId: "user_new1", role: "driver" };
    repo.deleteOwnAccount.mockResolvedValue(["user_new1/a.webp"]);
    storage.removePhoto.mockRejectedValue(new Error("storage down"));
    clerk.deleteClerkUser.mockResolvedValue(undefined);
    expect((await del({ confirm: "DELETE" })).status).toBe(204);
    expect(clerk.deleteClerkUser).toHaveBeenCalled();
  });

  it("says so when Clerk fails after the data is gone (503, safe to retry)", async () => {
    fakeCaller = { userId: "user_new1", role: "driver" };
    repo.deleteOwnAccount.mockResolvedValue([]);
    clerk.deleteClerkUser.mockRejectedValue(new ServiceUnavailableError());
    const res = await del({ confirm: "DELETE" });
    expect(res.status).toBe(503);
    expect((await res.json()).detail).toContain("Try again");
  });
});

