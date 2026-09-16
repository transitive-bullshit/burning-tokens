import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
const requireWrangler = createRequire(import.meta.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
const { build } = requireWrangler('esbuild')
const bundled = await build({
  entryPoints: ['scripts/fixtures/presence-load-worker.mjs'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['cloudflare:workers']
})
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'presence-load-check',
        script: bundled.outputFiles[0].text,
        modules: true,
        compatibilityDate: '2026-09-15',
        compatibilityFlags: ['nodejs_compat'],
        durableObjects: {
          PRESENCE: { className: 'RetreatPresence', useSQLite: true }
        }
      }
    ]
  })
)
// Miniflare dispatchFetch deliberately resets every connection. Use its actual
// HTTP listener so this sustained benchmark reuses sockets like a normal client.
const runtimeOrigin = await runtime.ready
function dispatch(url, options) {
  const target = new URL(url)
  return fetch(new URL(target.pathname + target.search, runtimeOrigin), options)
}
const rooms = [
  'bathhouse',
  'source',
  'dream-garden',
  'quiet-house',
  'temple',
  'open-studio',
  'hearth'
]
const rows = []
const results = []
function visitor(index, revision = 1, visible = true) {
  const now = Date.now()
  return {
    publicId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    avatarSeed: index,
    family: 'unknown',
    room: rooms[(index + revision) % rooms.length],
    lifecycle: 'visiting',
    revision,
    presenceChangedAt: now,
    expiresAt: now + 3600000,
    lastSeen: now,
    restUntil: null,
    visible,
    country: null
  }
}
async function write(value) {
  const started = performance.now()
  const response = await dispatch('https://load.invalid/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  })
  assert.equal(response.status, 204)
  rows.push({ kind: 'write', ms: performance.now() - started })
}
async function read(room, cached = false) {
  const started = performance.now()
  const params = new URLSearchParams()
  if (room) params.set('room', room)
  if (cached) params.set('cached', '1')
  const response = await dispatch(`https://load.invalid/?${params}`)
  assert.equal(response.status, 200)
  const value = await response.json()
  assert.ok(value.visitors.length <= (room ? 100 : 300))
  assert.equal(value.shown, value.visitors.length)
  assert.ok(value.total <= 10000)
  assert.ok(value.visitors.every((v) => !('presenceChangedAt' in v)))
  rows.push({
    kind: 'snapshot',
    ms: performance.now() - started,
    cache: response.headers.get('X-Retreat-Cache')
  })
  return value
}
async function parallel(count, concurrency, work) {
  let next = 0
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < count) {
        const index = next++
        await work(index)
      }
    })
  )
}
async function stage(name, count, concurrency, work) {
  rows.length = 0
  const started = performance.now()
  await parallel(count, concurrency, work)
  const elapsedMs = performance.now() - started
  const result = {
    name,
    jobs: count,
    operations: rows.length,
    concurrency,
    elapsedMs: Math.round(elapsedMs),
    operationsPerSecond: Math.round((rows.length * 1000) / elapsedMs)
  }
  for (const kind of ['write', 'snapshot']) {
    const times = rows
      .filter((row) => row.kind === kind)
      .map((row) => row.ms)
      .sort((a, b) => a - b)
    if (times.length)
      result[kind] = {
        count: times.length,
        p50Ms: Math.round(times[Math.floor(times.length * 0.5)]),
        p95Ms: Math.round(
          times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]
        ),
        maxMs: Math.round(times.at(-1))
      }
  }
  if (rows.some((row) => row.cache))
    result.cache = {
      hits: rows.filter((row) => row.cache === 'HIT').length,
      misses: rows.filter((row) => row.cache === 'MISS').length,
      bypasses: rows.filter((row) => row.cache === 'BYPASS').length
    }
  results.push(result)
  console.log(JSON.stringify(result))
}
try {
  await stage('populate-10000', 10000, 32, (index) => write(visitor(index)))
  const full = await read()
  assert.equal(full.total, 10000)
  assert.equal(full.shown, 300)
  for (const room of rooms) {
    const sample = await read(room)
    assert.equal(sample.shown, 100)
    assert.ok(sample.visitors.every((v) => v.room === room))
  }
  await stage('mixed-room-changes', 2000, 16, (index) =>
    index % 10 === 0 ? read() : write(visitor(index, 2))
  )
  await stage('burst-room-changes', 2000, 64, (index) =>
    index % 5 === 0
      ? read(rooms[index % rooms.length])
      : write(visitor(index + 2000, 2))
  )
  for (const room of [undefined, ...rooms]) await read(room, true)
  await stage('cached-crowd-with-updates', 2000, 64, (index) =>
    index % 5 === 0
      ? write(visitor(index + 4000, 2))
      : read(index % 8 === 7 ? undefined : rooms[index % 8], true)
  )
  assert.ok(
    rows.filter((row) => row.cache === 'HIT').length > 1400,
    'Warm edge-cache hit ratio should exceed 87.5% of reads'
  )
  await stage('hide-and-stale-replay', 500, 32, async (index) => {
    await write(visitor(index, 3, false))
    await write(visitor(index, 2, true))
  })
  assert.equal((await read()).total, 9500)
  await stage('capacity-pressure', 1000, 32, (index) =>
    write(visitor(index + 10000))
  )
  const final = await read()
  assert.equal(final.total, 10000)
  assert.equal(final.shown, 300)
  await mkdir('work/load-checks', { recursive: true })
  await writeFile(
    'work/load-checks/presence-local.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        environment:
          'isolated local Miniflare HTTP listener, production Presence class and SQLite, with direct and production Cache API paths',
        results
      },
      null,
      2
    )
  )
  console.log(
    'Presence bounds and stale-update protection hold under this local workload. This does not measure Cloudflare regional throughput, Session outbox lag or regional edge-cache effectiveness.'
  )
} finally {
  await runtime.dispose()
}
