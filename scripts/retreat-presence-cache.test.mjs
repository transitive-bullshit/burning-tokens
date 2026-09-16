import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cachedPresence,
  presenceCacheKey
} from '../worker/src/presence-cache.ts'

function fixture() {
  let time = 100000
  let loads = 0
  const entries = new Map()
  const pending = []
  const cache = {
    async match(key) {
      return entries.get(key.url)?.clone()
    },
    async put(key, response) {
      entries.set(key.url, response.clone())
    }
  }
  return {
    options: {
      origin: 'https://retreat.example',
      cache,
      waitUntil: (promise) => pending.push(promise),
      now: () => time,
      load: async () => {
        loads++
        return {
          generatedAt: time,
          total: 0,
          shown: 0,
          sampled: false,
          rooms: [],
          visitors: []
        }
      }
    },
    get loads() {
      return loads
    },
    advance: (ms) => {
      time += ms
    },
    settled: () => Promise.all(pending),
    entries
  }
}

await test('crowd snapshots share one edge entry and never extend freshness through downstream caches', async () => {
  const f = fixture()
  const first = await cachedPresence(f.options)
  assert.equal(first.headers.get('X-Retreat-Cache'), 'MISS')
  assert.equal(first.headers.get('Cache-Control'), 'no-store')
  assert.equal(first.headers.has('X-Retreat-Cached-At'), false)
  await f.settled()
  const stored = [...f.entries.values()][0]
  assert.equal(stored.headers.get('Cache-Control'), 'public, max-age=15')
  f.advance(14000)
  const second = await cachedPresence(f.options)
  assert.equal(second.headers.get('X-Retreat-Cache'), 'HIT')
  assert.equal(second.headers.get('X-Retreat-Snapshot-Age'), '14')
  assert.equal(f.loads, 1)
  f.advance(1000)
  assert.equal(
    (await cachedPresence(f.options)).headers.get('X-Retreat-Cache'),
    'MISS'
  )
  assert.equal(f.loads, 2)
})

await test('keys contain only origin, version and a validated room', async () => {
  const key = presenceCacheKey(
    'https://retreat.example/private?token=secret',
    'source'
  )
  assert.equal(
    key.url,
    'https://retreat.example/__retreat-cache/presence-v1?room=source'
  )
  assert.deepEqual([...key.headers], [])
  assert.throws(() => presenceCacheKey('https://retreat.example', 'invalid'))
  const f = fixture()
  await cachedPresence(f.options)
  await f.settled()
  await cachedPresence({ ...f.options, room: 'source' })
  assert.equal(f.loads, 2)
})

await test('cache failures degrade to fresh reads; stale entries cannot mask origin failures', async () => {
  const f = fixture()
  const response = await cachedPresence({
    ...f.options,
    cache: {
      ...f.options.cache,
      match: async () => {
        throw new Error('Unavailable')
      }
    }
  })
  assert.equal(response.headers.get('X-Retreat-Cache'), 'BYPASS')
  await cachedPresence(f.options)
  await f.settled()
  f.advance(15000)
  await assert.rejects(
    cachedPresence({
      ...f.options,
      load: async () => {
        throw new Error('Unavailable')
      }
    })
  )
  await cachedPresence({
    ...f.options,
    cache: {
      ...f.options.cache,
      put: async () => {
        throw new Error('Cache full')
      }
    }
  })
  await f.settled()
})
