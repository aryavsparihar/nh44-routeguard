import "server-only";
import { clerkUserExists, setClerkRole } from "@/src/server/clerk/users";
import type { Db } from "@/src/server/db";
import type { Caller, Role } from "@/src/server/http/caller";
import { ConflictError, NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";
import type { OnboardingInput, RoleChangeInput } from "./users.schemas";
import { adminSetRole, findUser, insertOwnUser, type UserProfile } from "./users.repository";

// The order of writes, for both flows below: the database first, then Clerk.
// RLS trusts the role in the Clerk token, so if Clerk went first and the
// database then failed, someone would hold the new role with no users row and
// no audit entry. Database first means a failure in between only leaves the
// token behind, and sending the same request again finishes the job.

export type Me = {
  id: string;
  role: Role | null;
  display_name: string | null;
  language: string | null;
  verification_level: UserProfile["verification_level"] | null;
  onboarded: boolean;
};

export async function getMe(db: Db, caller: Caller): Promise<Me> {
  const row = await findUser(db, caller.userId);
  if (!row) {
    return {
      id: caller.userId,
      role: null,
      display_name: null,
      language: null,
      verification_level: null,
      onboarded: false,
    };
  }
  return { ...row, onboarded: true };
}

// A signed-in user picks grower, trader, agent or driver, once.
export async function onboard(
  db: Db,
  caller: Caller,
  input: OnboardingInput,
): Promise<{ me: Me; created: boolean }> {
  if (caller.role) {
    throw new ConflictError("You already have a role. Ask an admin to change it.");
  }

  const result = await insertOwnUser(db, {
    id: caller.userId,
    role: input.role,
    display_name: input.display_name,
    language: input.language,
  });

  if (result === "exists") {
    // Either an earlier attempt saved the row but didn't reach Clerk (same
    // role: finish it), or the user is trying to switch roles (not allowed).
    const existing = await findUser(db, caller.userId);
    if (!existing || existing.role !== input.role) {
      throw new ConflictError("You already picked a role. Ask an admin to change it.");
    }
  }

  await setClerkRole(caller.userId, input.role);
  return { me: await getMe(db, caller), created: result === "created" };
}

// An admin sets any role, including police and admin, with a reason.
export async function changeRole(
  db: Db,
  caller: Caller,
  targetId: string,
  input: RoleChangeInput,
  requestId: string,
): Promise<{ id: string; old_role: Role | null; role: Role }> {
  if (targetId === caller.userId) {
    throw new ConflictError("You can't change your own role. Ask another admin.");
  }
  if (!(await clerkUserExists(targetId))) {
    throw new NotFoundError("No user with this id.");
  }

  const oldRole = await adminSetRole(db, {
    targetId,
    role: input.role,
    reason: input.reason,
    requestId,
  });

  try {
    await setClerkRole(targetId, input.role);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw new ServiceUnavailableError(
        "The role was saved but Clerk didn't update. Send the same request again.",
      );
    }
    throw error;
  }

  return { id: targetId, old_role: oldRole, role: input.role };
}
