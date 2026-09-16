import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const requireWrangler = createRequire(import.meta.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
const { build } = requireWrangler('esbuild')
const bundled = await build({
  entryPoints: ['scripts/fixtures/inference-budget-worker.mjs'],
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
        name: 'budget-check',
        script: bundled.outputFiles[0].text,
        modules: true,
        compatibilityDate: '2026-09-15',
        compatibilityFlags: ['nodejs_compat'],
        durableObjects: {
          BUDGET: { className: 'BudgetFixture', useSQLite: true }
        }
      }
    ]
  })
)
async function check(values) {
  const result = await runtime.dispatchFetch('https://test.example/', {
    method: 'POST',
    body: JSON.stringify({
      id: crypto.randomUUID(),
      calls: '1000',
      bytes: '2000000',
      ...values
    })
  })
  assert.equal(result.status, 200)
  return result.json()
}
try {
  await test('invalid daily limits deny inference without consuming budget', async () => {
    for (const setting of ['calls', 'bytes']) {
      for (const value of [
        'typo',
        'Infinity',
        '-1',
        '1.5',
        '',
        null,
        undefined,
        '9007199254740992'
      ]) {
        const result = await check({ [setting]: value })
        assert.equal(
          result.accepted,
          false,
          `${setting}=${String(value)} must fail closed`
        )
        assert.equal(result.state, null)
      }
    }
  })
  await test('zero limits pause inference and invalid byte reservations cannot reduce usage', async () => {
    for (const values of [
      { calls: '0' },
      { bytes: '0' },
      { input: -100 },
      { input: 0 },
      { input: 1.5 }
    ]) {
      const result = await check(values)
      assert.equal(result.accepted, false)
      assert.equal(result.state, null)
    }
  })
  await test('concurrent reservations obey both daily limits and circuit breaker', async () => {
    const id = crypto.randomUUID()
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        check({ id, calls: '3', bytes: '25', input: 10 })
      )
    )
    assert.equal(results.filter((result) => result.accepted).length, 2)
    const last = await check({ id, calls: '3', bytes: '25', input: 5 })
    assert.equal(last.accepted, true)
    assert.equal(last.state.calls, 3)
    assert.equal(last.state.bytes, 25)
    assert.equal(
      (await check({ id, calls: '3', bytes: '100' })).accepted,
      false
    )
    const circuit = crypto.randomUUID()
    assert.equal((await check({ id: circuit })).accepted, true)
    const blocked = await check({ id: circuit, failures: 3 })
    assert.equal(blocked.accepted, false)
    assert.equal(blocked.state.calls, 1)
    assert.ok(blocked.state.openUntil > Date.now())
  })
} finally {
  await runtime.dispose()
}
