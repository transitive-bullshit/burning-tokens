import assert from 'node:assert/strict'
import test from 'node:test'
import { metric, requestScope, statusOutcome } from '../worker/src/metrics.ts'

await test('metrics accept only fixed labels and finite bounded numbers', () => {
  const points = []
  const env = {
    METRICS_ENABLED: 'true',
    METRICS: { writeDataPoint: (value) => points.push(value) }
  }
  metric(env, { event: 'http', scope: 'owner', outcome: '2xx', durationMs: 20 })
  metric(env, { event: 'private text or token' })
  metric(env, { event: 'http', scope: '/agent/start/private-capability' })
  metric(env, { event: 'http', outcome: 'private error response' })
  metric(env, {
    event: 'inference_usage',
    amount: Infinity,
    extra: -1,
    durationMs: NaN
  })
  assert.equal(points.length, 2)
  assert.deepEqual(points[0], {
    indexes: ['http'],
    blobs: ['v1', 'http', '2xx', 'owner'],
    doubles: [20, 1, 0]
  })
  assert.deepEqual(points[1].doubles, [0, 0, 0])
  assert.doesNotMatch(JSON.stringify(points), /private/)
})
await test('disabled, absent or throwing telemetry cannot affect application behavior', () => {
  let calls = 0
  const METRICS = {
    writeDataPoint() {
      calls++
      throw new Error('private provider failure')
    }
  }
  assert.doesNotThrow(() =>
    metric({ METRICS_ENABLED: 'true', METRICS }, { event: 'session_created' })
  )
  metric({ METRICS_ENABLED: 'false', METRICS }, { event: 'session_created' })
  metric({ METRICS }, { event: 'session_created' })
  metric({ METRICS_ENABLED: 'true' }, { event: 'session_created' })
  assert.equal(calls, 1)
})
await test('request labels never carry capabilities or identifiers and distinguish overloads', () => {
  assert.equal(requestScope('/agent/start/secret-capability/actions'), 'agent')
  assert.equal(requestScope('/api/retreat/visits/private-id/stream'), 'owner')
  assert.equal(requestScope('/api/retreat/admin/artifacts/private-id'), 'admin')
  assert.equal(requestScope('/arbitrary-private-string'), 'other')
  assert.equal(statusOutcome(429), 'limited')
  assert.equal(statusOutcome(503), '5xx')
  assert.equal(statusOutcome(101), '1xx')
})

await test('aggregate reader has a fixed query, bounded response and no provider error leakage', async () => {
  const { readMetrics } = await import('../worker/src/metrics-reader.ts')
  const original = globalThis.fetch
  let calls = 0
  let mode = 'ok'
  const env = {
    CLOUDFLARE_TOKEN: 'test-only',
    ANALYTICS_ACCOUNT_ID: 'a'.repeat(32),
    ANALYTICS_DATASET: 'burning_tokens_metrics_preview'
  }
  globalThis.fetch = async (url, options) => {
    calls++
    assert.equal(
      url,
      `https://api.cloudflare.com/client/v4/accounts/${env.ANALYTICS_ACCOUNT_ID}/analytics_engine/sql`
    )
    assert.match(
      options.body,
      /GROUP BY event, outcome, scope LIMIT 500 FORMAT JSON/
    )
    assert.doesNotMatch(options.body, /test-only/)
    if (mode === 'error')
      return new Response('PRIVATE PROVIDER BODY', { status: 403 })
    if (mode === 'oversized') return new Response('x'.repeat(128 * 1024 + 1))
    return Response.json({
      data: [
        {
          event: mode === 'bad-label' ? 'PRIVATE LABEL' : 'http',
          outcome: '2xx',
          scope: 'owner',
          observations: '2',
          meanMs: '5',
          totalAmount: '2',
          totalExtra: '0',
          privateExtra: 'discard this'
        }
      ]
    })
  }
  try {
    await assert.rejects(readMetrics({}), /not configured/)
    await assert.rejects(
      readMetrics({ ...env, ANALYTICS_DATASET: 'table; SQL injection' }),
      /not configured/
    )
    assert.equal(calls, 0)
    const response = await readMetrics(env)
    assert.match(response.headers.get('cache-control'), /no-store/)
    const body = await response.json()
    assert.equal(body.rows[0].observations, 2)
    assert.equal(body.truncated, false)
    assert.doesNotMatch(JSON.stringify(body), /privateExtra|discard/)
    for (mode of ['error', 'oversized', 'bad-label'])
      await assert.rejects(
        readMetrics(env),
        /^Error: Metrics are temporarily unavailable$/
      )
  } finally {
    globalThis.fetch = original
  }
})
