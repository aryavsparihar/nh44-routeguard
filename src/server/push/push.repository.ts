import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/src/server/db";
import { pushSubscriptions } from "@/src/server/db/schema";
import { DbError } from "@/src/server/http/db-errors";
import { ConflictError, ForbiddenError, ValidationError } from "@/src/server/http/errors";
import type { SubscriptionInput } from "./push.schemas";

// ---------------------------------------------------------------------------
// Signed-in users: their own browsers (RLS: read and delete your own rows;
// add or change only through private.save_push_subscription).
// ---------------------------------------------------------------------------

export async function saveSubscription(db: Db, input: SubscriptionInput): Promise<{ id: string }> {
  try {
    const rows = await db.rls((tx) =>
      tx.execute<{ id: string }>(
        sql`select private.save_push_subscription(${input.endpoint}::text, ${JSON.stringify(input.keys)}::jsonb,
          ${`{${input.zones.join(",")}}`}::smallint[], ${input.language}::text) as id`,
      ),
    );
    return { id: rows[0].id };
  } catch (err) {
    if (err instanceof DbError) {
      if (err.code === "42501") throw new ForbiddenError("Pick your role on the account page before turning alerts on.");
      if (err.code === "22023") throw new ValidationError([{ path: "zones", message: "Unknown zone." }]);
      if (err.code === "23P01") throw new ConflictError("Alerts are on in 10 browsers already. Turn one off first.");
    }
    throw err;
  }
}

export async function listMySubscriptions(db: Db) {
  return db.rls((tx) =>
    tx
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        zones: pushSubscriptions.zones,
        language: pushSubscriptions.language,
        created_at: pushSubscriptions.created_at,
        updated_at: pushSubscriptions.updated_at,
      })
      .from(pushSubscriptions)
      .orderBy(desc(pushSubscriptions.created_at)),
  );
}

// Deleting a row that isn't yours, or isn't there, deletes nothing (RLS).
export async function deleteSubscription(db: Db, endpoint: string): Promise<number> {
  const rows = await db.rls((tx) =>
    tx.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).returning({ id: pushSubscriptions.id }),
  );
  return rows.length;
}

// ---------------------------------------------------------------------------
// The queue worker (routeguard_worker): only the private push functions.
// ---------------------------------------------------------------------------

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string }; language: string };

export type PushStore = {
  report(id: string): Promise<{ zone_id: number | null; hazard_type: string } | null>;
  update(id: string): Promise<{ zone_id: number | null; kind: string; title: string; source_name: string } | null>;
  targets(eventKey: string, zone: number | null): Promise<PushTarget[]>;
  markSent(eventKey: string): Promise<void>;
  drop(endpoint: string): Promise<void>;
};

export function dbPushStore(db: Db): PushStore {
  return {
    async report(id) {
      const rows = await db.rls((tx) =>
        tx.execute<{ zone_id: number | null; hazard_type: string }>(sql`select * from private.push_report(${id}::uuid)`),
      );
      return rows[0] ?? null;
    },
    async update(id) {
      const rows = await db.rls((tx) =>
        tx.execute<{ zone_id: number | null; kind: string; title: string; source_name: string }>(
          sql`select * from private.push_update(${id}::uuid)`,
        ),
      );
      return rows[0] ?? null;
    },
    async targets(eventKey, zone) {
      return db.rls((tx) =>
        tx.execute<PushTarget>(sql`select * from private.push_targets(${eventKey}::text, ${zone}::smallint)`),
      );
    },
    async markSent(eventKey) {
      await db.rls((tx) => tx.execute(sql`select private.mark_push_sent(${eventKey}::text)`));
    },
    async drop(endpoint) {
      await db.rls((tx) => tx.execute(sql`select private.drop_push_subscription(${endpoint}::text)`));
    },
  };
}
