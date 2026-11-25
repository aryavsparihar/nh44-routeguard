import "server-only";
import { clerkUserExists, deleteClerkUser, setClerkRole } from "@/src/server/clerk/users";
import type { Db } from "@/src/server/db";
import type { Caller, Role } from "@/src/server/http/caller";
import { ConflictError, NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";
import type { Logger } from "pino";
import { removePhoto } from "@/src/server/reports/storage";
import { REPORT_RULES_JSON } from "@/src/server/reports/rules";
import { PRIVACY_VERSION } from "@/src/shared/consent";
import type { OnboardingInput, PatchMeInput, RoleChangeInput } from "./users.schemas";
import { adminSetRole, deleteOwnAccount, findUser, insertOwnUser, updateOwnUser, type UserProfile } from "./users.repository";

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
  location_consent: boolean;
  consent_version: string | null;
  agent_id: string | null;
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
      location_consent: false,
      consent_version: null,
      agent_id: null,
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

// Your own name, language and location sharing. Turning sharing on stores
// the privacy notice version you agreed to.
export async function updateMe(db: Db, caller: Caller, input: PatchMeInput): Promise<Me> {
  const patch = {
    ...(input.display_name !== undefined ? { display_name: input.display_name } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    ...(input.location_consent !== undefined ? { location_consent: input.location_consent } : {}),
    ...(input.location_consent === true ? { consent_version: PRIVACY_VERSION } : {}),
  };
  if (!(await updateOwnUser(db, caller.userId, patch))) {
    throw new ConflictError("Pick your role first (POST /api/v1/me/onboarding).");
  }
  return getMe(db, caller);
}

// Deletes your account: first the database (row, audit entry, photo paths),
// then the photos in Storage (with your still-valid session), then the Clerk
// account. If Clerk fails, sending DELETE again finishes the job.
export async function deleteMe(db: Db, caller: Caller, requestId: string, log: Logger): Promise<void> {
  const paths = await deleteOwnAccount(db, REPORT_RULES_JSON, requestId);
  for (const path of paths) {
    await removePhoto(path).catch(() => log.warn("could not remove a photo of a deleted account"));
  }
  try {
    await deleteClerkUser(caller.userId);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw new ServiceUnavailableError("Your data was deleted, but the sign-in account wasn't. Try again.");
    }
    throw error;
  }
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
