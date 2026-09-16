import assert from 'node:assert/strict'
import test from 'node:test'
import { adminCookie, validAdminCookie } from '../worker/src/admin-auth.ts'
await test('admin signatures reject tampering, expiry, another origin and a rotated key', async () => {
  const now = 1789516800000
  const secret = 'test-only-admin-secret'
  const origin = 'https://test.example'
  const token = await adminCookie(secret, origin, now)
  assert.equal(await validAdminCookie(token, secret, origin, now), true)
  assert.equal(
    await validAdminCookie(token, secret, origin, now + 1800000),
    false
  )
  assert.equal(await validAdminCookie(token, secret, origin, now - 1), false)
  assert.equal(await validAdminCookie(token, 'rotated-key', origin, now), false)
  assert.equal(
    await validAdminCookie(token, secret, 'https://other.example', now),
    false
  )
  const parts = token.split('.')
  parts[0] = String(now + 1799999)
  assert.equal(
    await validAdminCookie(parts.join('.'), secret, origin, now),
    false
  )
  assert.equal(await validAdminCookie('malformed', secret, origin, now), false)
})
