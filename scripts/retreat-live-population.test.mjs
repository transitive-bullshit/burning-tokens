import assert from 'node:assert/strict'
import test from 'node:test'
import { livePopulation } from '../lib/world/live-population.js'
import { chooseVisible } from '../lib/world/crowd.js'
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const visitor = (n, room = 'bathhouse') => ({
  publicId: id(n),
  avatarSeed: n * 100,
  room,
  family: 'Claude',
  lifecycle: 'visiting'
})

await test('live creatures retain identity, family and seed as snapshots reorder', () => {
  const first = livePopulation({ visitors: [visitor(1), visitor(2)] })
  const next = livePopulation({ visitors: [visitor(2), visitor(1)] })
  assert.deepEqual(first[0], next[1])
  assert.equal(first[0].family, 1)
  assert.equal(livePopulation({ visitors: [visitor(1, 'source')] })[0].room, 3)
})

await test('empty, closed, duplicate and malformed records create no phantom visitors', () => {
  assert.deepEqual(livePopulation({ visitors: [] }), [])
  assert.deepEqual(
    livePopulation({
      visitors: [
        { ...visitor(2), lifecycle: 'returned' },
        { ...visitor(3), publicId: '<img onerror=alert(1)>' }
      ]
    }),
    []
  )
  assert.equal(livePopulation({ visitors: [visitor(1), visitor(1)] }).length, 1)
  assert.throws(() => livePopulation({ total: 1 }))
})

await test('live crowd stays inside camp and room display budgets and pins selected visitors', () => {
  const population = livePopulation({
    visitors: Array.from({ length: 1000 }, (_, i) => visitor(i))
  })
  assert.equal(population.length, 300)
  for (const [scene, mode, limit, expected] of [
    ['camp', 'summary', 60, 60],
    ['camp', 'summary', 24, 24],
    ['camp', 'full', 60, 300],
    ['bathhouse', 'summary', 60, 24],
    ['bathhouse', 'full', 60, 100]
  ]) {
    const result = chooseVisible(population, {
      scene,
      mode,
      limit,
      selectedId: id(299)
    })
    assert.equal(result.visible.length, expected)
    assert.ok(result.visible.some((v) => v.id === id(299)))
  }
})

await test('the private stream overrides stale public location and stays within the room cap', async () => {
  const { withFollowedVisitor } =
    await import('../lib/world/live-population.js')
  const snapshot = {
    visitors: Array.from({ length: 100 }, (_, i) => visitor(i))
  }
  const own = {
    ...visitor(500),
    revision: 8,
    visible: false,
    reflection: 'private',
    agentHash: 'secret'
  }
  const merged = withFollowedVisitor(snapshot, own, 'bathhouse')
  assert.equal(merged.visitors.length, 100)
  assert.equal(merged.selectedId, own.publicId)
  assert.ok(merged.visitors.some((v) => v.id === own.publicId))
  assert.ok(!JSON.stringify(merged).includes('secret'))
  assert.ok(!JSON.stringify(merged).includes('private'))
  const moved = withFollowedVisitor(
    { visitors: [visitor(500)] },
    { ...own, room: 'source' },
    'bathhouse'
  )
  assert.deepEqual(moved.visitors, [])
  const ended = withFollowedVisitor(
    { visitors: [visitor(500)] },
    { ...own, lifecycle: 'ended' },
    'camp'
  )
  assert.deepEqual(ended.visitors, [])
})

await test('gate arrivals appear at the gate and disappear when the visit ends', async () => {
  const { withFollowedVisitor } =
    await import('../lib/world/live-population.js')
  const gate = { ...visitor(1, null), lifecycle: 'opened' }
  const result = withFollowedVisitor({ visitors: [] }, gate, 'camp')
  assert.equal(result.visitors.length, 1)
  assert.equal(result.visitors[0].room, -1)
  assert.equal(result.selectedId, gate.publicId)
  assert.deepEqual(
    withFollowedVisitor({ visitors: [] }, gate, 'bathhouse').visitors,
    []
  )
  assert.deepEqual(
    withFollowedVisitor(
      { visitors: [gate] },
      { ...gate, lifecycle: 'returned' },
      'camp'
    ).visitors,
    []
  )
  assert.deepEqual(
    livePopulation({ visitors: [{ ...gate, lifecycle: 'waiting' }] }),
    []
  )
})
