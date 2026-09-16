import assert from 'node:assert/strict'
const base = process.env.RETREAT_TEST_ORIGIN ?? 'http://127.0.0.1:8787'
const rows = []
async function read(path, headers = {}) {
  const start = performance.now()
  const response = await fetch(new URL(path, base), { headers })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal(response.headers.has('Set-Cookie'), false)
  assert.equal(response.headers.has('X-Retreat-Cached-At'), false)
  const body = await response.json()
  const cache = response.headers.get('X-Retreat-Cache')
  assert.ok(['HIT', 'MISS', 'BYPASS'].includes(cache))
  assert.ok(body.visitors.length <= (path.includes('room=') ? 100 : 300))
  rows.push({ ms: performance.now() - start, cache })
  return body
}
await read('/api/retreat/presence')
for (let i = 0; i < 4; i++) {
  // Spectator cookies, query noise and conditional headers cannot fragment or poison the public cache.
  await read(`/api/retreat/presence?ignored=${i}`, {
    Cookie: `review_sentinel=${i}`,
    Authorization: 'Bearer not-a-real-key',
    Range: 'bytes=0-1',
    'If-None-Match': 'not-a-real-etag'
  })
}
assert.ok(
  rows.some((row) => row.cache === 'HIT'),
  'expected a real edge cache hit'
)
await read('/api/retreat/presence?room=bathhouse')
for (let batch = 0; batch < 3; batch++)
  await Promise.all(
    Array.from({ length: 10 }, () => read('/api/retreat/presence'))
  )
const invalid = await fetch(`${base}/api/retreat/presence?room=invalid`)
assert.equal(invalid.status, 400)
assert.equal(invalid.headers.has('X-Retreat-Cache'), false)
const privateResponse = await fetch(
  `${base}/api/retreat/visits/00000000-0000-4000-8000-000000000000`
)
assert.ok([403, 404].includes(privateResponse.status))
assert.equal(privateResponse.headers.get('Cache-Control'), 'no-store')
assert.equal(privateResponse.headers.has('X-Retreat-Cache'), false)
const samples = rows.map((row) => row.ms).sort((a, b) => a - b)
console.log(
  JSON.stringify(
    {
      check: 'public crowd cache',
      origin: base,
      requests: rows.length,
      concurrency: 10,
      hits: rows.filter((row) => row.cache === 'HIT').length,
      misses: rows.filter((row) => row.cache === 'MISS').length,
      bypasses: rows.filter((row) => row.cache === 'BYPASS').length,
      p50Ms: Math.round(samples[Math.floor(samples.length * 0.5)]),
      p95Ms: Math.round(samples[Math.floor(samples.length * 0.95)]),
      note: 'Small read-only smoke burst against current population; not the launch-load gate.'
    },
    null,
    2
  )
)
