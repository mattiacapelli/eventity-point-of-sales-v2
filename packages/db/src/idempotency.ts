import { and, eq, processedEvents, sql } from "./index.js";
import type { DbClient } from "./client.js";

/**
 * Returns true if this (handlerId, traceId) pair is being seen for the first time
 * and records it atomically. Returns false if it was already processed.
 *
 * Uses INSERT OR IGNORE so concurrent callers on the same SQLite connection are safe
 * (SQLite serialises writes; the second insert is a no-op and affects 0 rows).
 */
export async function claimEvent(
  db: DbClient,
  handlerId: string,
  traceId: string,
): Promise<boolean> {
  const result = await db
    .insert(processedEvents)
    .values({ handlerId, traceId, processedAt: new Date() })
    .onConflictDoNothing();

  // drizzle returns { rowsAffected: number } for SQLite inserts
  return (result as unknown as { rowsAffected: number }).rowsAffected > 0;
}
