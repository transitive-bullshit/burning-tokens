import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { presenceDeliveryDue } from '../worker/src/presence-delivery.ts'
import { drizzle } from 'drizzle-orm/durable-sqlite'
import { presenceMigrations } from '../worker/src/db/migrations.ts'
import {
  storePresence,
  PRESENCE_CAPACITY
} from '../worker/src/presence-store.ts'

// Exercise the production Drizzle queries on SQLite. This adapter supplies only
// the synchronous SQL cursor/transaction surface used by the DO driver.
function fixture() {
  const sqlite = new DatabaseSync(':memory:')
  for (const entry of presenceMigrations.journal.entries)
    sqlite.exec(
      presenceMigrations.migrations[`m${String(entry.idx).padStart(4, '0')}`]
    )
  const db = drizzle({
    sql: {
      exec(query, ...params) {
        const statement = sqlite.prepare(query)
        const columns = statement.columns().map((column) => column.name)
        statement.setReturnArrays(true)
        const rows = statement.all(...params)
        const objects = rows.map((row) =>
          Object.fromEntries(columns.map((column, i) => [column, row[i]]))
        )
        return {
          toArray: () => objects,
          next: () => ({ value: objects[0] }),
          raw: () => ({ toArray: () => rows })
        }
      }
    },
    transactionSync(callback) {
      sqlite.exec('BEGIN')
      try {
        const result = callback()
        sqlite.exec('COMMIT')
        return result
      } catch (err) {
        sqlite.exec('ROLLBACK')
        throw err
      }
    }
  })
  return { db, sqlite }
}
const now = 1_000_000
function visitor(id, overrides = {}) {
  return {
    publicId: id,
    avatarSeed: 1,
    family: 'unknown',
    room: 'bathhouse',
    lifecycle: 'visiting',
    revision: 1,
    presenceChangedAt: now,
    expiresAt: now + 100_000,
    lastSeen: now,
    restUntil: null,
    visible: true,
    country: null,
    ...overrides
  }
}

await test('capacity eviction cannot resurrect a hidden or ended visit from an older update', () => {
  const { db, sqlite } = fixture()
  try {
    // Populate through SQL to keep setup fast; all contested writes use the real store.
    const insert = sqlite.prepare(
      'INSERT INTO summaries VALUES (?,?,?,?,?,?,?)'
    )
    for (let i = 0; i < PRESENCE_CAPACITY - 2; i++) {
      const value = visitor(`crowd-${i}`)
      insert.run(
        value.publicId,
        1,
        now,
        value.expiresAt,
        1,
        value.room,
        JSON.stringify(value)
      )
    }
    const hidden = visitor('hidden', {
      visible: false,
      revision: 3,
      presenceChangedAt: now + 10
    })
    const ended = visitor('ended', {
      lifecycle: 'ended',
      revision: 4,
      presenceChangedAt: now + 20
    })
    assert.equal(storePresence(db, hidden, now), true)
    assert.equal(storePresence(db, ended, now), true)
    assert.equal(
      storePresence(db, visitor('new-1', { presenceChangedAt: now + 30 }), now),
      true
    )
    assert.equal(
      storePresence(db, visitor('new-2', { presenceChangedAt: now + 31 }), now),
      true
    )
    assert.equal(
      sqlite
        .prepare(
          "SELECT count(*) AS n FROM summaries WHERE id IN ('hidden','ended')"
        )
        .get().n,
      0
    )
    assert.equal(
      storePresence(
        db,
        visitor('hidden', { revision: 2, presenceChangedAt: now + 9 }),
        now
      ),
      false
    )
    assert.equal(
      storePresence(
        db,
        visitor('ended', { revision: 3, presenceChangedAt: now + 19 }),
        now
      ),
      false
    )
    // Newer admission remains possible; the fence does not permanently ban an ID.
    assert.equal(
      storePresence(
        db,
        visitor('hidden', { revision: 4, presenceChangedAt: now + 40 }),
        now
      ),
      true
    )
    // Existing entries still use per-ID revisions, regardless of the global cutoff.
    assert.equal(
      storePresence(
        db,
        visitor('crowd-999', { revision: 2, presenceChangedAt: now + 1 }),
        now
      ),
      true
    )
    assert.equal(storePresence(db, visitor('crowd-999'), now), false)
    assert.equal(
      sqlite.prepare('SELECT count(*) AS n FROM summaries').get().n,
      PRESENCE_CAPACITY
    )
    assert.equal(
      sqlite.prepare('SELECT count(*) AS n FROM presence_admission').get().n,
      1
    )
    assert.equal(
      storePresence(db, visitor('expired', { expiresAt: now }), now),
      false
    )
  } finally {
    sqlite.close()
  }
})

