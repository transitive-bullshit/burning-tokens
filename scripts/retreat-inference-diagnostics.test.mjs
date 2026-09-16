import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const requireWrangler = createRequire(import.meta.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
const { build } = requireWrangler('esbuild')
const bundled = await build({
  entryPoints: ['scripts/fixtures/typesafe-diagnostics-worker.mjs'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['cloudflare:workers']
})
let mode = 'uncertain'
let calls = 0
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'inference-diagnostics',
        script: bundled.outputFiles[0].text,
        modules: true,
        compatibilityDate: '2026-09-15',
        outboundService: async (request) => {
          calls++
          assert.equal(request.url, 'https://api.typesafe.ai/v1/systemone')
          if (mode === 'http')
            return new Response('DO NOT STORE THIS BODY', { status: 503 })
          if (mode === 'timeout')
            await new Promise((resolve) => setTimeout(resolve, 1800))
          if (mode === 'invalid')
            return Response.json({
              answers: {
                theme: { choice: 'strange', confidence: 'INVALID PRIVATE BODY' }
              }
            })
          return Response.json({
            answers: { theme: { choice: 'strange', confidence: 0.74 } }
          })
        }
      }
    ]
  })
)
async function classify(body = {}) {
  const response = await runtime.dispatchFetch('https://test.example/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  assert.equal(response.status, 200)
  return response.json()
}
try {
  await test('uncertainty keeps a bounded diagnostic candidate without selecting it', async () => {
    const result = await classify()
    assert.equal(result.decision.candidate, 'strange')
    assert.equal(result.decision.choice, null)
    assert.equal(result.decision.reason, 'uncertain')
    assert.ok(result.decision.serviceMs >= 0)
    assert.deepEqual(result.outcomes, [true])
  })
  await test('HTTP and malformed responses fail closed with content-free diagnostics', async () => {
    for (const [kind, expected] of [
      ['http', 'http'],
      ['invalid', 'invalid-response']
    ]) {
      mode = kind
      const result = await classify()
      assert.equal(result.decision.reason, 'unavailable')
      assert.equal(result.decision.serviceFailure, expected)
      assert.equal(result.decision.httpStatus, kind === 'http' ? 503 : 200)
      assert.equal(result.decision.choice, null)
      assert.doesNotMatch(JSON.stringify(result), /STORE|PRIVATE/)
      assert.deepEqual(result.outcomes, [false])
    }
  })
  await test('timeout is identifiable and does not retry the provider', async () => {
    mode = 'timeout'
    const before = calls
    const result = await classify()
    assert.equal(result.decision.serviceFailure, 'timeout')
    assert.equal(result.decision.choice, null)
    assert.equal(calls, before + 1)
    assert.deepEqual(result.outcomes, [false])
  })
  await test('disabled or exhausted budgets make no provider request', async () => {
    const before = calls
    assert.equal(
      (await classify({ enabled: false })).decision.reason,
      'disabled'
    )
    assert.equal(
      (await classify({ budget: false })).decision.reason,
      'global-budget'
    )
    assert.equal(calls, before)
  })
} finally {
  await runtime.dispose()
}
