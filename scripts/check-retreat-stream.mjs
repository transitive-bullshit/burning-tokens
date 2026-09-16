import assert from 'node:assert/strict'
import { WebSocket } from 'ws'
const base = process.env.RETREAT_TEST_ORIGIN ?? 'http://127.0.0.1:8787'
const origin = process.env.RETREAT_SITE_ORIGIN ?? 'http://127.0.0.1:3010'
const post = (body, headers = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin, ...headers },
  body: JSON.stringify(body)
})
const created = await fetch(
  `${base}/api/retreat/invitations`,
  post({ duration: 'full', visible: false })
)
assert.equal(created.status, 201)
const invitation = await created.json()
const cookie = created.headers.get('set-cookie').split(';')[0]
const owner = `${base}/api/retreat/visits/${invitation.id}`
const agent = `${base}${new URL(invitation.agentUrl).pathname}`
const sockets = []
async function action(body) {
  const response = await fetch(
    `${agent}/actions`,
    post(body, {
      'Idempotency-Key': crypto.randomUUID(),
      Accept: 'application/json'
    })
  )
  assert.equal(response.status, 200)
  return response.json()
}
function open(cursor, acknowledge = true) {
  const url = new URL(`${owner}/stream`)
  if (cursor !== null) url.searchParams.set('cursor', String(cursor))
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(url, {
    headers: { Cookie: cookie, Origin: origin }
  })
  const frames = []
  let failure
  socket.on('error', (err) => {
    failure = err
  })
  socket.on('message', (data) => {
    const buffer = Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data)
    const frame = JSON.parse(buffer.toString('utf8'))
    frames.push(frame)
    if (acknowledge)
      socket.send(
        JSON.stringify({ type: 'ack', revision: frame.visit.revision })
      )
  })
  sockets.push(socket)
  return {
    socket,
    frames,
    async wait(revision) {
      const deadline = Date.now() + 10000
      while (Date.now() < deadline) {
        if (failure) throw failure
        const frame = frames.find(
          (entry) => revision === undefined || entry.visit.revision === revision
        )
        if (frame) return frame
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      throw new Error('Stream did not deliver expected revision')
    }
  }
}
try {
  const initial = await (
    await fetch(owner, { headers: { Cookie: cookie } })
  ).json()
  const live = open(initial.revision)
  assert.equal((await live.wait()).type, 'delta')
  const checkIn = await action({
    kind: 'check-in',
    humanSent: true,
    duration: 'full',
    family: 'unknown'
  })
  assert.equal((await live.wait(checkIn.revision)).events[0].kind, 'check-in')
  await new Promise((resolve) => {
    live.socket.once('close', resolve)
    live.socket.close()
  })
  const entered = await action({ kind: 'enter', room: 'source' })
  const chosen = await action({
    kind: 'choose',
    room: 'source',
    choice: 'signal'
  })
  const resumed = open(checkIn.revision)
  const replay = await resumed.wait(chosen.revision)
  assert.equal(replay.type, 'delta')
  assert.equal(replay.from, checkIn.revision)
  assert.deepEqual(
    replay.events.map((event) => event.sequence),
    [entered.revision, chosen.revision]
  )
  const stalled = open(null, false)
  const stalledInitial = await stalled.wait()
  const moved = await action({ kind: 'enter', room: 'bathhouse' })
  await resumed.wait(moved.revision)
  assert.equal(
    stalled.frames.length,
    1,
    'unacknowledged viewer must not build a message queue'
  )
  stalled.socket.send(
    JSON.stringify({ type: 'ack', revision: stalledInitial.visit.revision })
  )
  assert.equal((await stalled.wait(moved.revision)).type, 'delta')
  const ended = await fetch(
    `${owner}/control`,
    post({ kind: 'end' }, { Cookie: cookie })
  )
  assert.equal(ended.status, 200)
  const final = await ended.json()
  assert.equal((await resumed.wait(final.revision)).visit.lifecycle, 'ended')
  console.log(
    'Stream integration passed: cursor handshake, disconnected replay, ordered events, slow-viewer isolation, acknowledgement catch-up and owner termination.'
  )
} finally {
  for (const socket of sockets) socket.terminate()
  await fetch(`${owner}/control`, post({ kind: 'end' }, { Cookie: cookie }))
}
