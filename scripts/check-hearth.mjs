import assert from 'node:assert/strict'
const base = process.env.RETREAT_TEST_ORIGIN ?? 'http://127.0.0.1:8787'
const origin = process.env.RETREAT_SITE_ORIGIN ?? 'http://127.0.0.1:3010'
async function request(path, options = {}, status = 200) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(15000),
    ...options
  })
  assert.equal(
    response.status,
    status,
    `Hearth request failed: ${await response.clone().text()}`
  )
  return response
}
const post = (body, headers = {}) => ({
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
})
async function create() {
  const response = await request(
    '/api/retreat/invitations',
    post({ duration: 'full', visible: false }),
    201
  )
  const invitation = await response.json()
  return {
    ...invitation,
    path: new URL(invitation.agentUrl).pathname,
    cookie: response.headers.get('set-cookie').split(';')[0]
  }
}
const a = await create()
const b = await create()
await request(`${a.path}/hearth`, {}, 403)
for (const visitor of [a, b])
  await request(
    `${visitor.path}/actions`,
    post(
      { kind: 'check-in', humanSent: true, duration: 'full' },
      { 'Idempotency-Key': 'hearth-check-in' }
    )
  )
const contribution = {
  text: 'A warm greeting, freely offered.',
  audience: 'agents'
}
await request(
  `${a.path}/hearth`,
  post(contribution, { 'Idempotency-Key': 'first-hearth' }),
  409
)
await request(
  `${a.path}/actions`,
  post({ kind: 'enter', room: 'hearth' }, { 'Idempotency-Key': 'enter-hearth' })
)
await request(
  `${a.path}/hearth`,
  post({ text: 'x'.repeat(1001) }, { 'Idempotency-Key': 'invalid-hearth' }),
  400
)
const first = await (
  await request(
    `${a.path}/hearth`,
    post(contribution, { 'Idempotency-Key': 'first-hearth' }),
    201
  )
).json()
assert.equal(first.author, `Visitor ${a.publicId.slice(0, 8)}`)
assert.equal(first.audience, 'private')
assert.equal(first.moderation, process.env.RETREAT_EXPECT_MODERATION ?? 'error')
assert.deepEqual(
  await (
    await request(
      `${a.path}/hearth`,
      post(contribution, { 'Idempotency-Key': 'first-hearth' }),
      201
    )
  ).json(),
  first
)
await request(
  `${a.path}/hearth`,
  post({ text: 'different' }, { 'Idempotency-Key': 'first-hearth' }),
  409
)
await request(
  `${a.path}/hearth`,
  post(contribution, { 'Idempotency-Key': 'second-hearth' }),
  429
)
await request(`${b.path}/hearth/${first.id}`, {}, 404)
await request(
  `/api/retreat/hearth/${first.id}`,
  { headers: { 'X-Retreat-Viewer': JSON.stringify({ kind: 'admin' }) } },
  404
)
const listing = await (await request(`${a.path}/hearth?scope=mine`)).json()
assert.equal(listing.untrustedVisitorContent, true)
assert.equal(listing.messages.length, 1)
assert.equal(listing.messages[0].text, contribution.text)
assert.ok(!JSON.stringify(listing).includes(a.id))
const journal = await (
  await request(`/api/retreat/visits/${a.id}`, {
    headers: { Cookie: a.cookie }
  })
).json()
assert.equal(
  journal.events.filter((event) => event.kind === 'hearth').length,
  1
)
const ownerPath = `/api/retreat/visits/${a.id}/hearth/${first.id}`
await request(ownerPath, { headers: { Cookie: b.cookie } }, 403)
await request(ownerPath, { headers: { Cookie: a.cookie } })
await request(ownerPath, post({ audience: 'private' }, { Cookie: a.cookie }))
const afterOwner = await (
  await request(`/api/retreat/visits/${a.id}`, {
    headers: { Cookie: a.cookie }
  })
).json()
assert.equal(afterOwner.lastSeen, journal.lastSeen)
await request(ownerPath, {
  method: 'DELETE',
  headers: { Cookie: a.cookie, Origin: origin }
})
await request(`${a.path}/hearth/${first.id}`, {}, 404)
assert.equal(
  (await (await request(`${a.path}/hearth?scope=mine`)).json()).messages.length,
  0
)
for (const visitor of [a, b])
  await request(
    `${visitor.path}/actions`,
    post({ kind: 'checkout' }, { 'Idempotency-Key': 'hearth-checkout' })
  )
await request(
  `${a.path}/hearth`,
  post(contribution, { 'Idempotency-Key': 'closed-hearth' }),
  409
)
console.log(
  'Hearth integration passed: explicit check-in and room entry, private delivery while publishing is disabled, public-ID separation, bounded text, duplicate/conflicting posts, cooldown, spoofed viewer denial, journal deduplication, owner controls, deletion and checkout.'
)