await test('legacy evicted records require a new stamped commit', () => {
  const { db, sqlite } = fixture()
  try {
    assert.equal(
      storePresence(
        db,
        visitor('legacy', { presenceChangedAt: undefined }),
        now
      ),
      true
    )
    // Simulate the persisted state after a legacy fence was evicted.
    sqlite.exec(
      'DELETE FROM summaries; UPDATE presence_admission SET watermark = 0'
    )
    assert.equal(
      storePresence(
        db,
        visitor('legacy', { presenceChangedAt: undefined }),
        now
      ),
      false
    )
    assert.equal(
      storePresence(db, visitor('legacy', { revision: 2 }), now),
      true
    )
  } finally {
    sqlite.close()
  }
})

await test('admission migration preserves existing presence rows', () => {
  const sqlite = new DatabaseSync(':memory:')
  try {
    sqlite.exec(presenceMigrations.migrations.m0000)
    const value = visitor('existing', { presenceChangedAt: undefined })
    sqlite
      .prepare('INSERT INTO summaries VALUES (?,?,?,?,?,?,?)')
      .run(
        value.publicId,
        1,
        now,
        value.expiresAt,
        1,
        value.room,
        JSON.stringify(value)
      )
    sqlite.exec(presenceMigrations.migrations.m0001)
    assert.deepEqual(
      JSON.parse(sqlite.prepare('SELECT value FROM summaries').get().value),
      JSON.parse(JSON.stringify(value))
    )
    assert.equal(
      sqlite.prepare('SELECT watermark FROM presence_admission').get()
        .watermark,
      -1
    )
  } finally {
    sqlite.close()
  }
})

await test('rapid room changes coalesce without delaying privacy removals or losing retry backoff', () => {
  const base = {
    now: 1000,
    nextAllowedAt: 31000,
    pending: undefined,
    meaningful: true,
    removesPresence: false
  }
  assert.equal(presenceDeliveryDue(base), 31000)
  assert.equal(presenceDeliveryDue({ ...base, nextAllowedAt: 0 }), 1000)
  assert.equal(
    presenceDeliveryDue({ ...base, pending: { due: 50000, failures: 2 } }),
    50000
  )
  assert.equal(presenceDeliveryDue({ ...base, removesPresence: true }), 1000)
  assert.equal(
    presenceDeliveryDue({ ...base, meaningful: false, nextAllowedAt: 0 }),
    31000
  )
  assert.equal(presenceDeliveryDue({ ...base, now: 40000 }), 40000)
})

await test('arrival total counts observed visits once across retries, privacy changes and summary eviction', () => {
  const { db, sqlite } = fixture()
  const total = () =>
    sqlite.prepare('SELECT total FROM visit_totals').get().total
  try {
    assert.equal(total(), 0)
    storePresence(
      db,
      visitor('waiting', { lastSeen: null, lifecycle: 'waiting' }),
      now
    )
    assert.equal(total(), 0)
    storePresence(
      db,
      visitor('waiting', {
        revision: 2,
        visible: false,
        room: null,
        lifecycle: 'opened'
      }),
      now
    )
    assert.equal(total(), 1)
    storePresence(db, visitor('waiting', { revision: 2 }), now)
    storePresence(
      db,
      visitor('waiting', { revision: 3, lifecycle: 'returned' }),
      now
    )
    assert.equal(total(), 1)
    sqlite.prepare('DELETE FROM summaries WHERE id = ?').run('waiting')
    storePresence(db, visitor('waiting', { revision: 4 }), now)
    assert.equal(total(), 1)
    storePresence(db, visitor('second'), now)
    assert.equal(total(), 2)
    storePresence(db, visitor('expired', { expiresAt: now - 1 }), now)
    assert.equal(total(), 2)
  } finally {
    sqlite.close()
  }
})
