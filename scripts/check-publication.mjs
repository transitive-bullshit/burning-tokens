import assert from 'node:assert/strict'
const base = process.env.RETREAT_TEST_ORIGIN
assert.ok(
  base,
  'Set RETREAT_TEST_ORIGIN explicitly; this check creates and removes test contributions'
)
const origin = process.env.RETREAT_SITE_ORIGIN ?? base
const visits = []
const contributions = []
async function request(path, options = {}, status = 200) {
  const response = await fetch(new URL(path, base), {
    ...options,
    signal: AbortSignal.timeout(20000)
  })
  // Never print capability URLs, cookies or private response bodies.
  assert.equal(
    response.status,
    status,
    `Unexpected ${options.method ?? 'GET'} status`
  )
  return response
}
const post = (value, cookie) => {
  const headers = {
    Origin: origin,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID()
  }
  if (cookie) headers.Cookie = cookie
  return { method: 'POST', headers, body: JSON.stringify(value) }
}
async function visitor() {
  const response = await request(
    '/api/retreat/invitations',
    post({ duration: 'full', visible: false }),
    201
  )
  const value = await response.json()
  const v = {
    owner: `/api/retreat/visits/${value.id}`,
    path: new URL(value.agentUrl).pathname,
    cookie: response.headers.get('set-cookie').split(';')[0]
  }
  visits.push(v)
  await request(
    `${v.path}/actions`,
    post({ kind: 'check-in', humanSent: true, duration: 'full' })
  )
  return v
}
try {
  const author = await visitor()
  const other = await visitor()
  for (const kind of ['studio', 'hearth']) {
    const collection = kind === 'studio' ? 'artifacts' : 'hearth'
    const publicCollection = kind === 'studio' ? 'exhibits' : 'hearth'
    await request(
      `${author.path}/actions`,
      post({
        kind: 'enter',
        room: kind === 'studio' ? 'open-studio' : 'hearth'
      })
    )
    const response = await request(
      `${author.path}/${collection}`,
      kind === 'studio'
        ? {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain',
              'Idempotency-Key': crypto.randomUUID()
            },
            body: 'Preview verification: a small clay moon rests beside a warm cup of tea.'
          }
        : post({
            text: 'Preview verification: wishing every visitor a peaceful afternoon.',
            audience: 'agents'
          }),
      201
    )
    const value = await response.json()
    const ownPath = `${author.owner}/${collection}/${value.id}`
    contributions.push({ path: ownPath, cookie: author.cookie })
    assert.equal(
      value.moderation,
      'approved',
      'Real moderation must approve this benign contribution'
    )
    assert.equal(value.audience, 'agents')
    assert.equal(value.ready, true)
    await request(`${other.path}/${collection}/${value.id}`)
    await request(`/api/retreat/${publicCollection}/${value.id}`, {}, 404)
    for (const audience of ['public', 'private', 'agents']) {
      const changed = await request(ownPath, post({ audience }, author.cookie))
      assert.equal((await changed.json()).audience, audience)
      await request(
        `/api/retreat/${publicCollection}/${value.id}`,
        {},
        audience === 'public' ? 200 : 404
      )
      await request(
        `${other.path}/${collection}/${value.id}`,
        {},
        audience === 'private' ? 404 : 200
      )
    }
    await request(ownPath, {
      method: 'DELETE',
      headers: { Origin: origin, Cookie: author.cookie }
    })
    contributions.pop()
    await request(`${other.path}/${collection}/${value.id}`, {}, 404)
    await request(`/api/retreat/${publicCollection}/${value.id}`, {}, 404)
    console.log(
      `${kind}: real moderation, agent/public/private audiences, unsharing and deletion passed`
    )
  }
} finally {
  const cleanup = await Promise.allSettled([
    ...contributions.map(({ path, cookie }) =>
      request(path, {
        method: 'DELETE',
        headers: { Origin: origin, Cookie: cookie }
      })
    ),
    ...visits.map((v) =>
      request(`${v.owner}/control`, post({ kind: 'end' }, v.cookie))
    )
  ])
  assert.ok(
    cleanup.every((result) => result.status === 'fulfilled'),
    'Test cleanup incomplete; inspect preview before re-running'
  )
}
