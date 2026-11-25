import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import type { Db } from "@/src/server/db";
import { userRole, users } from "@/src/server/db/schema";
import type { Role } from "@/src/server/http/caller";
import { DbError } from "@/src/server/http/db-errors";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/src/server/http/errors";

// Database calls for users. Every call runs as the caller (getDb().rls()),
// so RLS decides what each one may read or write (docs/security.md).

const profileColumns = {
  id: users.id,
  role: users.role,
  display_name: users.display_name,
  language: users.language,
  verification_level: users.verification_level,
  location_consent: users.location_consent,
  consent_version: users.consent_version,
  agent_id: users.agent_id,
  approval: users.approval,
  review_note: users.review_note,
};
export type Approval = "pending" | "approved" | "rejected";
export type UserProfile = {
  id: string;
  role: Role;
  display_name: string | null;
  language: string;
  verification_level: (typeof users.$inferSelect)["verification_level"];
  location_consent: boolean;
  consent_version: string | null;
  agent_id: string | null;
  approval: Approval;
  review_note: string | null;
};

// RLS lets you read your own row (and admins read all), so this returns null
// both for "no row" and "not yours".
export async function findUser(db: Db, id: string): Promise<UserProfile | null> {
  const rows = await db.rls((tx) => tx.select(profileColumns).from(users).where(eq(users.id, id)).limit(1));
  return rows[0] ?? null;
}

export type NewOwnUser = {
  id: string;
  role: Role;
  display_name?: string;
  language?: string;
};

// Signed-in users may insert only these columns of public.users (column
// grants in 20261124160007_rls_policies.sql). Drizzle names every column of
// a table in an INSERT, so a self-signup goes through this narrower view of
// the same table; the database fills the rest with its defaults.
export const ownUserInsert = pgTable("users", {
  id: text().primaryKey(),
  role: userRole().notNull(),
  display_name: text(),
  language: text(),
});

// Creates your own row. The RLS insert policy only allows your own id and a
// self-service role. Returns "exists" when you already have a row.
export async function insertOwnUser(db: Db, row: NewOwnUser): Promise<"created" | "exists"> {
  try {
    await db.rls((tx) =>
      tx.insert(ownUserInsert).values({
        id: row.id,
        role: row.role,
        display_name: row.display_name,
        language: row.language ?? sql`default`,
      }),
    );
    return "created";
  } catch (err) {
    if (err instanceof DbError && err.code === "23505") return "exists"; // primary key taken
    throw err;
  }
}

// Calls the admin_set_role database function (role change + audit row in one
// transaction). Returns the old role, or null if the user had no row.
export async function adminSetRole(
  db: Db,
  args: { targetId: string; role: Role; reason: string; requestId: string },
): Promise<Role | null> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ old_role: Role | null }>(
        sql`select public.admin_set_role(${args.targetId}::text, ${args.role}::public.user_role,
          ${args.reason}::text, ${args.requestId}::text) as old_role`,
      ),
    );
    return rows[0]?.old_role ?? null;
  } catch (err) {
    // The route checks these first, so they only happen if that check is
    // bypassed. The database is the second lock.
    if (err instanceof DbError && err.code === "42501") {
      throw new ForbiddenError("Only TCU can change roles, and TCU or police roles can't be given.");
    }
    if (err instanceof DbError && err.code === "22023") {
      throw new ValidationError([{ path: "reason", message: "A reason of 1 to 500 characters is required." }]);
    }
    throw err;
  }
}

// The accounts waiting for TCU (or rejected), oldest first. Only TCU can
// read other people's rows (RLS "Admins read all users").
export type ReviewRow = {
  id: string;
  role: Role;
  display_name: string | null;
  verification_level: (typeof users.$inferSelect)["verification_level"];
  approval: Approval;
  review_note: string | null;
  reviewed_at: Date | null;
  created_at: Date;
};

export async function listUsersByApproval(db: Db, approval: "pending" | "rejected"): Promise<ReviewRow[]> {
  return db.rls((tx) =>
    tx
      .select({
        id: users.id,
        role: users.role,
        display_name: users.display_name,
        verification_level: users.verification_level,
        approval: users.approval,
        review_note: users.review_note,
        reviewed_at: users.reviewed_at,
        created_at: users.created_at,
      })
      .from(users)
      .where(sql`${users.approval} = ${approval} and ${users.deleted_at} is null`)
      .orderBy(asc(users.created_at))
      .limit(200),
  );
}

// Calls tcu_review_user (decision + audit row in one transaction). Returns
// the user's role, which the service then puts into Clerk on approval.
export async function tcuReviewUser(
  db: Db,
  args: { targetId: string; decision: "approved" | "rejected"; note: string | null; requestId: string },
): Promise<Role> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ role: Role }>(
        sql`select public.tcu_review_user(${args.targetId}::text, ${args.decision}::public.approval_status,
          ${args.note}::text, ${args.requestId}::text) as role`,
      ),
    );
    const role = rows[0]?.role;
    if (!role) throw new NotFoundError("No account waiting with this id.");
    return role;
  } catch (err) {
    if (err instanceof DbError && err.code === "42501") {
      throw new ForbiddenError("Only TCU can review accounts, and TCU accounts aren't reviewed here.");
    }
    if (err instanceof DbError && err.code === "22023") {
      throw new ValidationError([{ path: "note", message: "A rejection needs a reason of 1 to 500 characters." }]);
    }
    if (err instanceof DbError && err.code === "P0002") throw new NotFoundError("No account with this id.");
    if (err instanceof DbError && err.code === "55000") throw new ConflictError("This account is already approved.");
    throw err;
  }
}

// Your own name, language and location sharing (column grants allow only
// display_name, language, location_consent and consent_version). Returns
// false when you have no row yet.
export async function updateOwnUser(
  db: Db,
  id: string,
  patch: { display_name?: string | null; language?: string; location_consent?: boolean; consent_version?: string },
): Promise<boolean> {
  const rows = await db.rls((tx) =>
    tx.update(users).set(patch).where(eq(users.id, id)).returning({ id: users.id }),
  );
  return rows.length > 0;
}

// private.delete_my_account: removes your row (shipments, invites and
// confirmations go with it; reports stay without your id), writes the audit
// row, and returns the storage paths of your report photos for us to remove.
export async function deleteOwnAccount(db: Db, rulesJson: string, requestId: string): Promise<string[]> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ photo_path: string }>(
        sql`select * from private.delete_my_account(${rulesJson}::jsonb, ${requestId}::text)`,
      ),
    );
    return rows.map((r) => r.photo_path);
  } catch (err) {
    if (err instanceof DbError && err.code === "55000") {
      throw new ConflictError("TCU accounts are removed by the operator.");
    }
    throw err;
  }
}
