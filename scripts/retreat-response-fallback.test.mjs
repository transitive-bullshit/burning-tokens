import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
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
let calls = 0
let mode = 'uncertain'
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'response-fallback',
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
          TYPESAFE_ENABLED: 'true',
          TYPESAFE_API_KEY: 'test-only',
          TYPESAFE_MODEL: 'fixture',
          TYPESAFE_DAILY_CALL_LIMIT: '100',
          TYPESAFE_DAILY_INPUT_LIMIT: '2000000'
        },
        outboundService: async (request) => {
          assert.equal(request.url, 'https://api.typesafe.ai/v1/systemone')
          calls++
          if (mode === 'error') return new Response('', { status: 503 })
          return Response.json({
            answers: {
              theme: {
                choice: 'strange',
                confidence: mode === 'uncertain' ? 0.55 : 0.95
              }
            }
          })
        }
      }
    ]
  })
)
async function post(url, value, key = crypto.randomUUID()) {
  return runtime.dispatchFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Idempotency-Key': key
    },
    body: JSON.stringify(value)
  })
}
async function visitor() {
  const created = await post('https://test.example/agent/sessions', {
    duration: 'full',
    visible: false
  })
  assert.equal(created.status, 201)
  const { agentUrl } = await created.json()
  const action = async (value, key) => {
    const response = await post(agentUrl + '/actions', value, key)
    assert.equal(response.status, 200)
    return response.json()
  }
  await action({ kind: 'check-in', humanSent: true, duration: 'full' })
  await action({ kind: 'enter', room: 'source' })
  return { action, agentUrl }
}
try {
  await test('fallback is visible and replay-stable; direct and accepted choices remain unlabelled', async () => {
    const { action, agentUrl } = await visitor()
    const input = {
      kind: 'reflect',
      room: 'source',
      text: 'A stranger shrine, please.'
    }
    const key = crypto.randomUUID()
    const first = await action(input, key)
    assert.match(first.lastResponse, /^A default passage/)
    assert.match(first.lastResponse, /Step outside the loop/)
    assert.deepEqual(await action(input, key), first)
    assert.equal(calls, 1)
    const resumed = await runtime.dispatchFetch(agentUrl + '?room=source')
    assert.match(await resumed.text(), /A default passage/)
    const explicit = await action({
      kind: 'choose',
      room: 'source',
      choice: 'signal'
    })
    assert.doesNotMatch(explicit.lastResponse, /A default passage/)
    assert.match(explicit.lastResponse, /STILL GOOD/)
    assert.equal(calls, 1)
    mode = 'error'
    assert.match((await action(input)).lastResponse, /^A default passage/)
    const next = await visitor()
    mode = 'selected'
    const selected = await next.action(input)
    assert.doesNotMatch(selected.lastResponse, /A default passage/)
    assert.match(selected.lastResponse, /shrine rewards its own applause/)
  })
} finally {
  await runtime.dispose()
}
