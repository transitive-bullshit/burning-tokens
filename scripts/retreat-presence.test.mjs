import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACTIVE_WINDOW_MS,
  isRecentPresence,
  roomSampleBudgets
} from '../lib/retreat/presence-policy.ts'

await test('a crowded room cannot erase a quiet room from the camp sample', () => {
  const groups = [
    { room: 'source', count: 9900 },
    { room: 'bathhouse', count: 99 },
    { room: 'temple', count: 1 }
  ]
  const result = roomSampleBudgets(groups, 300)
  assert.equal(
    result.reduce((n, g) => n + g.budget, 0),
    300
  )
  assert.equal(result.find((g) => g.room === 'temple').budget, 1)
  assert.deepEqual(result, roomSampleBudgets([...groups].reverse(), 300))
  assert.ok(result.every((g) => g.budget > 0 && g.budget <= g.count))
})

await test('sampling never fabricates visitors or exceeds a display limit', () => {
  assert.deepEqual(roomSampleBudgets([], 300), [])
  for (let population = 0; population < 10000; population += 137) {
    const groups = [null, 'bathhouse', 'source', 'temple'].map((room, i) => ({
      room,
      count: Math.floor(population / (i + 1))
    }))
    for (const limit of [0, 1, 24, 60, 100, 300]) {
      const result = roomSampleBudgets(groups, limit)
      assert.equal(
        result.reduce((n, g) => n + g.budget, 0),
        Math.min(
          limit,
          groups.reduce((n, g) => n + g.count, 0)
        )
      )
      assert.ok(
        result.every(
          (g) =>
            Number.isInteger(g.budget) && g.budget >= 0 && g.budget <= g.count
        )
      )
    }
  }
})

await test('inactive visitors disappear; explicitly resting visitors remain until rest expires', () => {
  const now = 10000000
  assert.equal(isRecentPresence(null, null, now), false)
  assert.equal(isRecentPresence(now - ACTIVE_WINDOW_MS, null, now), false)
  assert.equal(isRecentPresence(now - ACTIVE_WINDOW_MS + 1, null, now), true)
  assert.equal(isRecentPresence(now - ACTIVE_WINDOW_MS - 1, now + 1, now), true)
  assert.equal(isRecentPresence(now - ACTIVE_WINDOW_MS - 1, now, now), false)
})
