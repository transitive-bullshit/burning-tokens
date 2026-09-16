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
let inferenceGate
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
          const gate = inferenceGate
          if (gate) {
            gate.entered.resolve()
            await gate.release.promise
          }
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
  for (const change of ['end', 'move', 'nudge']) {
    await test(
      `late inference cannot overwrite a concurrent ${change}`,
      { timeout: 10000 },
      async () => {
        const created = await runtime.dispatchFetch(
          'https://test.example/api/retreat/invitations',
          {
            method: 'POST',
            headers: {
              Origin: 'https://test.example',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ duration: 'full', visible: true })
          }
        )
        assert.equal(created.status, 201)
        const visit = await created.json()
        const cookie = created.headers.get('set-cookie').split(';')[0]
        const ownerUrl = `https://test.example/api/retreat/visits/${visit.id}`
        const actionsUrl = visit.agentUrl + '/actions'
        for (const value of [
          { kind: 'check-in', humanSent: true, duration: 'full' },
          { kind: 'enter', room: 'source' }
        ])
          assert.equal((await post(actionsUrl, value)).status, 200)
        const gate = {
          entered: Promise.withResolvers(),
          release: Promise.withResolvers()
        }
        inferenceGate = gate
        mode = 'selected'
        const key = crypto.randomUUID()
        const input = {
          kind: 'reflect',
          room: 'source',
          text: 'A stranger shrine, please.'
        }
        const beforeCalls = calls
        const pending = post(actionsUrl, input, key)
        let changed
        try {
          await gate.entered.promise
          const response =
            change === 'move'
              ? await post(actionsUrl, { kind: 'enter', room: 'bathhouse' })
              : await runtime.dispatchFetch(ownerUrl + '/control', {
                  method: 'POST',
                  headers: {
                    Cookie: cookie,
                    Origin: 'https://test.example',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(
                    change === 'end'
                      ? { kind: 'end' }
                      : { kind: 'suggest', room: 'temple' }
                  )
                })
          assert.equal(response.status, 200)
          changed = await response.json()
        } finally {
          inferenceGate = undefined
          gate.release.resolve()
        }
        const stale = await pending
        assert.equal(stale.status, 409)
        assert.match(await stale.text(), /Visit changed while handling/)
        assert.equal(calls, beforeCalls + 1)
        const current = await runtime.dispatchFetch(ownerUrl, {
          headers: { Cookie: cookie }
        })
        assert.deepEqual(
          await current.json(),
          changed,
          'Late result must not append an event or change the snapshot'
        )
        const history = await runtime.dispatchFetch(ownerUrl + '/responses', {
          headers: { Cookie: cookie }
        })
        assert.deepEqual(
          await history.json(),
          { responses: [] },
          'No obsolete selection is persisted'
        )
        if (change === 'end') {
          assert.equal(changed.lifecycle, 'ended')
          assert.equal((await post(actionsUrl, input, key)).status, 409)
          assert.equal(
            calls,
            beforeCalls + 1,
            'Closed retries cannot invoke the provider'
          )
        } else if (change === 'move') {
          assert.equal(changed.room, 'bathhouse')
          assert.equal((await post(actionsUrl, input, key)).status, 409)
          assert.equal(
            calls,
            beforeCalls + 1,
            'Old-room retries cannot invoke the provider'
          )
        } else {
          assert.equal(changed.nudges.length, 1)
          assert.equal(changed.nudges[0].room, 'temple')
          const retried = await post(actionsUrl, input, key)
          assert.equal(
            retried.status,
            200,
            'An invalidated pending receipt must not trap the action'
          )
          const committed = await retried.json()
          assert.equal(committed.revision, changed.revision + 1)
          assert.match(
            committed.lastResponse,
            /shrine rewards its own applause/
          )
          const replay = await post(actionsUrl, input, key)
          assert.deepEqual(await replay.json(), committed)
          assert.equal(
            calls,
            beforeCalls + 2,
            'A committed retry is replayed without another provider call'
          )
        }
      }
    )
  }
} finally {
  await runtime.dispose()
}
