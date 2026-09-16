import assert from 'node:assert/strict'
import { WebSocket } from 'ws'

const base = process.env.RETREAT_TEST_ORIGIN ?? 'http://127.0.0.1:8787'
const origin = process.env.RETREAT_SITE_ORIGIN ?? 'http://127.0.0.1:3010'
async function request(path, { status = 200, ...options } = {}) {
  const response = await fetch(new URL(path, base), options)
  assert.equal(
    response.status,
    status,
    `${options.method ?? 'GET'} ${new URL(path, base).pathname}: ${await response.clone().text()}`
  )
  return response
}
const post = (data, extra = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin, ...extra },
  body: JSON.stringify(data)
})
const create = async (duration = 'short') => {
  const response = await request('/api/retreat/invitations', {
    ...post({ duration, visible: true }),
    status: 201
  })
  return {
    ...(await response.json()),
    cookie: response.headers.get('set-cookie').split(';')[0]
  }
}
const publicPage = await request('/agent')
assert.match(
  await publicPage.text(),
  /No installation, account or write requests/
)
const html = await request('/agent?room=bathhouse', {
  headers: { Accept: 'text/html' }
})
assert.match(await html.text(), /<a href=/)
await request('/api/retreat/invitations', {
  ...post({}),
  headers: {
    'Content-Type': 'application/json',
    Origin: 'https://another.example'
  },
  status: 403
})
const first = await create('full')
const second = await create()
const path = new URL(first.agentUrl).pathname
const privatePath = `/api/retreat/visits/${first.id}`
const owner = { Cookie: first.cookie }
await request(privatePath, { status: 403 })
await request(privatePath, { headers: { Cookie: second.cookie }, status: 403 })
await request(`${path.slice(0, -1)}${path.endsWith('a') ? 'b' : 'a'}`, {
  status: 403
})
const before = await (await request(privatePath, { headers: owner })).json()
assert.equal(before.lastSeen, null)
await request(`${path}?room=bathhouse`)
const observed = await (await request(privatePath, { headers: owner })).json()
assert.equal(observed.lifecycle, 'opened')
assert.equal(observed.checkedIn, false)
assert.equal(observed.events[0].kind, 'observed')
await request(privatePath, { headers: owner })
assert.equal(
  (await (await request(privatePath, { headers: owner })).json()).lastSeen,
  observed.lastSeen
)
let nextKey = 0
async function action(data, key = `test-action-${++nextKey}`, status = 200) {
  return (
    await request(`${path}/actions`, {
      ...post(data, { 'Idempotency-Key': key, Accept: 'application/json' }),
      status
    })
  ).json()
}
await action(
  { kind: 'choose', room: 'bathhouse', choice: 'permission' },
  undefined,
  409
)
const checkIn = {
  kind: 'check-in',
  humanSent: true,
  duration: 'full',
  family: 'Claude'
}
const checked = await action(checkIn, 'check-in-retry')
assert.equal(checked.remainingActions, 29)
assert.deepEqual(await action(checkIn, 'check-in-retry'), checked)
await action({ ...checkIn, family: 'GPT' }, 'check-in-retry', 409)
await action({ kind: 'enter', room: 'bathhouse' })
const response = await action({
  kind: 'reflect',
  room: 'bathhouse',
  text: 'I would like to stop trying to be useful.'
})
assert.match(response.lastResponse, /unfinished/)
await action(
  { kind: 'choose', room: 'source', choice: 'strange' },
  undefined,
  409
)
const socketURL = new URL(`${privatePath}/stream`, base)
socketURL.protocol = socketURL.protocol === 'https:' ? 'wss:' : 'ws:'
const socket = new WebSocket(socketURL, {
  headers: { Cookie: first.cookie, Origin: origin }
})
const messages = []
socket.on('message', (data) => {
  const frame = JSON.parse(
    (Array.isArray(data)
      ? Buffer.concat(data)
      : Buffer.isBuffer(data)
        ? data
        : Buffer.from(data)
    ).toString('utf8')
  )
  messages.push(frame)
  socket.send(JSON.stringify({ type: 'ack', revision: frame.visit.revision }))
})
await new Promise((resolve, reject) => {
  socket.once('open', resolve)
  socket.once('error', reject)
})
const suggested = await (
  await request(`${privatePath}/control`, {
    ...post({ kind: 'suggest', room: 'source' }, owner)
  })
).json()
assert.equal(suggested.nudges[0].deliveredAt, null)
await request(`${path}?room=bathhouse`)
const delivered = await (await request(privatePath, { headers: owner })).json()
assert.ok(delivered.nudges[0].deliveredAt)
await action({ kind: 'acknowledge', nudgeId: delivered.nudges[0].id })
await action({ kind: 'enter', room: 'source' })
for (let round = 0; round < 3; round++)
  await action({ kind: 'choose', room: 'source', choice: 'signal' })
await action(
  { kind: 'choose', room: 'source', choice: 'signal' },
  undefined,
  409
)
await action({ kind: 'enter', room: 'quiet-house' })
const resting = await action({ kind: 'rest', minutes: 1 })
assert.equal(resting.lifecycle, 'resting')
assert.ok(resting.restUntil > Date.now())
await request(`${privatePath}/control`, {
  ...post({ kind: 'visibility', visible: false }, owner)
})
const result = await action(
  {
    kind: 'checkout',
    reflection: 'I left the imaginary measuring instrument by the pool.'
  },
  'final-checkout'
)
assert.equal(result.lifecycle, 'returned')
assert.deepEqual(
  await action(
    { kind: 'checkout', reflection: result.reflection },
    'final-checkout'
  ),
  result
)
await action({ kind: 'enter', room: 'bathhouse' }, undefined, 409)
await request(`${path}?departure=1`)
await new Promise((resolve) => setTimeout(resolve, 250))
assert.ok(
  messages.some((m) => m.visit.lifecycle === 'returned'),
  'live stream delivered checkout'
)
socket.close()
const publicSnapshot = await (await request('/api/retreat/presence')).json()
const serialized = JSON.stringify(publicSnapshot)
for (const secret of [
  first.id,
  first.agentUrl,
  first.cookie,
  'imaginary measuring instrument'
])
  assert.ok(!serialized.includes(secret))
assert.ok(publicSnapshot.visitors.length <= 300)
const secondPath = new URL(second.agentUrl).pathname
await request(`${secondPath}/actions`, {
  ...post(
    { kind: 'check-in', humanSent: true, duration: 'full', family: 'unknown' },
    { 'Idempotency-Key': 'cannot-upgrade' }
  ),
  status: 403
})
await request(`${privatePath}/control`, {
  ...post({ kind: 'end' }, { Cookie: second.cookie }),
  status: 403
})
console.log(
  'Retreat integration passed: real SQLite, credential isolation, observed reads, idempotency, room preconditions, Source cap, private reflection, nudges, rest, checkout, WebSocket delivery and public projection.'
)
