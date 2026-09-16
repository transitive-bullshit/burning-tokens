import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const requireWrangler = createRequire(import.meta.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
const { build } = requireWrangler('esbuild')
const bundled = await build({
  entryPoints: ['scripts/fixtures/studio-fault-worker.mjs'],
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
        name: 'studio-recovery',
        script: bundled.outputFiles[0].text,
        modules: true,
        compatibilityDate: '2026-09-15',
        compatibilityFlags: ['nodejs_compat'],
        durableObjects: {
          STUDIO: { className: 'FaultStudio', useSQLite: true }
        },
        r2Buckets: ['MEDIA'],
        bindings: { PUBLISHING_ENABLED: 'true' }
      }
    ]
  })
)
const authorId = '00000000-0000-4000-8000-000000000001'
function fixture() {
  const id = crypto.randomUUID()
  const headers = {
    'X-Test-Object': id,
    'X-Retreat-Viewer': JSON.stringify({ kind: 'agent', sessionId: authorId })
  }
  const request = (path, options = {}) =>
    runtime.dispatchFetch(`https://test.example${path}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    })
  return {
    request,
    configure: (mode) => request('/configure', { method: 'POST', body: mode }),
    inspect: async () => (await request('/inspect')).json(),
    upload: (key = 'retry-key', text = 'A small clay star.') =>
      request('/artifacts?audience=agents', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'Idempotency-Key': key },
        body: text
      })
  }
}
try {
  await test('R2 failure retries reuse one quota reservation and return one completed work', async () => {
    const f = fixture()
    await f.configure('once')
    assert.equal((await f.upload()).status, 503)
    const failed = await f.inspect()
    assert.equal(failed.rows.length, 1)
    assert.equal(failed.rows[0].ready, false)
    assert.equal(failed.rows[0].audience, 'private')
    const response = await f.upload()
    assert.equal(response.status, 201)
    const ready = await response.json()
    assert.equal(ready.id, failed.rows[0].id)
    assert.equal(ready.ready, true)
    assert.equal((await f.inspect()).rows.length, 1)
    assert.equal((await f.inspect()).rows[0].uploadAttempt.count, 2)
    assert.deepEqual(await (await f.upload()).json(), ready)
    assert.equal((await f.inspect()).puts, 2)
    assert.equal((await f.upload('retry-key', 'Changed content')).status, 409)
  })
  await test('attempt budget is enforced without creating more R2 writes or metadata rows', async () => {
    const f = fixture()
    await f.configure('always')
    for (let i = 0; i < 4; i++) assert.equal((await f.upload()).status, 503)
    const state = await f.inspect()
    assert.equal(state.puts, 3)
    assert.equal(state.rows.length, 1)
    assert.equal(state.rows[0].uploadAttempt.count, 3)
  })
  await test('active retry leases reject duplicates; deletion during put is never undone', async () => {
    const f = fixture()
    await f.configure('delay')
    const uploading = f.upload()
    let pending
    for (let i = 0; i < 40; i++) {
      pending = await f.inspect()
      if (pending.puts) break
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    assert.equal(pending.rows.length, 1)
    assert.equal((await f.upload()).status, 409)
    assert.equal(
      (
        await f.request(`/artifacts/${pending.rows[0].id}`, {
          method: 'DELETE'
        })
      ).status,
      200
    )
    assert.equal((await uploading).status, 410)
    assert.deepEqual(
      await (
        await f.request(`/blob-present?key=studio/${pending.rows[0].id}`)
      ).json(),
      { exists: false }
    )
    assert.equal((await f.upload()).status, 410)
    assert.equal(
      (await f.request(`/artifacts/${pending.rows[0].id}`)).status,
      404
    )
  })
  await test('expired leases recover, and the old attempt cannot overwrite the latest work', async () => {
    const f = fixture()
    await f.configure('delay')
    const first = f.upload()
    let state
    for (let i = 0; i < 40; i++) {
      state = await f.inspect()
      if (state.puts) break
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
    const id = state.rows[0].id
    await f.request('/expire-lease', { method: 'POST' })
    await f.request(`/artifacts/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience: 'private' })
    })
    const recovered = await (await f.upload()).json()
    assert.equal(recovered.ready, true)
    assert.equal(recovered.requestedAudience, 'private')
    assert.deepEqual(await (await first).json(), recovered)
    assert.equal((await f.inspect()).rows[0].uploadAttempt.count, 2)
  })
  await test('pre-lease pending records recover without changing their identity', async () => {
    const f = fixture()
    await f.configure('once')
    await f.upload()
    const original = (await f.inspect()).rows[0]
    await f.request('/legacy-lease', { method: 'POST' })
    const response = await f.upload()
    assert.equal(response.status, 201)
    const recovered = await response.json()
    assert.equal(recovered.id, original.id)
    assert.equal(recovered.ready, true)
  })
} finally {
  await runtime.dispose()
}
