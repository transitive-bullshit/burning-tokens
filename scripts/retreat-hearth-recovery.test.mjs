import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const requireWrangler = createRequire(import.meta.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
const { build } = requireWrangler('esbuild')
const bundled = await build({
  entryPoints: ['scripts/fixtures/hearth-fault-worker.mjs'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['cloudflare:workers']
})
let gate
function hold() {
  let started, release
  const entered = new Promise((resolve) => {
    started = resolve
  })
  const wait = new Promise((resolve) => {
    release = resolve
  })
  gate = { started, wait }
  return {
    entered,
    release: () => {
      gate = undefined
      release()
    }
  }
}
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'hearth-recovery',
        script: bundled.outputFiles[0].text,
        modules: true,
        compatibilityDate: '2026-09-15',
        compatibilityFlags: ['nodejs_compat'],
        durableObjects: {
          LOUNGE: { className: 'FaultLounge', useSQLite: true }
        },
        bindings: { PUBLISHING_ENABLED: 'false', OPENAI_API_KEY: 'test-only' },
        outboundService: async () => {
          const held = gate
          if (held) {
            held.started()
            await held.wait
          }
          return Response.json({
            model: 'fixture',
            results: [{ flagged: Boolean(held) }]
          })
        }
      }
    ]
  })
)
function fixture() {
  const id = crypto.randomUUID()
  const author = crypto.randomUUID()
  const headers = {
    'X-Test-Object': id,
    'X-Retreat-Viewer': JSON.stringify({ kind: 'agent', sessionId: author })
  }
  const request = (path, options = {}) =>
    runtime.dispatchFetch(`https://test.example${path}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    })
  return {
    request,
    post: (text = 'A small hello.') =>
      request('/hearth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'same-message-key'
        },
        body: JSON.stringify({ text, audience: 'agents' })
      }),
    inspect: async () => await (await request('/inspect')).json()
  }
}
try {
  await test('legacy pending messages recover with the same receipt and one quota row', async () => {
    const f = fixture()
    const first = await (await f.post()).json()
    await f.request('/interrupt?legacy')
    const recovered = await f.post()
    assert.equal(recovered.status, 201)
    const value = await recovered.json()
    assert.equal(value.id, first.id)
    assert.equal(value.ready, true)
    assert.equal(value.moderation, 'approved')
    assert.equal((await f.inspect()).length, 1)
    assert.equal((await f.post('Different content.')).status, 409)
  })
  await test('active duplicates cannot spend another moderation attempt; unsharing persists', async () => {
    const f = fixture(),
      held = hold()
    const pending = f.post()
    try {
      await held.entered
      assert.equal((await f.post()).status, 409)
      const [row] = await f.inspect()
      assert.equal(row.moderationAttempt.count, 1)
      assert.equal(
        (
          await f.request(`/hearth/${row.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audience: 'private' })
          })
        ).status,
        200
      )
    } finally {
      held.release()
    }
    const result = await (await pending).json()
    assert.equal(result.requestedAudience, 'private')
    assert.equal(result.audience, 'private')
  })
  await test('a superseded moderation result cannot replace a newer successful attempt', async () => {
    const f = fixture(),
      held = hold()
    const pending = f.post()
    try {
      await held.entered
      await f.request('/interrupt')
      gate = undefined
      const newer = await (await f.post()).json()
      assert.equal(newer.moderation, 'approved')
    } finally {
      held.release()
    }
    assert.equal((await (await pending).json()).moderation, 'approved')
    const [row] = await f.inspect()
    assert.equal(row.moderationAttempt.count, 2)
    assert.equal(row.moderation, 'approved')
  })
  await test('recovery is capped at three attempts without adding quota rows', async () => {
    const f = fixture()
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal((await f.post()).status, 201)
      await f.request('/interrupt')
    }
    assert.equal((await f.post()).status, 503)
    const rows = await f.inspect()
    assert.equal(rows.length, 1)
    assert.equal(rows[0].moderationAttempt.count, 3)
    assert.equal(rows[0].ready, false)
  })
  await test('deletion during moderation cannot resurrect a message on completion or retry', async () => {
    const f = fixture(),
      held = hold()
    const pending = f.post()
    try {
      await held.entered
      const [row] = await f.inspect()
      assert.equal(
        (await f.request(`/hearth/${row.id}`, { method: 'DELETE' })).status,
        200
      )
    } finally {
      held.release()
    }
    assert.equal((await pending).status, 410)
    assert.equal((await f.post()).status, 410)
    const [row] = await f.inspect()
    assert.equal(row.deleted, true)
    assert.equal(row.text, '')
  })
} finally {
  await runtime.dispose()
}
