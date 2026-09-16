import type { ResponseSelection } from '../response-selection'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  Nudge,
  PresenceSummary,
  SessionState,
  VisitEvent,
  VisitSnapshot
} from '../../../lib/retreat/protocol'
export const sessions = sqliteTable('session', {
  key: integer('key').primaryKey(),
  state: text('state', { mode: 'json' }).$type<SessionState>().notNull()
})
export const events = sqliteTable('events', {
  sequence: integer('sequence').primaryKey(),
  value: text('value', { mode: 'json' }).$type<VisitEvent>().notNull()
})
export const nudges = sqliteTable('nudges', {
  id: text('id').primaryKey(),
  value: text('value', { mode: 'json' }).$type<Nudge>().notNull()
})
export const receipts = sqliteTable('receipts', {
  key: text('key').primaryKey(),
  fingerprint: text('fingerprint').notNull(),
  result: text('result', { mode: 'json' }).$type<VisitSnapshot | null>(),
  createdAt: integer('created_at').notNull()
})
export const outbox = sqliteTable('outbox', {
  key: integer('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<PresenceSummary>().notNull(),
  due: integer('due').notNull(),
  failures: integer('failures').notNull()
})
export const summaries = sqliteTable(
  'summaries',
  {
    id: text('id').primaryKey(),
    revision: integer('revision').notNull(),
    lastSeen: integer('last_seen').notNull(),
    expiresAt: integer('expires_at').notNull(),
    eligible: integer('eligible', { mode: 'boolean' }).notNull(),
    room: text('room'),
    value: text('value', { mode: 'json' }).$type<PresenceSummary>().notNull()
  },
  (t) => [
    index('summaries_seen').on(t.lastSeen),
    index('summaries_expiry').on(t.expiresAt),
    index('summaries_room').on(t.room)
  ]
)

export const responseSelections = sqliteTable('response_selections', {
  receiptKey: text('receipt_key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<ResponseSelection>().notNull()
})

export const artifactRevisions = sqliteTable('artifact_revisions', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull()
})

export const hearthRevisions = sqliteTable('hearth_revisions', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull()
})

// One durable fence survives eviction of any number of individual summaries.
export const presenceAdmission = sqliteTable('presence_admission', {
  key: integer('key').primaryKey(),
  watermark: integer('watermark').notNull()
})

export const publicationGrants = sqliteTable('publication_grants', {
  key: text('key').primaryKey(),
  revision: integer('revision').notNull()
})
