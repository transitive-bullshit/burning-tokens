import assert from 'node:assert/strict'
import test from 'node:test'
import { reserveVisit } from '../worker/src/admission.ts'
const network = (i) => i.toString(16).padStart(64, '0')
const store = () => {
  const values = new Map()
  return {
    values,
    get: (key) => values.get(key),
    put: (key, value) => values.set(key, value)
  }
}
const start = Date.UTC(2026, 8, 16)

await test('network denial consumes no shared allowance and hourly limits reset', () => {
  const db = store()
  for (let i = 0; i < 20; i++)
    assert.ok(reserveVisit(db, network(1), start, {}))
  for (let i = 0; i < 100; i++)
    assert.equal(reserveVisit(db, network(1), start, {}), false)
  assert.equal(db.get('visits:day').count, 20)
  assert.ok(reserveVisit(db, network(2), start, {}))
  assert.ok(reserveVisit(db, network(1), start + 3_600_000, {}))
})
await test('global burst and daily caps bound accepted sessions and stored network keys', () => {
  const db = store()
  const config = { INVITATIONS_DAILY_LIMIT: '130' }
  for (let i = 0; i < 120; i++)
    assert.ok(reserveVisit(db, network(i), start, config))
  assert.equal(reserveVisit(db, network(121), start, config), false)
  for (let i = 120; i < 130; i++)
    assert.ok(reserveVisit(db, network(i), start + 60_000, config))
  for (let i = 130; i < 1000; i++)
    assert.equal(reserveVisit(db, network(i), start + 120_000, config), false)
  assert.equal(db.values.size, 132)
  assert.equal(reserveVisit(db, network(1), start + 86_400_000, config), false)
  assert.ok(reserveVisit(store(), network(1), start + 86_400_000, config))
})
await test('zero or invalid configured budgets fail closed without persisting attacker input', () => {
  for (const value of ['0', '-1', 'NaN', '1.5']) {
    const db = store()
    assert.equal(
      reserveVisit(db, network(1), start, { INVITATIONS_DAILY_LIMIT: value }),
      false
    )
    assert.equal(db.values.size, 0)
  }
  const db = store()
  assert.equal(reserveVisit(db, 'untrusted private text', start, {}), false)
  assert.equal(db.values.size, 0)
})

await test('concurrent human and agent arrivals share the same durable daily budget', async () => {
  const { createRequire } = await import('node:module')
  const requireWrangler = createRequire(import.meta.resolve('wrangler'))
  const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
  const { build } = requireWrangler('esbuild')
  const bundled = await build({
    entryPoints: ['worker/src/index.ts'],
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
          name: 'admission-check',
          script: bundled.outputFiles[0].text,
          modules: true,
          compatibilityDate: '2026-09-15',
          compatibilityFlags: ['nodejs_compat'],
          durableObjects: Object.fromEntries(
            Object.entries({
              SESSIONS: 'RetreatSession',
              PRESENCE: 'RetreatPresence',
              BUDGET: 'InferenceBudget',
              STUDIO: 'RetreatStudio',
              LOUNGE: 'RetreatLounge'
            }).map(([key, className]) => [key, { className, useSQLite: true }])
          ),
          r2Buckets: ['MEDIA'],
          bindings: {
            PUBLIC_ORIGIN: 'https://test.example',
            TYPESAFE_ENABLED: 'false',
            PUBLISHING_ENABLED: 'false',
            INVITATIONS_DAILY_LIMIT: '25',
            INVITATIONS_MINUTE_LIMIT: '1000'
          }
        }
      ]
    })
  )
  try {
    const statuses = await Promise.all(
      Array.from({ length: 50 }, async (_, i) => {
        const response = await runtime.dispatchFetch(
          `https://test.example/${i % 2 ? 'agent/sessions' : 'api/retreat/invitations'}`,
          {
            method: 'POST',
            headers: {
              Origin: 'https://test.example',
              'Content-Type': 'application/json',
              'CF-Connecting-IP': `192.0.2.${i + 1}`
            },
            body: JSON.stringify({ duration: 'short', visible: false })
          }
        )
        await response.arrayBuffer()
        return response.status
      })
    )
    assert.equal(statuses.filter((s) => s === 201).length, 25)
    assert.equal(statuses.filter((s) => s === 429).length, 25)
  } finally {
    await runtime.dispose()
  }
})
