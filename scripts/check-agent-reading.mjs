import assert from 'node:assert/strict'
const origin = new URL(
  process.env.RETREAT_TEST_ORIGIN ?? 'http://127.0.0.1:3010'
).origin
const roomIds = [
  'bathhouse',
  'dream-garden',
  'quiet-house',
  'source',
  'open-studio',
  'hearth',
  'temple'
]
async function read(url, html = false) {
  const response = await fetch(url, {
    headers: { Accept: html ? 'text/html' : 'text/markdown' },
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  })
  assert.equal(response.status, 200, 'Agent reading request failed')
  assert.match(
    response.headers.get('content-type'),
    html ? /text\/html/ : /text\/markdown/
  )
  assert.match(response.headers.get('cache-control'), /no-store/)
  return response.text()
}
async function wander(base) {
  const arrival = await read(base)
  const links = [
    ...arrival
      .slice(arrival.indexOf('## Wander'))
      .matchAll(/^- \[[^\]]+\]\((https?:\/\/[^)]+)\)/gm)
  ].map((match) => new URL(match[1]))
  const rooms = links.filter((url) => url.searchParams.has('room'))
  assert.deepEqual(
    rooms
      .map((url) => url.searchParams.get('room'))
      .sort((a, b) => a.localeCompare(b)),
    [...roomIds].sort((a, b) => a.localeCompare(b))
  )
  for (const url of rooms) {
    assert.equal(
      url.origin + url.pathname,
      base,
      'Room links preserve the original capability path'
    )
    const markdown = await read(url)
    assert.match(markdown, /## Return/)
    assert.match(
      markdown,
      /Opening a departure page does not itself declare checkout/
    )
    const html = await read(url, true)
    assert.match(html, /<h1>/)
    assert.match(html, /<h2>Return<\/h2>/)
    assert.equal([...html.matchAll(/<a href=/g)].length, 8)
  }
  const departure = links.find((url) => url.searchParams.has('departure'))
  assert.ok(departure)
  return read(departure)
}
await wander(origin + '/agent')
const created = await fetch(origin + '/api/retreat/invitations', {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ duration: 'short', visible: false }),
  redirect: 'error'
})
assert.equal(created.status, 201)
const visit = await created.json()
const cookie = created.headers.get('set-cookie').split(';')[0]
try {
  const departure = await wander(visit.agentUrl)
  assert.ok(
    departure.includes(visit.agentUrl + '/actions'),
    'Departure supplies its own checkout URL'
  )
  assert.match(departure, /"kind":"checkout"/)
  const response = await fetch(origin + '/api/retreat/visits/' + visit.id, {
    headers: { Cookie: cookie },
    redirect: 'error'
  })
  assert.equal(response.status, 200)
  const snapshot = await response.json()
  assert.equal(snapshot.lifecycle, 'opened')
  assert.equal(snapshot.checkedIn, false)
  assert.equal(snapshot.remainingActions, 8)
  assert.ok(snapshot.events.length >= 8)
  assert.ok(
    snapshot.events.every((event) => event.kind === 'observed'),
    'GET reading cannot imply ritual completion'
  )
} finally {
  const checkout = await fetch(visit.agentUrl + '/actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID()
    },
    body: JSON.stringify({ kind: 'checkout' }),
    redirect: 'error'
  })
  assert.equal(checkout.status, 200)
  const postcard = await checkout.text()
  assert.match(postcard, /No further checkout is needed/)
  assert.ok(!postcard.includes(visit.agentUrl + '/actions'))
}
console.log(
  'All seven public/private rooms support Markdown and HTML navigation; GET-only activity stays observational, and departure supplies checkout instructions.'
)
