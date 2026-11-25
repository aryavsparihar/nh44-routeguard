import "server-only";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { clerkClient } from "@clerk/nextjs/server";
import type { Role } from "@/src/server/http/caller";
import { NotFoundError, ServiceUnavailableError } from "@/src/server/http/errors";
import { logger } from "@/src/server/http/logger";

// Clerk is where the role lives for the session token: publicMetadata.role
// becomes the metadata.role claim (docs/runbook.md). Our users.role mirrors
// it. Only the server can write publicMetadata, with CLERK_SECRET_KEY.

function isClerkNotFound(error: unknown): boolean {
  return isClerkAPIResponseError(error) && error.status === 404;
}

// Any other Clerk failure is "try again later". The log keeps only the HTTP
// status: Clerk's error text can quote the user's email.
function clerkUnavailable(error: unknown): ServiceUnavailableError {
  const status = isClerkAPIResponseError(error) ? error.status : null;
  logger.warn({ clerk_status: status }, "Clerk call failed");
  return new ServiceUnavailableError("Clerk is not reachable right now. Try again soon.");
}

export async function clerkUserExists(userId: string): Promise<boolean> {
  try {
    const clerk = await clerkClient();
    await clerk.users.getUser(userId);
    return true;
  } catch (error) {
    if (isClerkNotFound(error)) return false;
    throw clerkUnavailable(error);
  }
}

// Sets publicMetadata.role and leaves any other metadata alone (Clerk
// deep-merges). The user's current token keeps the old role until it
// refreshes, which takes up to about a minute.
export async function setClerkRole(userId: string, role: Role): Promise<void> {
  try {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, { publicMetadata: { role } });
  } catch (error) {
    if (isClerkNotFound(error)) throw new NotFoundError("No user with this id.");
    throw clerkUnavailable(error);
  }
}

// Deletes the sign-in account (email and sessions). Already gone counts as done.
export async function deleteClerkUser(userId: string): Promise<void> {
  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);
  } catch (error) {
    if (isClerkNotFound(error)) return;
    throw clerkUnavailable(error);
  }
}

// The sign-in email of each account TCU is reviewing, so TCU knows who is
// asking. Only TCU's approvals list calls this (docs/guardrails.md section 3).
export async function clerkEmails(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  try {
    const clerk = await clerkClient();
    const { data } = await clerk.users.getUserList({ userId: userIds, limit: userIds.length });
    const emails: Record<string, string> = {};
    for (const user of data) {
      const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
      if (email) emails[user.id] = email;
    }
    return emails;
  } catch (error) {
    throw clerkUnavailable(error);
  }
}
