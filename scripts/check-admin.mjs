import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const base = process.env.RETREAT_TEST_ORIGIN
const keyFile = process.env.RETREAT_ADMIN_KEY_FILE
assert.ok(
  base && keyFile,
  'Set RETREAT_TEST_ORIGIN and RETREAT_ADMIN_KEY_FILE; key values are never printed'
)
const origin = process.env.RETREAT_SITE_ORIGIN ?? base
const key = (await readFile(keyFile, 'utf8')).trim()
let cookie
async function request(path, options = {}, expected = 200) {
  const response = await fetch(new URL(path, base), {
    ...options,
    signal: AbortSignal.timeout(20000)
  })
  assert.equal(
    response.status,
    expected,
    'Unexpected admin verification status'
  )
  assert.match(response.headers.get('cache-control'), /no-store/)
  return response
}
try {
  await request('/api/retreat/admin/artifacts', {}, 403)
  const login = await request('/api/retreat/admin/session', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  })
  const setCookie = login.headers.get('set-cookie')
  for (const flag of [
    'HttpOnly',
    'SameSite=Strict',
    'Path=/api/retreat/admin',
    'Max-Age=1800'
  ])
    assert.ok(setCookie.includes(flag))
  if (origin.startsWith('https:')) assert.ok(setCookie.includes('Secure'))
  cookie = setCookie.split(';')[0]
  for (const collection of ['artifacts', 'hearth']) {
    const response = await request(`/api/retreat/admin/${collection}`, {
      headers: { Cookie: cookie }
    })
    const data = await response.json()
    assert.ok(
      Array.isArray(collection === 'artifacts' ? data.works : data.messages)
    )
  }
  await request(
    '/api/retreat/admin/artifacts',
    { method: 'POST', headers: { Cookie: cookie, Origin: origin } },
    405
  )
  console.log(
    'Deployed admin checks passed: anonymous denial, scoped login cookie, both review lists and read-only authorization. No private content printed.'
  )
} finally {
  if (cookie) {
    const logout = await request('/api/retreat/admin/session', {
      method: 'DELETE',
      headers: { Cookie: cookie, Origin: origin }
    })
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
  }
}
