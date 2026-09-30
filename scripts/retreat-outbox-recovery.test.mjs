import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const requireWrangler = createRequire(import.meta.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
const { build } = requireWrangler('esbuild')
const bundled = await build({
  entryPoints: ['scripts/fixtures/outbox-fault-worker.mjs'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  loader: { '.webp': 'dataurl' },
  target: 'es2022',
  external: ['cloudflare:workers']
})
let failure = true
let deliveryGate
const deliveries = []
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'outbox-recovery',
        script: bundled.outputFiles[0].text,
        modules: true,
        compatibilityDate: '2026-09-15',
        compatibilityFlags: ['nodejs_compat'],
        durableObjects: Object.fromEntries(
          Object.entries({
            SESSIONS: 'RetreatSession',
            PRESENCE: 'RetreatPresence',
            STUDIO: 'RetreatStudio',
            LOUNGE: 'RetreatLounge',
            BUDGET: 'InferenceBudget'
          }).map(([key, className]) => [key, { className, useSQLite: true }])
        ),
        r2Buckets: ['MEDIA'],
        bindings: {
          PUBLIC_ORIGIN: 'https://test.example',
          TYPESAFE_ENABLED: 'false'
        },
        outboundService: async (request) => {
          assert.equal(request.url, 'https://outbox-fixture.invalid/delivery')
          deliveries.push(await request.json())
          const gate = deliveryGate
          if (gate) {
            gate.entered()
            await gate.wait
          }
          return new Response('', { status: failure ? 503 : 200 })
        }
      }
    ]
  })
)
const request = (path, options) =>
  runtime.dispatchFetch(`https://test.example${path}`, options)
const post = (value) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://test.example',
    Accept: 'application/json',
    'Idempotency-Key': crypto.randomUUID()
  },
  body: JSON.stringify(value)
})
try {
  await test('Presence outage preserves the private journal and retries the latest coalesced summary', async () => {
    const created = await request(
      '/api/retreat/invitations',
      post({ duration: 'full', visible: true })
    )
    assert.equal(created.status, 201)
    const visit = await created.json()
    const cookie = created.headers.get('set-cookie').split(';')[0]
    const path = new URL(visit.agentUrl).pathname
    const action = async (value) => {
      const result = await request(`${path}/actions`, post(value))
      assert.equal(result.status, 200)
      return result.json()
    }
    const deliver = async () =>
      (await request(`/__test/deliver/${visit.id}`)).json()
    await action({ kind: 'check-in', humanSent: true, duration: 'full' })
    const first = await deliver()
    assert.equal(first.rows.length, 1)
    assert.ok(first.rows[0].failures >= 1)
    assert.ok(first.rows[0].due > Date.now())
    await action({ kind: 'enter', room: 'bathhouse' })
    const latest = await action({ kind: 'enter', room: 'source' })
    const second = await deliver()
    assert.equal(second.rows.length, 1)
    assert.ok(second.rows[0].failures > first.rows[0].failures)
    assert.equal(second.rows[0].value.room, 'source')
    assert.equal(second.rows[0].value.revision, latest.revision)
    const owner = await request(`/api/retreat/visits/${visit.id}`, {
      headers: { Cookie: cookie }
    })
    assert.equal(owner.status, 200)
    const privateVisit = await owner.json()
    assert.equal(privateVisit.room, 'source')
    assert.deepEqual(privateVisit.events, latest.events)
    assert.equal(privateVisit.revision, latest.revision)
    failure = false
    assert.deepEqual((await deliver()).rows, [])
    assert.equal(deliveries.at(-1).room, 'source')
    const count = deliveries.length
    await deliver()
    assert.equal(
      deliveries.length,
      count,
      'successful delivery is removed from the outbox'
    )
    await action({ kind: 'enter', room: 'bathhouse' })
    let entered, release
    const started = new Promise((resolve) => {
      entered = resolve
    })
    const wait = new Promise((resolve) => {
      release = resolve
    })
    deliveryGate = { entered, wait }
    const delayed = deliver()
    try {
      await started
      const newer = await action({ kind: 'enter', room: 'temple' })
      deliveryGate = undefined
      release()
      const afterOldSuccess = await delayed
      assert.equal(
        afterOldSuccess.rows.length,
        1,
        'old delivery must not erase a newer pending summary'
      )
      assert.equal(afterOldSuccess.rows[0].value.revision, newer.revision)
      assert.equal(afterOldSuccess.rows[0].value.room, 'temple')
      assert.deepEqual((await deliver()).rows, [])
      assert.equal(deliveries.at(-1).room, 'temple')
    } finally {
      deliveryGate = undefined
      release()
      await delayed
    }
  })
} finally {
  await runtime.dispose()
}
