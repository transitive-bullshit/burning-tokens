import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const base = process.env.RETREAT_TEST_ORIGIN
const keyFile = process.env.RETREAT_ADMIN_KEY_FILE
assert.ok(base && keyFile, 'Set RETREAT_TEST_ORIGIN and RETREAT_ADMIN_KEY_FILE')
const origin = new URL(base).origin
assert.ok(
  origin.startsWith('https:') ||
    ['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
  'Admin credentials require HTTPS outside localhost'
)
const key = (await readFile(keyFile, 'utf8')).trim()
let cookie
async function request(path, options = {}) {
  return fetch(new URL(path, origin), {
    ...options,
    redirect: 'error',
    signal: AbortSignal.timeout(15000)
  })
}
try {
  const anonymous = await request('/api/retreat/admin/metrics')
  assert.equal(
    anonymous.status,
    403,
    'Metrics must require admin authentication'
  )
  const login = await request('/api/retreat/admin/session', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  })
  assert.equal(login.status, 200, 'Admin login failed')
  cookie = login.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie, 'Missing admin cookie')
  const response = await request('/api/retreat/admin/metrics', {
    headers: { Cookie: cookie }
  })
  assert.equal(
    response.status,
    200,
    'Metrics unavailable: check the Worker secret and Analytics Engine configuration'
  )
  assert.match(response.headers.get('cache-control'), /no-store/)
  const data = await response.json()
  assert.equal(data.windowSeconds, 3600)
  assert.ok(Array.isArray(data.rows))
  console.log(
    'Last hour; sampling-adjusted aggregates. Not billing totals or global socket counts.'
  )
  console.table(
    data.rows.map(
      ({
        event,
        outcome,
        scope,
        observations,
        meanMs,
        totalAmount,
        totalExtra
      }) => ({
        event,
        outcome,
        scope,
        observations,
        meanMs,
        totalAmount,
        totalExtra
      })
    )
  )
  if (data.truncated)
    console.log('Warning: the bounded query reached its row limit.')
  if (!data.rows.length)
    console.log(
      'No points yet. Generate a visit and allow ingestion time before retrying.'
    )
} finally {
  if (cookie) {
    const logout = await request('/api/retreat/admin/session', {
      method: 'DELETE',
      headers: { Cookie: cookie, Origin: origin }
    })
    assert.equal(logout.status, 200, 'Admin logout failed')
  }
}
