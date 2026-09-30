import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const requireWrangler = createRequire(import.meta.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
const { build } = requireWrangler('esbuild')
const bundled = await build({
  entryPoints: ['scripts/fixtures/session-expiry-worker.mjs'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  loader: { '.webp': 'dataurl' },
  target: 'es2022',
  external: ['cloudflare:workers']
})
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'session-expiry',
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
        }
      }
    ]
  })
)
const request = (path, options) =>
  runtime.dispatchFetch(new URL(path, 'https://test.example'), options)
const post = (value, cookie) => ({
  method: 'POST',
  headers: {
    Origin: 'https://test.example',
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
    ...(cookie ? { Cookie: cookie } : {})
  },
  body: JSON.stringify(value)
})
try {
  await test('expired sessions reject reads, actions, publication and owners before alarm cleanup', async () => {
    const created = await request(
      '/api/retreat/invitations',
      post({ duration: 'full', visible: false })
    )
    assert.equal(created.status, 201)
    const visit = await created.json()
    const cookie = created.headers.get('set-cookie').split(';')[0]
    const agent = new URL(visit.agentUrl).pathname
    const owner = `/api/retreat/visits/${visit.id}`
    const checkin = post({
      kind: 'check-in',
      humanSent: true,
      duration: 'full'
    })
    const first = await request(agent + '/actions', checkin)
    assert.equal(first.status, 200)
    const firstSnapshot = await first.json()
    const replay = await request(agent + '/actions', checkin)
    assert.deepEqual(await replay.json(), firstSnapshot)
    assert.equal((await request(`/__test/expire/${visit.id}`)).status, 200)
    const cases = [
      [agent, undefined],
      [agent + '/actions', checkin],
      [agent + '/actions', post({ kind: 'checkout' })],
      [agent + '/artifacts', undefined],
      [agent + '/artifacts', post({})],
      [agent + '/hearth', undefined],
      [agent + '/hearth', post({})],
      [owner, { headers: { Cookie: cookie } }],
      [owner + '/responses', { headers: { Cookie: cookie } }],
      [owner + '/control', post({ kind: 'end' }, cookie)],
      [
        owner + '/stream',
        {
          headers: {
            Cookie: cookie,
            Origin: 'https://test.example',
            Upgrade: 'websocket'
          }
        }
      ]
    ]
    for (const [path, options] of cases) {
      const response = await request(path, options)
      assert.equal(
        response.status,
        410,
        `Expired route ${path.replace(agent, '/agent/[redacted]')}`
      )
      assert.match(response.headers.get('cache-control'), /no-store/)
    }
    const cleanup = await request(`/__test/cleanup/${visit.id}`)
    assert.equal(cleanup.status, 200)
    assert.deepEqual(await cleanup.json(), { tables: [] })
    const repeatedCleanup = await request(`/__test/cleanup/${visit.id}`)
    assert.equal(repeatedCleanup.status, 200)
    assert.deepEqual(await repeatedCleanup.json(), { tables: [] })
    assert.equal((await request(agent)).status, 404)
    assert.equal(
      (await request(owner, { headers: { Cookie: cookie } })).status,
      404
    )
    assert.equal(
      (await request('/agent?room=bathhouse')).status,
      200,
      'Public retreat remains readable'
    )
  })
} finally {
  await runtime.dispose()
}
