import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
const requireWrangler = createRequire(import.meta.resolve('wrangler'))
const { Miniflare, convertV4MiniflareOptions } = requireWrangler('miniflare')
const { build } = requireWrangler('esbuild')
const bundled = await build({
  entryPoints: [
    process.env.RETREAT_PRODUCTION_ENTRY
      ? 'worker/src/index.ts'
      : 'scripts/fixtures/publication-fault-worker.mjs'
  ],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['cloudflare:workers']
})
let authorizationGate
let authorizationFailure = false
let moderationGate
function holdModeration() {
  let release, started
  const wait = new Promise((resolve) => {
    release = resolve
  })
  const entered = new Promise((resolve) => {
    started = resolve
  })
  moderationGate = { wait, started }
  return {
    entered,
    release: () => {
      moderationGate = undefined
      release()
    }
  }
}
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'publication-check',
        script: bundled.outputFiles[0].text,
        modules: true,
        compatibilityDate: '2026-09-15',
        compatibilityFlags: ['nodejs_compat'],
        durableObjects: Object.fromEntries(
          Object.entries({
            SESSIONS: 'RetreatSession',
            STUDIO: 'RetreatStudio',
            LOUNGE: 'RetreatLounge',
            PRESENCE: 'RetreatPresence',
            BUDGET: 'InferenceBudget'
          }).map(([key, className]) => [key, { className, useSQLite: true }])
        ),
        r2Buckets: ['MEDIA'],
        bindings: {
          PUBLIC_ORIGIN: 'https://test.example',
          PUBLISHING_ENABLED: 'true',
          TYPESAFE_ENABLED: 'false',
          OPENAI_API_KEY: 'test-only-not-a-secret'
        },
        outboundService: async (request) => {
          if (
            request.url === 'https://publication-fixture.invalid/authorization'
          ) {
            const gate = authorizationGate
            if (gate) {
              gate.started()
              await gate.wait
            }
            return new Response('', {
              status: authorizationFailure ? 503 : 200
            })
          }
          assert.equal(request.url, 'https://api.openai.com/v1/moderations')
          const gate = moderationGate
          if (gate) {
            gate.started()
            await gate.wait
          }
          return Response.json({
            model: 'fixture-moderation',
            results: [{ flagged: false }]
          })
        }
      }
    ]
  })
)
const post = (value, cookie) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://test.example',
    ...(cookie ? { Cookie: cookie } : {})
  },
  body: JSON.stringify(value)
})
const request = (path, options) =>
  runtime.dispatchFetch(`https://test.example${path}`, options)
