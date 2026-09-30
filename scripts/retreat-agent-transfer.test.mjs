import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AgentUpload,
  UPLOAD_TTL_MS,
  uploadStartSchema,
  readUploadPart
} from '../worker/src/agent-upload.ts'

function storage() {
  const data = new Map()
  return {
    data,
    kv: {
      get: (key) => structuredClone(data.get(key)),
      put: (key, value) => data.set(key, structuredClone(value)),
      delete: (key) => data.delete(key),
      list: ({ prefix, limit }) =>
        new Map(
          [...data]
            .filter(([key]) => key.startsWith(prefix))
            .slice(0, limit)
            .map(([key, value]) => [key, structuredClone(value)])
        )
    },
    transactionSync: (fn) => fn()
  }
}
const bytes = new TextEncoder().encode('One small work.')
const sha256 = Array.from(
  new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  (value) => value.toString(16).padStart(2, '0')
).join('')
const input = uploadStartSchema.parse({
  mime: 'text/plain',
  bytes: bytes.length,
  sha256
})
const rejects = (status) => (error) => error.status === status

await test('staged bytes survive a reconstructed store and commit leases permit recovery', async () => {
  const db = storage()
  let uploads = new AgentUpload(db)
  const now = Date.now()
  uploads.start('transfer-one', input, now)
  uploads.part('transfer-one', 0, bytes, now)
  uploads = new AgentUpload(db)
  assert.deepEqual(uploads.status('transfer-one', now).missing, [])
  const prepared = await uploads.prepare('transfer-one', now)
  assert.deepEqual(prepared.bytes, bytes)
  await assert.rejects(uploads.prepare('transfer-one', now), rejects(409))
  assert.throws(() => uploads.abort('transfer-one', now), rejects(409))
  // Simulate a worker interruption after acquiring the lease: a later attempt takes over.
  uploads = new AgentUpload(db)
  const recovered = await uploads.prepare('transfer-one', now + 120_001)
  uploads.release('transfer-one', prepared.lease)
  assert.equal(uploads.status('transfer-one', now).state, 'committing')
  uploads.complete('transfer-one', recovered.lease, 'artifact-id')
  assert.equal(uploads.status('transfer-one', now).artifactId, 'artifact-id')
  assert.equal(
    [...db.data.keys()].some((key) => key.includes(':part:')),
    false
  )
})

await test('incomplete or corrupted transfers cannot commit; expiry and abort remove staged bytes', async () => {
  const db = storage()
  const uploads = new AgentUpload(db)
  const now = Date.now()
  uploads.start('transfer-one', input, now)
  assert.throws(() => uploads.start('transfer-two', input, now), rejects(409))
  await assert.rejects(uploads.prepare('transfer-one', now), rejects(409))
  assert.throws(() => uploads.part('transfer-one', 1, bytes, now), rejects(400))
  assert.throws(
    () => uploads.part('transfer-one', 0, bytes.slice(1), now),
    rejects(400)
  )
  const corrupt = bytes.slice()
  corrupt[0] ^= 1
  uploads.part('transfer-one', 0, corrupt, now)
  await assert.rejects(uploads.prepare('transfer-one', now), rejects(422))
  assert.equal(uploads.status('transfer-one', now).state, 'receiving')
  assert.equal(uploads.abort('transfer-one', now).state, 'aborted')
  uploads.start('transfer-two', input, now)
  uploads.part('transfer-two', 0, bytes, now)
  assert.equal(
    uploads.status('transfer-two', now + UPLOAD_TTL_MS).state,
    'expired'
  )
  assert.equal(
    [...db.data.keys()].some((key) => key.includes(':part:')),
    false
  )
  assert.equal(uploads.nextExpiry(), Infinity)
})

await test('expiry waits for a live commit lease, and transfer starts remain bounded', async () => {
  const db = storage()
  const uploads = new AgentUpload(db)
  const now = Date.now()
  uploads.start('transfer-one', input, now)
  uploads.part('transfer-one', 0, bytes, now)
  await uploads.prepare('transfer-one', now + UPLOAD_TTL_MS - 1)
  assert.equal(
    uploads.status('transfer-one', now + UPLOAD_TTL_MS).state,
    'committing'
  )
  assert.equal(uploads.nextExpiry(), now + UPLOAD_TTL_MS + 119_999)
  uploads.expire(now + UPLOAD_TTL_MS + 120_000)
  assert.equal(uploads.status('transfer-one').state, 'expired')
  for (const key of [
    'transfer-two',
    'transfer-three',
    'transfer-four',
    'transfer-five'
  ]) {
    uploads.start(key, input)
    uploads.abort(key)
  }
  assert.throws(() => uploads.start('transfer-six', input), rejects(429))
  for (const patch of [
    { bytes: 2_097_153 },
    { bytes: 8001 },
    { partBytes: 10000 },
    { sha256: 'bad' }
  ])
    assert.equal(
      uploadStartSchema.safeParse({ ...input, ...patch }).success,
      false
    )
})

await test('raw part bodies enforce the same bound before buffering an oversized stream', async () => {
  const request = (body, headers = {}) =>
    new Request('https://test.example', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', ...headers },
      body,
      duplex: 'half'
    })
  assert.deepEqual(await readUploadPart(request(bytes)), bytes)
  await assert.rejects(
    readUploadPart(request(bytes, { 'Content-Length': '8193' })),
    rejects(413)
  )
  await assert.rejects(
    readUploadPart(request(bytes, { 'Content-Type': 'text/html' })),
    rejects(415)
  )
  let cancelled = false
  await assert.rejects(
    readUploadPart(
      request(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(8193))
          },
          cancel() {
            cancelled = true
            throw new Error('Transport closed')
          }
        })
      )
    ),
    rejects(413)
  )
  assert.equal(cancelled, true)
})
