import "server-only";
import { eq, sql } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";
import type { Db } from "@/src/server/db";
import { userRole, users } from "@/src/server/db/schema";
import type { Role } from "@/src/server/http/caller";
import { DbError } from "@/src/server/http/db-errors";
import { ForbiddenError, ValidationError } from "@/src/server/http/errors";

// Database calls for users. Every call runs as the caller (getDb().rls()),
// so RLS decides what each one may read or write (docs/security.md).

const profileColumns = {
  id: users.id,
  role: users.role,
  display_name: users.display_name,
  language: users.language,
  verification_level: users.verification_level,
};
export type UserProfile = {
  id: string;
  role: Role;
  display_name: string | null;
  language: string;
  verification_level: (typeof users.$inferSelect)["verification_level"];
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
      throw new ForbiddenError("Only an admin can change another user's role.");
    }
    if (err instanceof DbError && err.code === "22023") {
      throw new ValidationError([{ path: "reason", message: "A reason of 1 to 500 characters is required." }]);
    }
    throw err;
  }
}
