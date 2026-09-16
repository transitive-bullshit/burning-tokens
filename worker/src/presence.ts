import { metric } from './metrics'
import { DurableObject } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/durable-sqlite'
import { migrate } from 'drizzle-orm/durable-sqlite/migrator'
import { and, asc, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { summaries } from './db/schema'
import { presenceMigrations } from './db/migrations'
import { type PresenceSummary } from '../../lib/retreat/protocol'
import type { Env } from './env'
import { storePresence } from './presence-store'
import {
  ACTIVE_WINDOW_MS,
  isRecentPresence,
  roomSampleBudgets
} from '../../lib/retreat/presence-policy'

export class RetreatPresence extends DurableObject<Env> {
  private db
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.db = drizzle(ctx.storage)
    void ctx.blockConcurrencyWhile(() => migrate(this.db, presenceMigrations))
  }
  async upsert(value: PresenceSummary) {
    const now = Date.now()
    let evicted = 0
    const stored = storePresence(this.db, value, now, (count) => {
      evicted = count
    })
    metric(this.env, {
      event: 'presence_update',
      outcome: stored ? 'ok' : 'ignored'
    })
    if (evicted)
      metric(this.env, { event: 'presence_eviction', amount: evicted })
    if (!stored) return
    await this.ctx.storage.setAlarm(now + 60_000)
  }
  snapshot(room?: string) {
    const now = Date.now()
    const active = and(
      eq(summaries.eligible, true),
      gt(summaries.expiresAt, now),
      sql`(${summaries.lastSeen} > ${now - ACTIVE_WINDOW_MS} OR json_extract(${summaries.value}, '$.restUntil') > ${now})`
    )
    const where = room ? and(active, eq(summaries.room, room)) : active
    const count =
      this.db
        .select({ total: sql<number>`count(*)` })
        .from(summaries)
        .where(where)
        .get()?.total ?? 0
    const groups = this.db
      .select({ room: summaries.room, count: sql<number>`count(*)` })
      .from(summaries)
      .where(active)
      .groupBy(summaries.room)
      .all()
    const rows = room
      ? this.db
          .select({ value: summaries.value })
          .from(summaries)
          .where(where)
          .orderBy(asc(summaries.id))
          .limit(100)
          .all()
      : roomSampleBudgets(groups, 300).flatMap(({ room: groupRoom, budget }) =>
          budget === 0
            ? []
            : this.db
                .select({ value: summaries.value })
                .from(summaries)
                .where(
                  and(
                    active,
                    groupRoom === null
                      ? isNull(summaries.room)
                      : eq(summaries.room, groupRoom)
                  )
                )
                .orderBy(asc(summaries.id))
                .limit(budget)
                .all()
        )
    return {
      generatedAt: now,
      total: count,
      shown: rows.length,
      sampled: count > rows.length,
      rooms: groups,
      visitors: rows.map(({ value }) => this.publicValue(value))
    }
  }
  detail(id: string) {
    const row = this.db
      .select()
      .from(summaries)
      .where(eq(summaries.id, id))
      .get()
    const now = Date.now()
    if (
      !row ||
      !row.eligible ||
      row.expiresAt <= now ||
      !isRecentPresence(row.value.lastSeen, row.value.restUntil, now)
    )
      return null
    return this.publicValue(row.value)
  }
  private publicValue(value: PresenceSummary) {
    return {
      publicId: value.publicId,
      avatarSeed: value.avatarSeed,
      family: value.family,
      room: value.room,
      lifecycle: value.lifecycle,
      revision: value.revision,
      lastSeen: value.lastSeen
        ? Math.floor(value.lastSeen / 60_000) * 60_000
        : null,
      restUntil: value.restUntil
        ? Math.ceil(value.restUntil / 60_000) * 60_000
        : null,
      country: value.country
    }
  }
  async alarm() {
    this.db.delete(summaries).where(lt(summaries.expiresAt, Date.now())).run()
    if (this.db.select({ id: summaries.id }).from(summaries).limit(1).get())
      await this.ctx.storage.setAlarm(Date.now() + 60_000)
  }
}
