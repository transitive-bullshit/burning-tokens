import type { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite'
import { asc, eq, inArray, lt, sql } from 'drizzle-orm'
import { isClosed, type PresenceSummary } from '../../lib/retreat/protocol'
import { presenceAdmission, summaries } from './db/schema'

export const PRESENCE_CAPACITY = 10_000

/** Atomic revision admission and bounded eviction; retries retain their original commit time. */
export function storePresence(
  db: DrizzleSqliteDODatabase,
  value: PresenceSummary,
  now: number
): boolean {
  if (value.expiresAt <= now) return false
  return db.transaction((tx) => {
    tx.delete(summaries).where(lt(summaries.expiresAt, now)).run()
    const current = tx
      .select()
      .from(summaries)
      .where(eq(summaries.id, value.publicId))
      .get()
    if (current && current.revision >= value.revision) return false
    const admission = tx
      .select()
      .from(presenceAdmission)
      .where(eq(presenceAdmission.key, 1))
      .get()
    if (!admission) throw new Error('Presence admission migration is missing')
    // Legacy records use zero. Once a legacy fence is evicted, only newly committed
    // updates may re-enter. A delayed retry must never get a fresh admission time.
    if (!current && (value.presenceChangedAt ?? 0) <= admission.watermark)
      return false
    const row = {
      id: value.publicId,
      revision: value.revision,
      lastSeen: value.lastSeen ?? 0,
      expiresAt: value.expiresAt,
      eligible:
        value.visible && !isClosed(value.lifecycle) && value.lastSeen !== null,
      room: value.room,
      value
    }
    tx.insert(summaries)
      .values(row)
      .onConflictDoUpdate({ target: summaries.id, set: row })
      .run()
    const count = tx
      .select({ total: sql<number>`count(*)` })
      .from(summaries)
      .get()!.total
    if (count > PRESENCE_CAPACITY) {
      const evicted = tx
        .select({ id: summaries.id, value: summaries.value })
        .from(summaries)
        .orderBy(
          asc(summaries.eligible),
          asc(summaries.lastSeen),
          asc(summaries.id)
        )
        .limit(count - PRESENCE_CAPACITY)
        .all()
      const watermark = Math.max(
        admission.watermark,
        ...evicted.map((entry) => entry.value.presenceChangedAt ?? 0)
      )
      tx.update(presenceAdmission)
        .set({ watermark })
        .where(eq(presenceAdmission.key, 1))
        .run()
      tx.delete(summaries)
        .where(
          inArray(
            summaries.id,
            evicted.map((entry) => entry.id)
          )
        )
        .run()
    }
    return true
  })
}
