import "server-only";
import { clerkEmails, clerkUserExists, deleteClerkUser, setClerkRole } from "@/src/server/clerk/users";
import type { Db } from "@/src/server/db";
import type { Caller, Role } from "@/src/server/http/caller";
import { ConflictError, NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";
import type { Logger } from "pino";
import { removePhoto } from "@/src/server/reports/storage";
import { REPORT_RULES_JSON } from "@/src/server/reports/rules";
import { PRIVACY_VERSION } from "@/src/shared/consent";
import type { OnboardingInput, PatchMeInput, ReviewInput, RoleChangeInput } from "./users.schemas";
import {
  adminSetRole,
  deleteOwnAccount,
  findUser,
  insertOwnUser,
  listUsersByApproval,
  tcuReviewUser,
  updateOwnUser,
  type Approval,
  type UserProfile,
} from "./users.repository";

// Every account waits for TCU (20261126040000_tcu_approval.sql). Onboarding
// only saves the role the person asked for, as 'pending'; the role reaches
// the Clerk token when TCU approves (reviewUser). Until then the token has no
// role, so the API and the database treat the account as signed in, no role.
//
// The order of writes, for the flows that touch Clerk: the database first, then Clerk.
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
  approval: Approval | null;
  review_note: string | null;
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
      approval: null,
      review_note: null,
      onboarded: false,
    };
  }
  return { ...row, onboarded: true };
}

// A signed-in user asks for grower, trader, agent or driver, once. The row
// starts 'pending' (the database forces it); nothing goes to Clerk until TCU
// approves.
export async function onboard(
  db: Db,
  caller: Caller,
  input: OnboardingInput,
): Promise<{ me: Me; created: boolean }> {
  if (caller.role) {
    throw new ConflictError("You already have a role. Ask TCU to change it.");
  }

  const result = await insertOwnUser(db, {
    id: caller.userId,
    role: input.role,
    display_name: input.display_name,
    language: input.language,
  });

  if (result === "exists") {
    // Sending the same request again is fine; asking for another role isn't.
    const existing = await findUser(db, caller.userId);
    if (!existing || existing.role !== input.role) {
      throw new ConflictError("You already asked for a role. Ask TCU to change it.");
    }
  }

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

// TCU moves an approved user between the self-service roles, with a reason.
export async function changeRole(
  db: Db,
  caller: Caller,
  targetId: string,
  input: RoleChangeInput,
  requestId: string,
): Promise<{ id: string; old_role: Role | null; role: Role }> {
  if (targetId === caller.userId) {
    throw new ConflictError("TCU can't change its own role.");
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

// TCU's list of accounts to review, with each sign-in email so TCU knows who
// is asking. Emails come from Clerk and are never stored by us.
export async function listForReview(db: Db, approval: "pending" | "rejected") {
  const rows = await listUsersByApproval(db, approval);
  const emails = await clerkEmails(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, email: emails[r.id] ?? null }));
}

// TCU approves or rejects. Database first (decision + audit row), then, on
// approval, Clerk, so the role reaches the person's token. If Clerk fails,
// sending the same approval again finishes the job (the database treats it
// as a repeat).
export async function reviewUser(
  db: Db,
  caller: Caller,
  targetId: string,
  input: ReviewInput,
  requestId: string,
): Promise<{ id: string; approval: "approved" | "rejected"; role: Role }> {
  if (targetId === caller.userId) {
    throw new ConflictError("TCU can't review its own account.");
  }
  const role = await tcuReviewUser(db, {
    targetId,
    decision: input.decision,
    note: input.note ?? null,
    requestId,
  });
  if (input.decision === "approved") {
    try {
      await setClerkRole(targetId, role);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        throw new ServiceUnavailableError("Approved, but Clerk didn't update. Send the same approval again.");
      }
      throw error;
    }
  }
  return { id: targetId, approval: input.decision, role };
}
