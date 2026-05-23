import { and, eq, processedEvents } from "./index.js";
import type { DbClient } from "./client.js";

/**
 * Returns true if this (handlerId, traceId) pair is being seen for the first time
 * and records it atomically. Returns false if it was already processed.
 *
 * Uses a SELECT first then INSERT — safe for SQLite which serialises all writes.
 */
export async function claimEvent(
  db: DbClient,
  handlerId: string,
  traceId: string,
): Promise<boolean> {
  // Check if already processed
  const existing = await db
    .select({ traceId: processedEvents.traceId })
    .from(processedEvents)
    .where(and(eq(processedEvents.handlerId, handlerId), eq(processedEvents.traceId, traceId)));

  if (existing.length > 0) return false;

  try {
    await db
      .insert(processedEvents)
      .values({ handlerId, traceId, processedAt: new Date() });
    return true;
  } catch {
    // Concurrent insert (PRIMARY KEY conflict) — already processed
    return false;
  }
}
