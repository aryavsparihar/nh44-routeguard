import "server-only";
import type { Database } from "@/lib/database.types";
import type { Db } from "@/src/server/db";
import type { Role } from "@/src/server/http/caller";
import { dbError } from "@/src/server/http/db-errors";
import { ForbiddenError, ValidationError } from "@/src/server/http/errors";

// Database calls for users. Every call runs with the caller's Clerk token,
// so RLS decides what each one may read or write (docs/security.md).

const PROFILE_COLUMNS = "id, role, display_name, language, verification_level";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
export type UserProfile = Pick<UserRow, "id" | "role" | "display_name" | "language" | "verification_level">;

// RLS lets you read your own row (and admins read all), so this returns null
// both for "no row" and "not yours".
export async function findUser(db: Db, id: string): Promise<UserProfile | null> {
  const { data, error, status } = await db
    .from("users")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw dbError(error, status);
  return data;
}

export type NewOwnUser = {
  id: string;
  role: Role;
  display_name?: string;
  language?: string;
};

// Creates your own row. The RLS insert policy only allows your own id and a
// self-service role. Returns "exists" when you already have a row.
export async function insertOwnUser(db: Db, row: NewOwnUser): Promise<"created" | "exists"> {
  const { error, status } = await db.from("users").insert(row);
  if (!error) return "created";
  if (error.code === "23505") return "exists"; // unique_violation on the primary key
  throw dbError(error, status);
}

// Calls the admin_set_role database function (role change + audit row in one
// transaction). Returns the old role, or null if the user had no row.
export async function adminSetRole(
  db: Db,
  args: { targetId: string; role: Role; reason: string; requestId: string },
): Promise<Role | null> {
  const { data, error, status } = await db.rpc("admin_set_role", {
    p_target: args.targetId,
    p_role: args.role,
    p_reason: args.reason,
    p_request_id: args.requestId,
  });
  if (error) {
    // The route checks these first, so they only happen if that check is
    // bypassed. The database is the second lock.
    if (error.code === "42501") throw new ForbiddenError("Only an admin can change another user's role.");
    if (error.code === "22023") {
      throw new ValidationError([{ path: "reason", message: "A reason of 1 to 500 characters is required." }]);
    }
    throw dbError(error, status);
  }
  return data ?? null;
}
