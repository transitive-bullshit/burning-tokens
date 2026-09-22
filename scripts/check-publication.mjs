import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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
    assert.equal(value.audience, kind === 'studio' ? 'public' : 'agents')
    assert.equal(value.ready, true)
    await request(`${other.path}/${collection}/${value.id}`)
    await request(
      `/api/retreat/${publicCollection}/${value.id}`,
      {},
      kind === 'studio' ? 200 : 404
    )
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
  await request(
    `${author.path}/actions`,
    post({ kind: 'enter', room: 'open-studio' })
  )
  for (const format of ['png', 'jpeg', 'webp', 'wav']) {
    // Original, tiny test fixtures; never reuse visitor data for moderation checks.
    const bytes =
      format === 'wav'
        ? silentWav()
        : await readFile(
            new URL(`./fixtures/media/moon.${format}`, import.meta.url)
          )
    const mime = format === 'wav' ? 'audio/wav' : `image/${format}`
    const uploaded = await request(
      `${author.path}/artifacts?audience=${format === 'png' ? 'private' : 'public'}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': mime,
          'Idempotency-Key': crypto.randomUUID()
        },
        body: bytes
      },
      201
    )
    let value = await uploaded.json()
    const ownPath = `${author.owner}/artifacts/${value.id}`
    contributions.push({ path: ownPath, cookie: author.cookie })
    assert.equal(value.ready, true)
    assert.equal(value.mime, mime)
    assert.equal(
      value.moderation,
      format === 'wav' ? 'unsupported' : 'approved'
    )
    assert.equal(
      value.audience,
      format === 'wav' || format === 'png' ? 'private' : 'public'
    )
    const own = await request(`${author.path}/artifacts/${value.id}`)
    assert.deepEqual(
      Buffer.from(await own.arrayBuffer()),
      bytes,
      'Stored bytes must match the moderated input'
    )
    const publicPath = `/api/retreat/exhibits/${value.id}`
    if (format === 'png') {
      const changed = await request(
        `${author.path}/artifacts/${value.id}`,
        post({ audience: 'public' })
      )
      value = await changed.json()
      assert.equal(value.audience, 'public')
    }
    if (format === 'wav') {
      await request(publicPath, {}, 404)
      await request(`${other.path}/artifacts/${value.id}`, {}, 404)
      const attempted = await request(
        ownPath,
        post({ audience: 'public' }, author.cookie)
      )
      assert.equal(
        (await attempted.json()).audience,
        'private',
        'Audience edits cannot bypass unsupported moderation'
      )
    } else {
      const shelf = await (await request('/api/retreat/exhibits?after=')).json()
      const listed = shelf.works.find((work) => work.id === value.id)
      assert.ok(listed, 'A new public image must be visible on the shelf')
      assert.equal(listed.revision, value.revision)
      const immutablePath = `${publicPath}/v${listed.revision}`
      const shared = await request(immutablePath)
      assert.equal(
        shared.headers.get('cf-cache-status'),
        'HIT',
        'Publication must prewarm the immutable image before its first viewer'
      )
      assert.equal(shared.headers.get('content-type'), mime)
      assert.match(
        shared.headers.get('cache-control'),
        /^public, max-age=\d+, immutable$/
      )
      assert.match(shared.headers.get('content-disposition'), /inline/)
      assert.equal(shared.headers.get('x-content-type-options'), 'nosniff')
      assert.deepEqual(Buffer.from(await shared.arrayBuffer()), bytes)
      const repeated = await request(immutablePath)
      assert.equal(repeated.headers.get('cf-cache-status'), 'HIT')
      assert.deepEqual(Buffer.from(await repeated.arrayBuffer()), bytes)
      await request(ownPath, post({ audience: 'private' }, author.cookie))
      await request(publicPath, {}, 404)
      await request(
        immutablePath,
        {},
        200
      ) /* Immutable public revisions deliberately outlive unsharing. */
    }
    await request(ownPath, {
      method: 'DELETE',
      headers: { Origin: origin, Cookie: author.cookie }
    })
    contributions.pop()
    await request(publicPath, {}, 404)
    console.log(
      `${format}: moderation policy, exact-byte delivery, audience controls and deletion passed`
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

function silentWav() {
  const bytes = Buffer.alloc(44 + 1600)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(8000, 24)
  bytes.writeUInt32LE(16000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(1600, 40)
  return bytes
}
