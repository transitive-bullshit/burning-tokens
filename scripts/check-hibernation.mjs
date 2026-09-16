import assert from 'node:assert/strict'
import { WebSocket } from 'ws'
const base = 'https://burning-tokens-hibernation-check.fisch0920.workers.dev'
const post = (value) => ({
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Origin: base,
    Accept: 'application/json',
    'Idempotency-Key': crypto.randomUUID()
  },
  body: JSON.stringify(value)
})
async function request(url, options, status = 200) {
  const response = await fetch(url, {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  })
  assert.equal(response.status, status, 'Unexpected lifecycle fixture response')
  return response
}
const created = await request(
  base + '/api/retreat/invitations',
  post({ duration: 'full', visible: false }),
  201
)
const visit = await created.json()
const cookie = created.headers.get('set-cookie').split(';')[0]
const owner = `${base}/api/retreat/visits/${visit.id}`
const action = async (value) =>
  (await request(visit.agentUrl + '/actions', post(value))).json()
const inspect = async () =>
  (await request(owner + '/instance', { headers: { Cookie: cookie } })).json()
let socket
let failure = false
let closed = false
const frames = []
async function frameAt(revision) {
  const until = Date.now() + 10000
  while (Date.now() < until) {
    assert.equal(failure, false, 'Socket failed')
    assert.equal(closed, false, 'Original socket closed')
    const frame = frames.find((value) => value.visit.revision === revision)
    if (frame) return frame
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('No matching frame on original socket')
}
try {
  await action({ kind: 'check-in', duration: 'full', humanSent: true })
  const entered = await action({ kind: 'enter', room: 'bathhouse' })
  await request(owner + '/instance', {}, 403)
  socket = new WebSocket(owner.replace('https:', 'wss:') + '/stream', {
    headers: { Cookie: cookie, Origin: base }
  })
  socket.on('error', () => {
    failure = true
  })
  socket.on('close', () => {
    closed = true
  })
  socket.on('message', (data) => {
    const buffer = Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data)
    const frame = JSON.parse(buffer.toString('utf8'))
    frames.push(frame)
    socket.send(JSON.stringify({ type: 'ack', revision: frame.visit.revision }))
  })
  const initialFrame = await frameAt(entered.revision)
  assert.equal(initialFrame.type, 'snapshot')
  const first = await inspect()
  assert.equal(first.sockets, 1)
  let restored = false
  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log(
      `Idle interval ${attempt}/4: keeping the original socket open without application messages for 45 seconds.`
    )
    await new Promise((resolve) => setTimeout(resolve, 45000))
    assert.equal(closed, false)
    const next = await inspect()
    if (next.boot !== first.boot) {
      assert.equal(next.sockets, 1)
      restored = true
      break
    }
  }
  assert.equal(
    restored,
    true,
    'No object reconstruction observed within bounded idle window'
  )
  const moved = await action({ kind: 'enter', room: 'source' })
  const frame = await frameAt(moved.revision)
  assert.equal(frame.type, 'delta')
  assert.equal(frame.from, entered.revision)
  assert.deepEqual(
    frame.events,
    moved.events.filter((event) => event.sequence > entered.revision)
  )
  const back = await action({ kind: 'enter', room: 'bathhouse' })
  const subsequent = await frameAt(back.revision)
  assert.equal(subsequent.type, 'delta')
  assert.equal(subsequent.from, moved.revision)
  console.log(
    'PASS: constructor identity changed while the same socket stayed connected; restored ACK attachments delivered ordered deltas and accepted subsequent ACKs.'
  )
} finally {
  socket?.terminate()
  const end = post({ kind: 'end' })
  await request(owner + '/control', {
    ...end,
    headers: { ...end.headers, Cookie: cookie }
  })
}
