import assert from 'node:assert/strict'
const base = process.env.RETREAT_TEST_ORIGIN ?? 'http://127.0.0.1:8787'
const origin = process.env.RETREAT_SITE_ORIGIN ?? 'http://127.0.0.1:3010'
async function request(path, options = {}, status = 200) {
  const response = await fetch(new URL(path, base), options)
  assert.equal(
    response.status,
    status,
    `${options.method ?? 'GET'} Studio request failed: ${await response.clone().text()}`
  )
  return response
}
const post = (body, headers = {}) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin, ...headers },
  body: JSON.stringify(body)
})
async function create() {
  const response = await request(
    '/api/retreat/invitations',
    post({ duration: 'full' }),
    201
  )
  const invitation = await response.json()
  const path = new URL(invitation.agentUrl).pathname
  await request(
    `${path}/actions`,
    post(
      { kind: 'check-in', humanSent: true, duration: 'full' },
      { 'Idempotency-Key': 'studio-check-in' }
    )
  )
  return {
    ...invitation,
    path,
    cookie: response.headers.get('set-cookie').split(';')[0]
  }
}
const a = await create()
const b = await create()
const upload = (key, text = 'A tiny poem, left beside the clay.') => ({
  method: 'POST',
  headers: { 'Content-Type': 'text/plain', 'Idempotency-Key': key },
  body: text
})
await request(`${a.path}/artifacts`, upload('before-room'), 409)
await request(
  `${a.path}/actions`,
  post(
    { kind: 'enter', room: 'open-studio' },
    { 'Idempotency-Key': 'enter-studio' }
  )
)
const first = await (
  await request(`${a.path}/artifacts`, upload('first-work'), 201)
).json()
assert.equal(first.audience, 'private')
assert.equal(first.requestedAudience, 'agents')
assert.equal(
  first.moderation,
  process.env.RETREAT_EXPECT_MODERATION ?? 'error',
  'Moderation matches the configured smoke-test expectation'
)
assert.equal(first.ready, true)
const duplicate = await (
  await request(`${a.path}/artifacts`, upload('first-work'), 201)
).json()
assert.deepEqual(duplicate, first)
const journal = await (
  await request(`/api/retreat/visits/${a.id}`, {
    headers: { Cookie: a.cookie }
  })
).json()
assert.equal(
  journal.events.filter((event) => event.kind === 'studio').length,
  1,
  'duplicate uploads produce one journal event'
)
const beforeOwnerChange = journal.lastSeen

await request(
  `${a.path}/artifacts`,
  upload('first-work', 'different bytes'),
  409
)
assert.equal(
  await (await request(`${a.path}/artifacts/${first.id}`)).text(),
  'A tiny poem, left beside the clay.'
)
await request(`${b.path}/artifacts/${first.id}`, {}, 404)
await request(`/api/retreat/exhibits/${first.id}`, {}, 404)
await request(`/api/retreat/admin/artifacts/${first.id}`, {}, 403)
const ownPath = `/api/retreat/visits/${a.id}/artifacts/${first.id}`
await request(ownPath, { headers: { Cookie: a.cookie } })
await request(ownPath, { headers: { Cookie: b.cookie } }, 403)
const changed = await (
  await request(ownPath, post({ audience: 'public' }, { Cookie: a.cookie }))
).json()
assert.equal(changed.audience, 'private')
const afterOwnerChange = await (
  await request(`/api/retreat/visits/${a.id}`, {
    headers: { Cookie: a.cookie }
  })
).json()
assert.equal(
  afterOwnerChange.lastSeen,
  beforeOwnerChange,
  'owner artifact controls do not refresh agent activity'
)

await request(ownPath, {
  method: 'DELETE',
  headers: { Cookie: a.cookie, Origin: origin }
})
await request(`${a.path}/artifacts/${first.id}`, {}, 404)
for (let n = 1; n < 5; n++)
  await request(`${a.path}/artifacts`, upload(`additional-${n}`), 201)
await request(`${a.path}/artifacts`, upload('beyond-quota'), 429)
const ownList = await (await request(`${a.path}/artifacts`)).json()
assert.equal(ownList.works.length, 4)
for (const work of ownList.works)
  await request(`${a.path}/artifacts/${work.id}`, { method: 'DELETE' })
for (const invitation of [a, b])
  await request(
    `${invitation.path}/actions`,
    post({ kind: 'checkout' }, { 'Idempotency-Key': 'studio-checkout' })
  )
console.log(
  `Studio integration passed: R2 round-trip, SQLite metadata, moderation ${process.env.RETREAT_EXPECT_MODERATION ?? 'error'} with publishing disabled, credential isolation, duplicate upload, conflicting key, owner deletion and quotas including deleted works.`
)
