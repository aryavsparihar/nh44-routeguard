import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { agentInvites, users } from "@/src/server/db/schema";
import { DbError } from "@/src/server/http/db-errors";
import { ConflictError, ForbiddenError, NotFoundError, RateLimitError } from "@/src/server/http/errors";

// An agent's fleet. The writes are database functions (private schema) that
// check the caller's role from the token: create_agent_invite,
// accept_agent_invite, vouch_driver.

function mapFleetError(err: unknown, notFound: string): never {
  if (err instanceof DbError) {
    if (err.code === "42501") throw new ForbiddenError("Your role can't do this.");
    if (err.code === "P0002") throw new NotFoundError(notFound);
    if (err.code === "55000") throw new ConflictError("This invite code was already used or has expired. Ask your agent for a new one.");
    if (err.code === "23503") {
      throw new ConflictError("Your account has no RouteGuard profile yet. Finish onboarding first.");
    }
    if (err.code === "54000") throw new RateLimitError(3600);
  }
  throw err;
}

export async function createInvite(db: Db, days: number): Promise<{ code: string; expires_at: Date }> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ code: string; expires_at: string }>(sql`select * from private.create_agent_invite(${days}::integer)`),
    );
    return { code: rows[0].code, expires_at: new Date(rows[0].expires_at) };
  } catch (err) {
    mapFleetError(err, "Not found.");
  }
}

// The agent's own codes, newest first (RLS: agents read only their own).
export async function listInvites(db: Db) {
  return db.rls((tx) =>
    tx
      .select({
        code: agentInvites.code,
        created_at: agentInvites.created_at,
        expires_at: agentInvites.expires_at,
        accepted_at: agentInvites.accepted_at,
        accepted_by_name: users.display_name,
      })
      .from(agentInvites)
      .leftJoin(users, eq(users.id, agentInvites.accepted_by))
      .orderBy(desc(agentInvites.created_at))
      .limit(50),
  );
}

export async function acceptInvite(db: Db, code: string): Promise<{ agent_id: string; outcome: "joined" | "repeat" }> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ agent_id: string; outcome: "joined" | "repeat" }>(
        sql`select * from private.accept_agent_invite(${code}::text)`,
      ),
    );
    return rows[0];
  } catch (err) {
    mapFleetError(err, "No invite with this code.");
  }
}

// The drivers in the caller's fleet (RLS "Agents read their drivers").
export async function listDrivers(db: Db, agentId: string) {
  return db.rls((tx) =>
    tx
      .select({
        id: users.id,
        display_name: users.display_name,
        verification_level: users.verification_level,
        location_consent: users.location_consent,
      })
      .from(users)
      .where(and(eq(users.agent_id, agentId), eq(users.role, "driver")))
      .orderBy(users.display_name),
  );
}

export async function vouchDriver(
  db: Db,
  driverId: string,
  requestId: string,
): Promise<{ verification_level: string; outcome: "vouched" | "repeat" }> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ verification_level: string; outcome: "vouched" | "repeat" }>(
        sql`select * from private.vouch_driver(${driverId}::text, ${requestId}::text)`,
      ),
    );
    return rows[0];
  } catch (err) {
    mapFleetError(err, "No driver with this id in your fleet.");
  }
}
