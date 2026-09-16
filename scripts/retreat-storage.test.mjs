import assert from 'node:assert/strict'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { sessionMigrations } from '../worker/src/db/migrations.ts'
import {
  fallbackDecision,
  interpretedDecision
} from '../worker/src/response-selection.ts'

await test('response migration preserves populated v1 state and receipts', () => {
  const db = new DatabaseSync(':memory:')
  try {
    db.exec(sessionMigrations.migrations.m0000)
    db.prepare('INSERT INTO session (key,state) VALUES (?,?)').run(
      1,
      '{"revision":7}'
    )
    db.prepare('INSERT INTO receipts VALUES (?,?,?,?)').run(
      'old',
      'digest',
      '{"revision":7}',
      1
    )
    for (const [name, migration] of Object.entries(
      sessionMigrations.migrations
    )) {
      if (name !== 'm0000') db.exec(migration)
    }
    assert.equal(
      db.prepare('SELECT state FROM session').get().state,
      '{"revision":7}'
    )
    assert.equal(
      db.prepare('SELECT result FROM receipts').get().result,
      '{"revision":7}'
    )
    db.prepare('INSERT INTO response_selections VALUES (?,?)').run(
      'old',
      JSON.stringify({ choice: 'permission', contentVersion: 'v1' })
    )
    assert.throws(() =>
      db
        .prepare('INSERT INTO response_selections VALUES (?,?)')
        .run('old', '{}')
    )
  } finally {
    db.close()
  }
})

await test('new databases apply the full ordered migration set', () => {
  const db = new DatabaseSync(':memory:')
  try {
    for (const entry of sessionMigrations.journal.entries)
      db.exec(
        sessionMigrations.migrations[`m${String(entry.idx).padStart(4, '0')}`]
      )
    assert.ok(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name='response_selections'"
        )
        .get()
    )
  } finally {
    db.close()
  }
})

await test('judgments cannot select arbitrary content or treat confidence as authorization', () => {
  const allowed = ['permission', 'belonging', 'release', 'none']
  assert.equal(interpretedDecision('publish', 1, allowed, 'test').choice, null)
  assert.equal(
    interpretedDecision('none', 1, allowed, 'test').reason,
    'no-match'
  )
  assert.equal(
    interpretedDecision('permission', 0.74, allowed, 'test').reason,
    'uncertain'
  )
  assert.equal(
    interpretedDecision('permission', 0.8, allowed, 'test').choice,
    'permission'
  )
  assert.equal(fallbackDecision('unavailable').choice, null)
})