async function visitor(room) {
  const created = await request(
    '/api/retreat/invitations',
    post({ duration: 'full', visible: false })
  )
  assert.equal(created.status, 201)
  const value = await created.json()
  const cookie = created.headers.get('set-cookie').split(';')[0]
  const path = new URL(value.agentUrl).pathname
  for (const action of [
    { kind: 'check-in', humanSent: true, duration: 'full' },
    { kind: 'enter', room }
  ]) {
    const options = post(action)
    options.headers['Idempotency-Key'] = crypto.randomUUID()
    assert.equal((await request(`${path}/actions`, options)).status, 200)
  }
  return {
    path,
    owner: `/api/retreat/visits/${value.id}`,
    cookie,
    close: () =>
      request(
        `/api/retreat/visits/${value.id}/control`,
        post({ kind: 'end' }, cookie)
      ),
    upload: () =>
      request(`${path}/artifacts?audience=public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Idempotency-Key': crypto.randomUUID()
        },
        body: 'A public clay moon.'
      }),
    message: () =>
      request(`${path}/hearth`, {
        ...post({ text: 'A public greeting.', audience: 'public' }),
        headers: { ...post({}).headers, 'Idempotency-Key': crypto.randomUUID() }
      })
  }
}
try {
  await test('approved publication is committed in the Session journal before being shared', async () => {
    const v = await visitor('open-studio')
    const response = await v.upload()
    assert.equal(response.status, 201)
    const work = await response.json()
    assert.equal(work.audience, 'public')
    assert.equal(
      (await request(`/api/retreat/exhibits/${work.id}`)).status,
      200
    )
    const state = await (
      await request(v.owner, { headers: { Cookie: v.cookie } })
    ).json()
    assert.equal(
      state.events.filter((event) => event.kind === 'publication').length,
      1
    )
    await v.close()
    assert.equal(
      (await request(`/api/retreat/exhibits/${work.id}`)).status,
      200,
      'ending does not revoke already committed sharing'
    )
  })
  for (const kind of ['studio', 'hearth']) {
    await test(`ending during ${kind} moderation prevents publication`, async () => {
      const v = await visitor(kind === 'studio' ? 'open-studio' : 'hearth')
      const gate = holdModeration()
      const pending = kind === 'studio' ? v.upload() : v.message()
      try {
        await gate.entered
        assert.equal((await v.close()).status, 200)
      } finally {
        gate.release()
      }
      const response = await pending
      assert.equal(response.status, 201)
      const contribution = await response.json()
      assert.equal(contribution.ready, true)
      assert.equal(contribution.audience, 'private')
      assert.equal(
        (
          await request(
            `/api/retreat/${kind === 'studio' ? 'exhibits' : 'hearth'}/${contribution.id}`
          )
        ).status,
        404
      )
      const state = await (
        await request(v.owner, { headers: { Cookie: v.cookie } })
      ).json()
      assert.equal(
        state.events.filter((event) => event.kind === 'publication').length,
        0
      )
    })
  }
  for (const kind of ['studio', 'hearth']) {
    const collection = kind === 'studio' ? 'artifacts' : 'hearth'
    const publicCollection = kind === 'studio' ? 'exhibits' : 'hearth'
    for (const operation of ['unshare', 'delete']) {
      await test(`${kind}: owner ${operation} wins over a delayed committed grant`, async () => {
        const v = await visitor(kind === 'studio' ? 'open-studio' : 'hearth')
        let started, release
        const entered = new Promise((resolve) => {
          started = resolve
        })
        const wait = new Promise((resolve) => {
          release = resolve
        })
        authorizationGate = { started, wait }
        const pending = kind === 'studio' ? v.upload() : v.message()
        let id
        try {
          await entered
          const state = await (
            await request(v.owner, { headers: { Cookie: v.cookie } })
          ).json()
          assert.equal(
            state.events.filter((event) => event.kind === 'publication').length,
            1
          )
          const list = await (
            await request(`${v.owner}/${collection}`, {
              headers: { Cookie: v.cookie }
            })
          ).json()
          id = (list.works ?? list.messages)[0].id
          assert.equal(
            (await request(`/api/retreat/${publicCollection}/${id}`)).status,
            404
          )
          const options =
            operation === 'unshare'
              ? post({ audience: 'private' }, v.cookie)
              : {
                  method: 'DELETE',
                  headers: { Cookie: v.cookie, Origin: 'https://test.example' }
                }
          assert.equal(
            (await request(`${v.owner}/${collection}/${id}`, options)).status,
            200
          )
        } finally {
          authorizationGate = undefined
          release()
        }
        const response = await pending
        assert.equal(response.status, 201)
        const value = await response.json()
        assert.equal(value.audience, 'private')
        if (operation === 'delete') assert.equal(value.deleted, true)
        else assert.equal(value.requestedAudience, 'private')
        assert.equal(
          (await request(`/api/retreat/${publicCollection}/${id}`)).status,
          404
        )
        await v.close()
      })
    }
    await test(`${kind}: lost authorization response leaves approved content private`, async () => {
      const v = await visitor(kind === 'studio' ? 'open-studio' : 'hearth')
      authorizationFailure = true
      let value
      try {
        const response = await (kind === 'studio' ? v.upload() : v.message())
        assert.equal(response.status, 201)
        value = await response.json()
      } finally {
        authorizationFailure = false
      }
      assert.equal(value.ready, true)
      assert.equal(value.audience, 'private')
      assert.equal(
        (await request(`/api/retreat/${publicCollection}/${value.id}`)).status,
        404
      )
      // A new explicit owner decision can recover without uploading another copy.
      const retry = await request(
        `${v.owner}/${collection}/${value.id}`,
        post({ audience: 'public' }, v.cookie)
      )
      assert.equal(retry.status, 200)
      assert.equal((await retry.json()).audience, 'public')
      assert.equal(
        (await request(`/api/retreat/${publicCollection}/${value.id}`)).status,
        200
      )
      await v.close()
    })
  }
  for (const kind of ['studio', 'hearth']) {
    await test(`${kind}: audience changes enforce author, other-agent and public boundaries`, async () => {
      const room = kind === 'studio' ? 'open-studio' : 'hearth'
      const collection = kind === 'studio' ? 'artifacts' : 'hearth'
      const publicCollection = kind === 'studio' ? 'exhibits' : 'hearth'
      const author = await visitor(room)
      const other = await visitor(room)
      const created = await (kind === 'studio'
        ? author.upload()
        : author.message())
      assert.equal(created.status, 201)
      const { id } = await created.json()
      for (const audience of ['agents', 'private', 'public', 'private']) {
        const changed = await request(
          `${author.owner}/${collection}/${id}`,
          post({ audience }, author.cookie)
        )
        assert.equal(changed.status, 200)
        assert.equal((await changed.json()).audience, audience)
        assert.equal(
          (await request(`${author.path}/${collection}/${id}`)).status,
          200
        )
        assert.equal(
          (await request(`${other.path}/${collection}/${id}`)).status,
          audience === 'private' ? 404 : 200
        )
        assert.equal(
          (await request(`/api/retreat/${publicCollection}/${id}`)).status,
          audience === 'public' ? 200 : 404
        )
        // A spectator cannot forge the internal viewer header to gain agent access.
        assert.equal(
          (
            await request(`/api/retreat/${publicCollection}/${id}`, {
              headers: { 'X-Retreat-Viewer': JSON.stringify({ kind: 'admin' }) }
            })
          ).status,
          audience === 'public' ? 200 : 404
        )
        const otherOwner = await request(`${other.owner}/${collection}`, {
          headers: { Cookie: other.cookie }
        })
        const listed = await otherOwner.json()
        assert.equal(
          (listed.works ?? listed.messages).some((value) => value.id === id),
          false
        )
      }
      await author.close()
      await other.close()
    })
  }
  await test('owner unsharing during moderation remains private after approval', async () => {
    const v = await visitor('open-studio')
    const gate = holdModeration()
    const pending = v.upload()
    try {
      await gate.entered
      const list = await (
        await request(`${v.owner}/artifacts`, { headers: { Cookie: v.cookie } })
      ).json()
      assert.equal(list.works.length, 1)
      assert.equal(
        (
          await request(
            `${v.owner}/artifacts/${list.works[0].id}`,
            post({ audience: 'private' }, v.cookie)
          )
        ).status,
        200
      )
    } finally {
      gate.release()
    }
    const work = await (await pending).json()
    assert.equal(work.audience, 'private')
    assert.equal(work.requestedAudience, 'private')
    assert.equal(
      (await request(`/api/retreat/exhibits/${work.id}`)).status,
      404
    )
    await v.close()
  })
} finally {
  await runtime.dispose()
}
