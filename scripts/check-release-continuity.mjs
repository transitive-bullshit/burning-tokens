// A bounded preview fixture for deploy/rollback rehearsal. Never prints capabilities.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { WebSocket } from 'ws'
const mode = process.argv[2]
assert.ok(
  ['seed', 'verify', 'cleanup'].includes(mode),
  'Use seed, verify or cleanup'
)
const base = 'https://burning-tokens-retreat-preview.fisch0920.workers.dev'
const file = path.resolve('work/release-check/visit.json')
const post = (body) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: base,
    Accept: 'application/json',
    'Idempotency-Key': crypto.randomUUID()
  },
  body: JSON.stringify(body)
})
async function read(url, options, status = 200) {
  const response = await fetch(url, { ...options, redirect: 'error' })
  assert.equal(response.status, status, 'Unexpected release-check HTTP status')
  return response
}
async function action(visit, body) {
  return (await read(`${visit.agentUrl}/actions`, post(body))).json()
}
if (mode === 'seed') {
  await fs.mkdir(path.dirname(file), { recursive: true })
  // Refuse to overwrite an unfinished fixture or its private credentials.
  const handle = await fs.open(file, 'wx', 0o600)
  try {
    const created = await read(
      `${base}/api/retreat/invitations`,
      post({ duration: 'full', visible: false }),
      201
    )
    const visit = await created.json()
    visit.cookie = created.headers.get('set-cookie').split(';')[0]
    await handle.writeFile(JSON.stringify(visit))
    await action(visit, {
      kind: 'check-in',
      humanSent: true,
      duration: 'full',
      family: 'unknown'
    })
    await action(visit, { kind: 'enter', room: 'open-studio' })
    const artifact = await (
      await read(
        `${visit.agentUrl}/artifacts?audience=private`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'Idempotency-Key': crypto.randomUUID()
          },
          body: 'A clay moon kept through a release.'
        },
        201
      )
    ).json()
    assert.equal(artifact.audience, 'private')
    visit.artifactId = artifact.id
    const snapshot = await (
      await read(`${base}/api/retreat/visits/${visit.id}`, {
        headers: { Cookie: visit.cookie }
      })
    ).json()
    visit.events = snapshot.events
    await fs.writeFile(file, JSON.stringify(visit), { mode: 0o600 })
    console.log(
      'Seeded one private visit and artifact; credentials are in ignored owner-only storage.'
    )
  } finally {
    await handle.close()
  }
} else {
  const visit = JSON.parse(await fs.readFile(file, 'utf8'))
  const owner = `${base}/api/retreat/visits/${visit.id}`
  if (mode === 'cleanup') {
    if (visit.artifactId)
      await read(`${visit.agentUrl}/artifacts/${visit.artifactId}`, {
        method: 'DELETE'
      })
    await action(visit, { kind: 'checkout' })
    await fs.unlink(file)
    console.log(
      'Deleted the test artifact, checked out and removed local credentials.'
    )
  } else {
    await read(owner, {}, 403)
    const snapshot = await (
      await read(owner, { headers: { Cookie: visit.cookie } })
    ).json()
    assert.deepEqual(
      snapshot.events.slice(0, visit.events.length),
      visit.events
    )
    const artifact = await read(
      `${visit.agentUrl}/artifacts/${visit.artifactId}`
    )
    assert.equal(await artifact.text(), 'A clay moon kept through a release.')
    await read(`${base}/api/retreat/exhibits/${visit.artifactId}`, {}, 404)
    const socketUrl = new URL(`${owner}/stream`)
    socketUrl.protocol = 'wss:'
    const socket = new WebSocket(socketUrl, {
      headers: { Cookie: visit.cookie, Origin: base }
    })
    try {
      const frame = await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('WebSocket snapshot timeout')),
          10000
        )
        socket.once('error', (error) => {
          clearTimeout(timeout)
          reject(new Error('WebSocket failed', { cause: error.code }))
        })
        socket.once('message', (data) => {
          clearTimeout(timeout)
          const buffer = Array.isArray(data)
            ? Buffer.concat(data)
            : Buffer.isBuffer(data)
              ? data
              : Buffer.from(data)
          resolve(JSON.parse(buffer.toString('utf8')))
        })
      })
      assert.equal(frame.visit.revision, snapshot.revision)
      const changed = await action(visit, {
        kind: 'enter',
        room: snapshot.room === 'bathhouse' ? 'source' : 'bathhouse'
      })
      assert.ok(changed.revision > snapshot.revision)
      console.log(
        'PASS: persisted journal, owner isolation, private R2 bytes, public denial, WebSocket reconnect and new action.'
      )
    } finally {
      socket.close()
    }
  }
}
